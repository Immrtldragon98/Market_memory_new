import asyncio
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


async def sample_tracked_assets(user_id: str, context: str, max_assets: int = 10) -> list[dict]:
    """Sample recently journaled canonical assets on app foreground/background.

    We intentionally cap this list. User lifecycle events must never fan out into unbounded provider calls.
    """
    journal_rows = (
        supabase.table("journal_entries")
        .select("asset_id,created_at")
        .eq("user_id", user_id)
        .not_.is_("asset_id", "null")
        .order("created_at", desc=True)
        .limit(100)
        .execute()
        .data
        or []
    )

    asset_ids: list[int] = []
    seen: set[int] = set()
    for row in journal_rows:
        asset_id = row.get("asset_id")
        if asset_id is None or asset_id in seen:
            continue
        seen.add(asset_id)
        asset_ids.append(asset_id)
        if len(asset_ids) >= max_assets:
            break

    if not asset_ids:
        return []

    asset_rows = (
        supabase.table("market_assets")
        .select("*")
        .in_("id", asset_ids)
        .execute()
        .data
        or []
    )
    by_id = {row["id"]: row for row in asset_rows}
    ordered_assets = [by_id[asset_id] for asset_id in asset_ids if asset_id in by_id]

    results = await asyncio.gather(
        *(sample_asset(asset, user_id, context) for asset in ordered_assets),
        return_exceptions=True,
    )
    return [item for item in results if isinstance(item, dict)]


def get_history(asset_id: int, range_key: str) -> list[dict]:
    return supabase.rpc("get_market_price_history", {
        "p_asset_id": asset_id,
        "p_range": range_key,
    }).execute().data or []
