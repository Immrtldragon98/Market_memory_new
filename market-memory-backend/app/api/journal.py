from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, Query, status

from app.core.auth import get_current_user
from app.core.database import supabase
from app.modules.timeseries.service import get_history, sample_asset
from app.schemas.journal import JournalCreate

router = APIRouter()


@router.post("/journal", status_code=status.HTTP_201_CREATED)
async def create_entry(payload: JournalCreate, user=Depends(get_current_user)):
    row = payload.model_dump(exclude={"asset_name", "asset_type", "backend_id", "exchange"})
    row.update(user_id=user.id, symbol=payload.symbol.strip().upper())

    if payload.asset_type and payload.backend_id:
        try:
            captured = await sample_asset({
                "symbol": payload.symbol.strip().upper(),
                "name": payload.asset_name or payload.symbol.strip().upper(),
                "asset_type": payload.asset_type,
                "backend_id": payload.backend_id,
                "exchange": payload.exchange,
            }, str(user.id), "journal_create")
            row["asset_id"] = captured["asset"]["id"]
            row["entry_price_sample_id"] = captured["sample"]["id"]
        except Exception:
            # A journal decision must still be saveable when a market-data provider is temporarily unavailable.
            pass

    try:
        data = supabase.table("journal_entries").insert(row).execute().data or []
        if not data:
            raise HTTPException(status_code=400, detail="Unable to save journal entry")
        return data[0]
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=400, detail="Unable to save journal entry") from exc


@router.get("/journal")
async def list_entries(symbol: str | None = None, user=Depends(get_current_user)):
    query = supabase.table("journal_entries").select("*").eq("user_id", user.id)
    if symbol:
        query = query.eq("symbol", symbol.strip().upper())
    return query.order("created_at", desc=True).limit(250).execute().data or []


@router.get("/journal/{entry_id}/review")
async def review_entry(
    entry_id: int,
    range_key: Literal["1d", "7d", "30d", "90d", "1y", "5y"] = Query(default="7d", alias="range"),
    user=Depends(get_current_user),
):
    rows = (
        supabase.table("journal_entries")
        .select("*")
        .eq("id", entry_id)
        .eq("user_id", user.id)
        .limit(1)
        .execute()
        .data
        or []
    )
    if not rows:
        raise HTTPException(status_code=404, detail="Journal entry not found")

    entry = rows[0]
    entry_price = None
    sample_id = entry.get("entry_price_sample_id")
    if sample_id:
        samples = supabase.table("market_price_samples").select("*").eq("id", sample_id).limit(1).execute().data or []
        entry_price = samples[0] if samples else None

    history = get_history(entry["asset_id"], range_key) if entry.get("asset_id") else []
    return {
        "entry": entry,
        "entry_price": entry_price,
        "range": range_key,
        "history": history,
    }
