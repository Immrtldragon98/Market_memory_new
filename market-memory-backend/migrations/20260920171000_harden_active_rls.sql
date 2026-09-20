-- Active Market Memory tables: explicit authenticated policies, init-plan-safe
-- ownership checks, and indexes for foreign keys used by the current product.

drop policy if exists "own observations" on public.market_observations;
create policy "own observations" on public.market_observations for all
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

drop policy if exists "own journal" on public.journal_entries;
create policy "own journal" on public.journal_entries for all
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

drop policy if exists "own watchlist" on public.watchlist_items;
create policy "own watchlist" on public.watchlist_items for all
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

drop policy if exists "own alerts" on public.price_alerts;
create policy "own alerts" on public.price_alerts for all
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

drop policy if exists "read own snapshots" on public.market_snapshots;
create policy "read own snapshots" on public.market_snapshots for select
to authenticated
using ((select auth.uid()) = user_id);

drop policy if exists "create own snapshots" on public.market_snapshots;
create policy "create own snapshots" on public.market_snapshots for insert
to authenticated
with check ((select auth.uid()) = user_id);

create index if not exists market_observations_user_id_idx on public.market_observations(user_id);
create index if not exists market_snapshots_user_id_idx on public.market_snapshots(user_id);
create index if not exists price_alerts_user_id_idx on public.price_alerts(user_id);
create index if not exists journal_entries_asset_id_idx on public.journal_entries(asset_id);
create index if not exists journal_entries_entry_price_sample_id_idx on public.journal_entries(entry_price_sample_id);
