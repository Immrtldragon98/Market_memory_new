import asyncio
import time
from typing import Literal

import httpx

AssetType = Literal["stock", "crypto"]

YAHOO_SEARCH = "https://query1.finance.yahoo.com/v1/finance/search"
YAHOO_CHART = "https://query1.finance.yahoo.com/v8/finance/chart"
COINGECKO_SEARCH = "https://api.coingecko.com/api/v3/search"
COINGECKO_PRICE = "https://api.coingecko.com/api/v3/simple/price"

_SEARCH_TTL_SECONDS = 30.0
_QUOTE_TTL_SECONDS = 15.0
_search_cache: dict[str, tuple[float, list[dict]]] = {}
_quote_cache: dict[str, tuple[float, dict]] = {}


def _fresh(entry: tuple[float, object] | None, ttl: float) -> bool:
    return bool(entry and (time.monotonic() - entry[0]) < ttl)


def _score(result: dict, query: str) -> tuple[int, str]:
    q = query.casefold().strip()
    symbol = str(result.get("symbol", "")).casefold()
    name = str(result.get("name", "")).casefold()
    if symbol == q:
        rank = 0
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
    return rank, symbol


async def _search_stocks(client: httpx.AsyncClient, query: str) -> list[dict]:
    try:
        response = await client.get(YAHOO_SEARCH, params={"q": query, "quotesCount": 8, "newsCount": 0})
        response.raise_for_status()
        rows = response.json().get("quotes", [])
    except (httpx.HTTPError, ValueError):
        return []

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
        return []

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
    limit = max(1, min(limit, 10))
    cache_key = f"{query.casefold()}:{limit}"
    cached = _search_cache.get(cache_key)
    if _fresh(cached, _SEARCH_TTL_SECONDS):
        return cached[1]

    timeout = httpx.Timeout(5.0)
    headers = {"User-Agent": "MarketMemory/2.0"}
    async with httpx.AsyncClient(timeout=timeout, headers=headers, follow_redirects=True) as client:
        stocks, crypto = await asyncio.gather(
            _search_stocks(client, query),
            _search_crypto(client, query),
        )

    deduped: dict[tuple[str, str], dict] = {}
    for result in [*stocks, *crypto]:
        key = (result["asset_type"], result["backend_id"])
        deduped[key] = result

    ranked = sorted(deduped.values(), key=lambda item: _score(item, query))[:limit]
    _search_cache[cache_key] = (time.monotonic(), ranked)
    return ranked


async def get_quote(asset_type: AssetType, backend_id: str) -> dict:
    cache_key = f"{asset_type}:{backend_id}"
    cached = _quote_cache.get(cache_key)
    if _fresh(cached, _QUOTE_TTL_SECONDS):
        return cached[1]

    timeout = httpx.Timeout(5.0)
    headers = {"User-Agent": "MarketMemory/2.0"}
    async with httpx.AsyncClient(timeout=timeout, headers=headers, follow_redirects=True) as client:
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

    _quote_cache[cache_key] = (time.monotonic(), quote)
    return quote
