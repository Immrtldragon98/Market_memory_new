from fastapi import APIRouter, Depends

from app.core.auth import get_current_user
from app.core.database import db_for

router = APIRouter()


def _count(db, table: str, user_id: str, active_only: bool = False) -> int:
    query = db.table(table).select("id", count="exact").eq("user_id", user_id)
    if active_only:
        query = query.eq("is_active", True)
    response = query.execute()
    return int(response.count or 0)


@router.get("/account/summary")
def account_summary(user=Depends(get_current_user)):
    user_id = str(user.id)
    db = db_for(user)
    return {
        "user": {
            "id": user_id,
            "email": getattr(user, "email", None),
        },
        "stats": {
            "observations": _count(db, "market_observations", user_id),
            "snapshots": _count(db, "market_snapshots", user_id),
            "journal_entries": _count(db, "journal_entries", user_id),
            "watchlist_items": _count(db, "watchlist_items", user_id),
            "active_alerts": _count(db, "price_alerts", user_id, active_only=True),
        },
        "market_data": {
            "stocks": "Yahoo Finance",
            "crypto": "CoinGecko",
            "price_capture": "foreground/background + journal events",
        },
    }
