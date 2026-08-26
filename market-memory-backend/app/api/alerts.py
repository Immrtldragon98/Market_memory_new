from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status

from app.api.market import fetch_asset_price
from app.core.auth import get_current_user
from app.core.database import supabase
from app.schemas.market_tools import AlertCreate

router = APIRouter()


@router.post("/alerts", status_code=status.HTTP_201_CREATED)
async def create_alert(payload: AlertCreate, user=Depends(get_current_user)):
    row = payload.model_dump()
    row.update(user_id=user.id, symbol=payload.symbol.strip().upper(), is_active=True)
    try:
        data = supabase.table("price_alerts").insert(row).execute().data or []
        if not data:
            raise HTTPException(status_code=400, detail="Unable to create alert")
        return data[0]
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=400, detail="Unable to create alert") from exc


@router.get("/alerts")
async def list_alerts(user=Depends(get_current_user)):
    return supabase.table("price_alerts").select("*").eq("user_id", user.id).order("created_at", desc=True).execute().data or []


@router.post("/alerts/check")
async def check_alerts(user=Depends(get_current_user)):
    alerts = (
        supabase.table("price_alerts")
        .select("*")
        .eq("user_id", user.id)
        .eq("is_active", True)
        .order("created_at", desc=True)
        .execute()
        .data
        or []
    )
    checked_at = datetime.now(timezone.utc).isoformat()
    results = []

    for alert in alerts:
        try:
            quote = await fetch_asset_price(alert["asset_type"], alert["backend_id"])
            price = float(quote["price"])
            target = float(alert["target_price"])
            triggered = price >= target if alert["condition"] == "above" else price <= target
            updates = {
                "last_checked_price": price,
                "last_checked_at": checked_at,
                "currency": quote.get("currency") or alert.get("currency"),
            }
            if triggered:
                updates.update(is_active=False, triggered_at=checked_at)
            (
                supabase.table("price_alerts")
                .update(updates)
                .eq("id", alert["id"])
                .eq("user_id", user.id)
                .execute()
            )
            results.append({
                "id": alert["id"],
                "symbol": alert["symbol"],
                "current_price": price,
                "target_price": target,
                "condition": alert["condition"],
                "triggered": triggered,
                "currency": quote.get("currency"),
                "source": quote.get("source"),
                "checked_at": checked_at,
            })
        except HTTPException as exc:
            results.append({"id": alert["id"], "symbol": alert["symbol"], "triggered": False, "error": exc.detail, "checked_at": checked_at})

    return {"checked": len(results), "results": results}


@router.delete("/alerts/{alert_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_alert(alert_id: int, user=Depends(get_current_user)):
    supabase.table("price_alerts").delete().eq("id", alert_id).eq("user_id", user.id).execute()
