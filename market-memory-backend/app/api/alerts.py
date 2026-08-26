from fastapi import APIRouter, Depends, HTTPException, status

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


@router.delete("/alerts/{alert_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_alert(alert_id: int, user=Depends(get_current_user)):
    supabase.table("price_alerts").delete().eq("id", alert_id).eq("user_id", user.id).execute()
