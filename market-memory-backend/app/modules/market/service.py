import asyncio
import time
import math
import logging
from collections import OrderedDict
from typing import Literal

import httpx

AssetType = Literal["stock", "crypto"]

YAHOO_SEARCH = "https://query1.finance.yahoo.com/v1/finance/search"
YAHOO_CHART = "https://query1.finance.yahoo.com/v8/finance/chart"
COINGECKO_SEARCH = "https://api.coingecko.com/api/v3/search"
COINGECKO_PRICE = "https://api.coingecko.com/api/v3/simple/price"
COINGECKO_MARKETS = "https://api.coingecko.com/api/v3/coins/markets"

_SEARCH_TTL_SECONDS = 30.0
_QUOTE_TTL_SECONDS = 15.0
_search_cache: OrderedDict = OrderedDict()
_quote_cache: OrderedDict = OrderedDict()
_provider_slots = asyncio.Semaphore(4)
_quote_locks = [asyncio.Lock() for _ in range(64)]

# A deliberately small, provider-independent catalog keeps discovery useful
# during Yahoo/CoinGecko throttling and makes common India-first searches fast.
# Quotes still come from live providers; this is metadata, not cached pricing.
CORE_ASSETS = [
    {"symbol": "RELIANCE.NS", "name": "Reliance Industries", "asset_type": "stock", "backend_id": "RELIANCE.NS", "exchange": "NSE"},
    {"symbol": "TCS.NS", "name": "Tata Consultancy Services", "asset_type": "stock", "backend_id": "TCS.NS", "exchange": "NSE"},
    {"symbol": "HDFCBANK.NS", "name": "HDFC Bank", "asset_type": "stock", "backend_id": "HDFCBANK.NS", "exchange": "NSE"},
    {"symbol": "INFY.NS", "name": "Infosys", "asset_type": "stock", "backend_id": "INFY.NS", "exchange": "NSE"},
    {"symbol": "ICICIBANK.NS", "name": "ICICI Bank", "asset_type": "stock", "backend_id": "ICICIBANK.NS", "exchange": "NSE"},
    {"symbol": "BHARTIARTL.NS", "name": "Bharti Airtel", "asset_type": "stock", "backend_id": "BHARTIARTL.NS", "exchange": "NSE"},
    {"symbol": "SBIN.NS", "name": "State Bank of India", "asset_type": "stock", "backend_id": "SBIN.NS", "exchange": "NSE"},
    {"symbol": "ITC.NS", "name": "ITC", "asset_type": "stock", "backend_id": "ITC.NS", "exchange": "NSE"},
    {"symbol": "NVDA", "name": "NVIDIA", "asset_type": "stock", "backend_id": "NVDA", "exchange": "NASDAQ"},
    {"symbol": "AAPL", "name": "Apple", "asset_type": "stock", "backend_id": "AAPL", "exchange": "NASDAQ"},
    {"symbol": "MSFT", "name": "Microsoft", "asset_type": "stock", "backend_id": "MSFT", "exchange": "NASDAQ"},
    {"symbol": "BTC", "name": "Bitcoin", "asset_type": "crypto", "backend_id": "bitcoin", "exchange": "Crypto"},
    {"symbol": "ETH", "name": "Ethereum", "asset_type": "crypto", "backend_id": "ethereum", "exchange": "Crypto"},
    {"symbol": "SOL", "name": "Solana", "asset_type": "crypto", "backend_id": "solana", "exchange": "Crypto"},
]

def _cache_put(cache, key, value):
    cache[key] = (time.monotonic(), value)
    cache.move_to_end(key)
    while len(cache) > 512:
        cache.popitem(last=False)


def _fresh(entry: tuple[float, object] | None, ttl: float) -> bool:
    return bool(entry and (time.monotonic() - entry[0]) < ttl)


def _score(result: dict, query: str) -> int:
    q = query.casefold().strip()
    symbol = str(result.get("symbol", "")).casefold()
    name = str(result.get("name", "")).casefold()
    if symbol == q:
        rank = 0
    elif symbol.rsplit(".", 1)[0] == q:
        rank = 1
    elif name == q:
        rank = 1
    elif symbol.startswith(q):
        rank = 2
    elif name.startswith(q):
        rank = 3
    elif q in symbol:
        rank = 4
    elif q in name:
        rank = 5
    else:
        rank = 6
    return rank


def _search_core(query: str) -> list[dict]:
    return [asset.copy() for asset in CORE_ASSETS if _score(asset, query) < 6]


async def _search_stocks(client: httpx.AsyncClient, query: str) -> list[dict]:
    try:
        response = await client.get(YAHOO_SEARCH, params={"q": query, "quotesCount": 8, "newsCount": 0})
        response.raise_for_status()
        rows = response.json().get("quotes", [])
    except (httpx.HTTPError, ValueError):
        logging.getLogger(__name__).warning("Stock search provider failed")
        raise

    results: list[dict] = []
    for row in rows:
        if row.get("quoteType") not in {"EQUITY", "ETF"}:
            continue
        symbol = row.get("symbol")
        if not symbol:
            continue
        results.append({
            "symbol": symbol,
            "name": row.get("longname") or row.get("shortname") or symbol,
            "asset_type": "stock",
            "backend_id": symbol,
            "exchange": row.get("exchDisp") or row.get("exchange"),
        })
    return results


async def _search_crypto(client: httpx.AsyncClient, query: str) -> list[dict]:
    try:
        response = await client.get(COINGECKO_SEARCH, params={"query": query})
        response.raise_for_status()
        coins = response.json().get("coins", [])[:8]
    except (httpx.HTTPError, ValueError):
        logging.getLogger(__name__).warning("Crypto search provider failed")
        raise

    return [
        {
            "symbol": (coin.get("symbol") or "").upper(),
            "name": coin.get("name") or coin.get("id") or "Unknown",
            "asset_type": "crypto",
            "backend_id": coin.get("id"),
            "exchange": "Crypto",
        }
        for coin in coins
        if coin.get("id") and coin.get("symbol")
    ]


async def search_assets(query: str, limit: int = 8) -> list[dict]:
    query = query.strip()
    if len(query) < 2:
        return []
    limit = max(1, min(limit, 10))
    cache_key = f"{query.casefold()}:{limit}"
    cached = _search_cache.get(cache_key)
    if _fresh(cached, _SEARCH_TTL_SECONDS):
        return cached[1]

    timeout = httpx.Timeout(5.0)
    headers = {"User-Agent": "MarketMemory/2.0"}
    async with _provider_slots, httpx.AsyncClient(timeout=timeout, headers=headers, follow_redirects=True) as client:
        stocks, crypto = await asyncio.gather(
            _search_stocks(client, query),
            _search_crypto(client, query),
            return_exceptions=True,
        )

    core = _search_core(query)
    if isinstance(stocks, BaseException) and isinstance(crypto, BaseException) and not core:
        raise LookupError("Live market search is temporarily unavailable; try a ticker symbol")
    partial = isinstance(stocks, BaseException) or isinstance(crypto, BaseException)
    stocks = [] if isinstance(stocks, BaseException) else stocks
    crypto = [] if isinstance(crypto, BaseException) else crypto

    deduped: dict[tuple[str, str], dict] = {}
    for result in [*core, *stocks, *crypto]:
        key = (result["asset_type"], result["backend_id"])
        deduped[key] = result

    ranked = sorted(deduped.values(), key=lambda item: _score(item, query))[:limit]
    if not partial:
        _cache_put(_search_cache, cache_key, ranked)
    return ranked


async def get_quote(asset_type: AssetType, backend_id: str) -> dict:
    # Fixed lock stripes bound memory and collapse bursts for the same asset.
    async with _quote_locks[hash((asset_type, backend_id)) % len(_quote_locks)]:
        return await _get_quote(asset_type, backend_id)


async def get_crypto_context(backend_id: str) -> dict:
    """Return a compact, timestamped market snapshot suitable for AI context."""
    timeout = httpx.Timeout(6.0)
    headers = {"User-Agent": "MarketMemory/2.0"}
    async with _provider_slots, httpx.AsyncClient(timeout=timeout, headers=headers, follow_redirects=True) as client:
        response = await client.get(COINGECKO_MARKETS, params={
            "vs_currency": "usd", "ids": backend_id, "price_change_percentage": "24h",
            "sparkline": "false", "locale": "en",
        })
        response.raise_for_status()
        rows = response.json()
    if not rows:
        raise LookupError("Crypto market context unavailable")
    row = rows[0]
    return {
        "symbol": str(row.get("symbol") or "").upper(),
        "name": row.get("name"),
        "price_usd": row.get("current_price"),
        "change_24h_pct": row.get("price_change_percentage_24h"),
        "high_24h_usd": row.get("high_24h"),
        "low_24h_usd": row.get("low_24h"),
        "volume_24h_usd": row.get("total_volume"),
        "market_cap_usd": row.get("market_cap"),
        "market_cap_rank": row.get("market_cap_rank"),
        "as_of": row.get("last_updated"),
        "source": "CoinGecko",
    }


async def _get_quote(asset_type: AssetType, backend_id: str) -> dict:
    cache_key = f"{asset_type}:{backend_id}"
    cached = _quote_cache.get(cache_key)
    if _fresh(cached, _QUOTE_TTL_SECONDS):
        return cached[1]

    timeout = httpx.Timeout(5.0)
    headers = {"User-Agent": "MarketMemory/2.0"}
    async with _provider_slots, httpx.AsyncClient(timeout=timeout, headers=headers, follow_redirects=True) as client:
        if asset_type == "crypto":
            response = await client.get(COINGECKO_PRICE, params={"ids": backend_id, "vs_currencies": "inr"})
            response.raise_for_status()
            price = response.json().get(backend_id, {}).get("inr")
            if price is None:
                raise LookupError("Price unavailable")
            quote = {"price": float(price), "currency": "INR", "source": "CoinGecko"}
        else:
            response = await client.get(f"{YAHOO_CHART}/{backend_id}", params={"interval": "1d", "range": "1d"})
            response.raise_for_status()
            chart = response.json().get("chart", {})
            results = chart.get("result") or []
            if chart.get("error") or not results:
                raise LookupError("Price unavailable")
            meta = results[0].get("meta", {})
            price = meta.get("regularMarketPrice")
            if price is None:
                raise LookupError("Price unavailable")
            quote = {
                "price": float(price),
                "currency": meta.get("currency") or "INR",
                "source": "Yahoo Finance",
            }

    if not math.isfinite(quote["price"]) or quote["price"] <= 0:
        raise LookupError("Invalid market price")
    _cache_put(_quote_cache, cache_key, quote)
    return quote
