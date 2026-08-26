from fastapi import APIRouter, Depends

from app.core.auth import get_current_user
from app.core.database import supabase

router = APIRouter()


def _count(table: str, user_id: str, active_only: bool = False) -> int:
    query = supabase.table(table).select("id", count="exact").eq("user_id", user_id)
    if active_only:
        query = query.eq("is_active", True)
    response = query.execute()
    return int(response.count or 0)


@router.get("/account/summary")
async def account_summary(user=Depends(get_current_user)):
    user_id = str(user.id)
    return {
        "user": {
            "id": user_id,
            "email": getattr(user, "email", None),
        },
        "stats": {
            "observations": _count("market_observations", user_id),
            "snapshots": _count("market_snapshots", user_id),
            "journal_entries": _count("journal_entries", user_id),
            "watchlist_items": _count("watchlist_items", user_id),
            "active_alerts": _count("price_alerts", user_id, active_only=True),
        },
        "market_data": {
            "stocks": "Yahoo Finance",
            "crypto": "CoinGecko",
            "price_capture": "foreground/background + journal events",
        },
    }
