from fastapi import APIRouter, Depends, HTTPException, status

from app.core.auth import get_current_user
from app.core.database import supabase
from app.schemas.journal import JournalCreate

router = APIRouter()


@router.post("/journal", status_code=status.HTTP_201_CREATED)
async def create_entry(payload: JournalCreate, user=Depends(get_current_user)):
    row = payload.model_dump()
    row.update(user_id=user.id, symbol=payload.symbol.strip().upper())
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
