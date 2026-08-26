from fastapi import APIRouter, Depends, HTTPException, status

from app.core.auth import get_current_user
from app.core.database import supabase
from app.schemas.market_tools import WatchlistCreate

router = APIRouter()


@router.post("/watchlist", status_code=status.HTTP_201_CREATED)
async def add_watchlist(payload: WatchlistCreate, user=Depends(get_current_user)):
    row = payload.model_dump()
    row.update(user_id=user.id, symbol=payload.symbol.strip().upper())
    try:
        data = supabase.table("watchlist_items").insert(row).execute().data or []
        return data[0] if data else row
    except Exception as exc:
        raise HTTPException(status_code=400, detail="Unable to add watchlist item") from exc


@router.get("/watchlist")
async def list_watchlist(user=Depends(get_current_user)):
    return supabase.table("watchlist_items").select("*").eq("user_id", user.id).order("created_at", desc=True).execute().data or []


@router.delete("/watchlist/{item_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_watchlist(item_id: int, user=Depends(get_current_user)):
    supabase.table("watchlist_items").delete().eq("id", item_id).eq("user_id", user.id).execute()
