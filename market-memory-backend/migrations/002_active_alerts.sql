-- v1.3 Active Alerts
alter table public.price_alerts
  add column if not exists asset_type text check (asset_type in ('crypto','stock')),
  add column if not exists backend_id text,
  add column if not exists currency text,
  add column if not exists last_checked_price numeric,
  add column if not exists last_checked_at timestamptz,
  add column if not exists triggered_at timestamptz;

-- Existing alerts created before v1.3 are treated as stock symbols.
update public.price_alerts
set asset_type = coalesce(asset_type, 'stock'),
    backend_id = coalesce(backend_id, symbol)
where asset_type is null or backend_id is null;

alter table public.price_alerts alter column asset_type set not null;
alter table public.price_alerts alter column backend_id set not null;
