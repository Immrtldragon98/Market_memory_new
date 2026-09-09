-- Disposable PostgreSQL database only. Minimal Supabase auth fixtures.
create schema auth;
create role authenticated;
create table auth.users (id uuid primary key);
create function auth.uid() returns uuid language sql stable as $$ select null::uuid $$;
\ir ../migrations/001_core_market_memory.sql
\ir ../migrations/002_active_alerts.sql
insert into auth.users values ('00000000-0000-0000-0000-000000000001');
insert into journal_entries(user_id,symbol,title,note) values ('00000000-0000-0000-0000-000000000001','TCS.NS','Legacy thought','Keep the original evidence');
\ir ../migrations/003_market_timeseries.sql
\ir ../migrations/003_market_timeseries.sql
\ir ../migrations/20260908160635_journal_review_loop.sql
\ir ../migrations/20260908160635_journal_review_loop.sql
begin;
set local timezone = 'Asia/Kolkata';
insert into market_assets(symbol,name,asset_type,backend_id) values ('TCS.NS','TCS','stock','TCS.NS');
insert into market_price_samples(asset_id,price,currency,source,sampled_at,bucket_at)
select id,100,'INR','test',date_trunc('day',now(),'UTC') + interval '1 minute',date_trunc('day',now(),'UTC') + interval '1 minute' from market_assets;
insert into market_price_samples(asset_id,price,currency,source,sampled_at,bucket_at)
select id,200,'INR','test',date_trunc('day',now(),'UTC') + interval '2 minutes',date_trunc('day',now(),'UTC') + interval '2 minutes' from market_assets;
do $$
declare aid bigint; result record;
begin
  if not exists(select 1 from journal_entries where title='Legacy thought' and asset_id is null and entry_price_sample_id is null) then raise exception 'Legacy data changed'; end if;
  if not exists(select 1 from journal_entries where title='Legacy thought' and entry_type='decision' and reviewed_at is null and review_due_on is null) then raise exception 'Review migration changed legacy entries'; end if;
  update journal_entries set review_due_on='2026-09-09', lesson='New evidence', reviewed_at=now() where title='Legacy thought';
  if not exists(select 1 from journal_entries where note='Keep the original evidence' and lesson='New evidence') then raise exception 'Original evidence lost'; end if;
  select id into aid from market_assets limit 1;
  select * into result from get_market_price_history(aid,'7d');
  if result.avg_price <> 150 or result.sample_count <> 2 or result.period_start <> date_trunc('day',now(),'UTC') then raise exception 'Aggregation incorrect'; end if;
  begin
    insert into market_assets(symbol,name,asset_type,backend_id) values ('TCS.NS','Duplicate','stock','TCS.NS');
    raise exception 'Unique constraint missing';
  exception when unique_violation then null;
  end;
  if (select count(*) from pg_class where relname in ('market_assets','market_price_samples','user_price_marks') and relrowsecurity) <> 3 then raise exception 'RLS missing'; end if;
end $$;
rollback;
