from datetime import datetime, timezone

from app.core.database import supabase
from app.modules.market.service import get_quote


def _minute_bucket(now: datetime) -> str:
    return now.astimezone(timezone.utc).replace(second=0, microsecond=0).isoformat()


def ensure_asset(asset: dict) -> dict:
    rows = (
        supabase.table("market_assets")
        .select("*")
        .eq("asset_type", asset["asset_type"])
        .eq("backend_id", asset["backend_id"])
        .limit(1)
        .execute()
        .data
        or []
    )
    if rows:
        current = rows[0]
        updates = {}
        for key in ("symbol", "name", "exchange"):
            value = asset.get(key)
            if value is not None and current.get(key) != value:
                updates[key] = value
        if updates:
            supabase.table("market_assets").update(updates).eq("id", current["id"]).execute()
            current.update(updates)
        return current

    inserted = supabase.table("market_assets").insert({
        "symbol": asset["symbol"].upper(),
        "name": asset.get("name") or asset["symbol"],
        "asset_type": asset["asset_type"],
        "backend_id": asset["backend_id"],
        "exchange": asset.get("exchange"),
    }).execute().data or []
    return inserted[0]


async def sample_asset(asset: dict, user_id: str, context: str) -> dict:
    canonical = ensure_asset(asset)
    now = datetime.now(timezone.utc)
    bucket_at = _minute_bucket(now)

    rows = (
        supabase.table("market_price_samples")
        .select("*")
        .eq("asset_id", canonical["id"])
        .eq("bucket_at", bucket_at)
        .limit(1)
        .execute()
        .data
        or []
    )

    if rows:
        sample = rows[0]
    else:
        quote = await get_quote(canonical["asset_type"], canonical["backend_id"])
        try:
            inserted = supabase.table("market_price_samples").insert({
                "asset_id": canonical["id"],
                "price": quote["price"],
                "currency": quote["currency"],
                "source": quote["source"],
                "sampled_at": now.isoformat(),
                "bucket_at": bucket_at,
            }).execute().data or []
            sample = inserted[0]
        except Exception:
            rows = (
                supabase.table("market_price_samples")
                .select("*")
                .eq("asset_id", canonical["id"])
                .eq("bucket_at", bucket_at)
                .limit(1)
                .execute()
                .data
                or []
            )
            if not rows:
                raise
            sample = rows[0]

    mark = supabase.table("user_price_marks").insert({
        "user_id": user_id,
        "asset_id": canonical["id"],
        "price_sample_id": sample["id"],
        "context": context,
    }).execute().data or []

    return {"asset": canonical, "sample": sample, "mark": mark[0] if mark else None}


def get_history(asset_id: int, range_key: str) -> list[dict]:
    return supabase.rpc("get_market_price_history", {
        "p_asset_id": asset_id,
        "p_range": range_key,
    }).execute().data or []
