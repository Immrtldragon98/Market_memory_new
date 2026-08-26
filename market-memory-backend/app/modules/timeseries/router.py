from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field

from app.core.auth import get_current_user
from app.modules.timeseries.service import get_history, sample_asset, sample_tracked_assets

router = APIRouter()


class AssetRef(BaseModel):
    symbol: str = Field(min_length=1, max_length=32)
    name: str | None = Field(default=None, max_length=200)
    asset_type: Literal["stock", "crypto"]
    backend_id: str = Field(min_length=1, max_length=200)
    exchange: str | None = Field(default=None, max_length=100)


class SampleRequest(BaseModel):
    asset: AssetRef
    context: Literal["app_foreground", "app_background", "journal_create", "manual"]


class LifecycleSampleRequest(BaseModel):
    context: Literal["app_foreground", "app_background"]
    max_assets: int = Field(default=10, ge=1, le=10)


@router.post("/price-samples")
async def create_price_sample(payload: SampleRequest, user=Depends(get_current_user)):
    try:
        return await sample_asset(payload.asset.model_dump(), str(user.id), payload.context)
    except Exception as exc:
        raise HTTPException(status_code=502, detail="Unable to capture market price") from exc


@router.post("/price-samples/tracked")
async def sample_user_tracked_assets(payload: LifecycleSampleRequest, user=Depends(get_current_user)):
    results = await sample_tracked_assets(str(user.id), payload.context, payload.max_assets)
    return {"sampled": len(results), "results": results}


@router.get("/assets/{asset_id}/history")
async def asset_history(
    asset_id: int,
    range_key: Literal["1d", "7d", "30d", "90d", "1y", "5y"] = Query(default="7d", alias="range"),
    _user=Depends(get_current_user),
):
    return {"asset_id": asset_id, "range": range_key, "points": get_history(asset_id, range_key)}
