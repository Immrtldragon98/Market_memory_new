from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel

from app.core.auth import get_current_user
from app.modules.market.service import get_quote, search_assets as search_market_assets

router = APIRouter()


class AssetSearchResult(BaseModel):
    symbol: str
    name: str
    asset_type: Literal["stock", "crypto"]
    backend_id: str
    exchange: str | None = None


@router.get("/assets/search", response_model=list[AssetSearchResult])
async def search_assets(
    q: str = Query(min_length=2, max_length=80),
    limit: int = Query(default=8, ge=5, le=10),
    _user=Depends(get_current_user),
):
    return await search_market_assets(q, limit=limit)


@router.get("/assets/price")
async def get_asset_price(
    asset_type: Literal["stock", "crypto"],
    backend_id: str = Query(min_length=1, max_length=200),
    _user=Depends(get_current_user),
):
    try:
        return await get_quote(asset_type, backend_id)
    except LookupError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=502, detail="Market data provider unavailable") from exc


async def fetch_asset_price(asset_type: Literal["stock", "crypto"], backend_id: str):
    """Compatibility bridge for v1.3 alerts during modular migration."""
    try:
        return await get_quote(asset_type, backend_id)
    except LookupError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=502, detail="Market data provider unavailable") from exc
