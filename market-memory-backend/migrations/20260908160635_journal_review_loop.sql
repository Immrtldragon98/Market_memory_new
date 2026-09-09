begin;

-- Additive: existing decisions and their price links are preserved.
alter table public.journal_entries
  add column if not exists entry_type text not null default 'decision' check (entry_type in ('observation', 'decision')),
  add column if not exists decision_action text check (decision_action in ('buy', 'sell', 'hold', 'wait', 'avoid')),
  add column if not exists invalidation text check (length(invalidation) <= 2000),
  add column if not exists review_due_on date,
  add column if not exists lesson text check (length(btrim(lesson)) between 1 and 5000),
  add column if not exists reviewed_at timestamptz;

create index if not exists journal_entries_due_idx
  on public.journal_entries(user_id, review_due_on, id)
  where reviewed_at is null and review_due_on is not null;
create index if not exists journal_entries_reviewed_idx
  on public.journal_entries(user_id, reviewed_at desc, id desc)
  where reviewed_at is not null;

-- Existing journal ownership RLS remains in force; no new public grants.
commit;
