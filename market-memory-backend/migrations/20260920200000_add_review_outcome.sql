alter table public.journal_entries
add column if not exists review_outcome text
check (review_outcome in ('yes', 'partially', 'no'));

alter table public.journal_entries
add column if not exists expectation text
check (expectation in ('bullish', 'bearish', 'neutral'));
