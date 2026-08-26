from fastapi import APIRouter, Depends, HTTPException, status

from app.core.auth import get_current_user
from app.core.database import supabase
from app.schemas.memory import ObservationCreate, SnapshotCreate

router = APIRouter()


def _symbol(value: str) -> str:
    return value.strip().upper()


@router.post("/observations", status_code=status.HTTP_201_CREATED)
async def create_observation(payload: ObservationCreate, user=Depends(get_current_user)):
    row = payload.model_dump()
    row.update(user_id=user.id, symbol=_symbol(payload.symbol), observation=payload.observation.strip())
    try:
        data = supabase.table("market_observations").insert(row).execute().data or []
        if not data:
            raise HTTPException(status_code=400, detail="Unable to save observation")
        return data[0]
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=400, detail="Unable to save observation") from exc


@router.get("/observations")
async def list_observations(symbol: str | None = None, user=Depends(get_current_user)):
    query = supabase.table("market_observations").select("*").eq("user_id", user.id)
    if symbol:
        query = query.eq("symbol", _symbol(symbol))
    return query.order("created_at", desc=True).limit(250).execute().data or []


@router.post("/snapshots", status_code=status.HTTP_201_CREATED)
async def create_snapshot(payload: SnapshotCreate, user=Depends(get_current_user)):
    row = payload.model_dump()
    row.update(user_id=user.id, symbol=_symbol(payload.symbol))
    if payload.note is not None:
        row["note"] = payload.note.strip()
    try:
        data = supabase.table("market_snapshots").insert(row).execute().data or []
        if not data:
            raise HTTPException(status_code=400, detail="Unable to capture snapshot")
        return data[0]
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=400, detail="Unable to capture snapshot") from exc


@router.get("/snapshots")
async def list_snapshots(symbol: str | None = None, user=Depends(get_current_user)):
    query = supabase.table("market_snapshots").select("*").eq("user_id", user.id)
    if symbol:
        query = query.eq("symbol", _symbol(symbol))
    return query.order("created_at", desc=True).limit(250).execute().data or []
