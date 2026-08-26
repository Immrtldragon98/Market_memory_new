from typing import Literal

import httpx
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel

from app.core.auth import get_current_user

router = APIRouter()

YAHOO_SEARCH = "https://query1.finance.yahoo.com/v1/finance/search"
YAHOO_CHART = "https://query1.finance.yahoo.com/v8/finance/chart"
COINGECKO_SEARCH = "https://api.coingecko.com/api/v3/search"
COINGECKO_PRICE = "https://api.coingecko.com/api/v3/simple/price"


class AssetSearchResult(BaseModel):
    symbol: str
    name: str
    asset_type: Literal["stock", "crypto"]
    backend_id: str
    exchange: str | None = None


async def _search_stocks(client: httpx.AsyncClient, query: str) -> list[AssetSearchResult]:
    try:
        response = await client.get(YAHOO_SEARCH, params={"q": query, "quotesCount": 8, "newsCount": 0})
        response.raise_for_status()
        rows = response.json().get("quotes", [])
    except (httpx.HTTPError, ValueError):
        return []

    results: list[AssetSearchResult] = []
    for row in rows:
        if row.get("quoteType") not in {"EQUITY", "ETF"}:
            continue
        symbol = row.get("symbol")
        if not symbol:
            continue
        results.append(AssetSearchResult(symbol=symbol, name=row.get("longname") or row.get("shortname") or symbol, asset_type="stock", backend_id=symbol, exchange=row.get("exchDisp") or row.get("exchange")))
    return results


async def _search_crypto(client: httpx.AsyncClient, query: str) -> list[AssetSearchResult]:
    try:
        response = await client.get(COINGECKO_SEARCH, params={"query": query})
        response.raise_for_status()
        coins = response.json().get("coins", [])[:6]
    except (httpx.HTTPError, ValueError):
        return []

    return [AssetSearchResult(symbol=(coin.get("symbol") or "").upper(), name=coin.get("name") or coin.get("id") or "Unknown", asset_type="crypto", backend_id=coin.get("id") or "", exchange="Crypto") for coin in coins if coin.get("id") and coin.get("symbol")]


async def fetch_asset_price(asset_type: Literal["stock", "crypto"], backend_id: str) -> dict:
    timeout = httpx.Timeout(6.0)
    headers = {"User-Agent": "MarketMemory/1.3"}
    async with httpx.AsyncClient(timeout=timeout, headers=headers, follow_redirects=True) as client:
        try:
            if asset_type == "crypto":
                response = await client.get(COINGECKO_PRICE, params={"ids": backend_id, "vs_currencies": "inr"})
                response.raise_for_status()
                price = response.json().get(backend_id, {}).get("inr")
                if price is None:
                    raise HTTPException(status_code=404, detail="Price unavailable")
                return {"price": float(price), "currency": "INR", "source": "CoinGecko"}

            response = await client.get(f"{YAHOO_CHART}/{backend_id}", params={"interval": "1d", "range": "1d"})
            response.raise_for_status()
            chart = response.json().get("chart", {})
            if chart.get("error"):
                raise HTTPException(status_code=404, detail="Price unavailable")
            results = chart.get("result") or []
            if not results:
                raise HTTPException(status_code=404, detail="Price unavailable")
            meta = results[0].get("meta", {})
            price = meta.get("regularMarketPrice")
            if price is None:
                raise HTTPException(status_code=404, detail="Price unavailable")
            return {"price": float(price), "currency": meta.get("currency") or "INR", "source": "Yahoo Finance"}
        except HTTPException:
            raise
        except (httpx.HTTPError, ValueError, KeyError) as exc:
            raise HTTPException(status_code=502, detail="Market data provider unavailable") from exc


@router.get("/assets/search", response_model=list[AssetSearchResult])
async def search_assets(q: str = Query(min_length=2, max_length=80), _user=Depends(get_current_user)):
    query = q.strip()
    timeout = httpx.Timeout(6.0)
    headers = {"User-Agent": "MarketMemory/1.3"}
    async with httpx.AsyncClient(timeout=timeout, headers=headers, follow_redirects=True) as client:
        stocks = await _search_stocks(client, query)
        crypto = await _search_crypto(client, query)
    return [*stocks, *crypto][:12]


@router.get("/assets/price")
async def get_asset_price(asset_type: Literal["stock", "crypto"], backend_id: str = Query(min_length=1, max_length=200), _user=Depends(get_current_user)):
    return await fetch_asset_price(asset_type, backend_id)
