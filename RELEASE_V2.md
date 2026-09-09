# Market Memory: notebook foundation

Product: remember what you thought, what you saw, and what you learned.

## Implemented in this slice
- Four primary destinations: Home, Discover, Journal, Account. Existing observations/snapshots and alerts remain reachable from Home.
- Shared readable navy palette, compact mobile spacing, journal composer hidden until requested.
- Journal draft retained on failure, save guard, confidence validation, optional title, original reasoning shown during review.
- No synthetic entry prices. Price change compares two captured samples in the same currency; sample averages are separately labelled.
- Race-safe asset insertion, thread-pool isolation for journal/capture/auth/account blocking I/O, bounded caches and provider concurrency, quote coalescing, partial search handling.
- Migration 003 transaction and explicit UTC aggregation; automated regression and PostgreSQL smoke checks.

## Remaining release work
This is a foundation slice, not the completed first release. Data export/deletion, password recovery, provider quote timestamps and asset deep links remain to implement. Home now shows up to five due reviews with direct journal links. Journal supports observation/decision types, optional review dates, actions and invalidation evidence, 50-row pages, and completed lessons. Review completion preserves original text; conflicting edits return 409 and identical retries are safe. Dates use the local calendar supplied by the client; API-only callers default to UTC. Reminders are in-app only.

Provider quote timestamps are not persisted yet. Displayed capture times are NOT quote times; all prices remain labelled potentially delayed. Do not claim continuous market history or actual portfolio returns. No historical quote backfill or invented legacy asset mapping.

Provider clients/caches are per-process. Concurrency is bounded, but deployment-wide rate limiting and HTTP client lifecycle pooling remain before multi-instance scaling. Load and real-device background-suspension checks remain required.

## Migration release gate
Apply `20260908160635_journal_review_loop.sql` after 003 before deploying this review-loop build. It adds nullable review metadata and indexed due/reviewed lists. Existing entries remain decisions with no due date or lesson; existing ownership RLS remains in force.
Do not apply to production based solely on unit tests. Rehearse against a disposable Supabase project containing a copy of the existing schema and representative legacy rows. The CI PostgreSQL fixture verifies SQL and RLS flags, not a complete Supabase auth environment.

003 is still an unmerged PR migration. The added transaction/UTC fix affects databases that execute it. If any environment has already applied 003, compare its schema and generate a separate forward migration before deploying; do not assume editing this file updates it.

Before execution, capture a database backup and verify its restore procedure. After rehearsal, verify shared asset/sample constraints, user ownership policies, RPC outputs, legacy row counts and saved journal behavior during provider failure. Never populate old entry prices with current quotes.

Rollback for this additive release: revert application deployment while retaining the added tables/nullable columns and captured data. Do not drop shared history to roll back code. Rehearse the prior application against the upgraded schema. Restoring a backup is a separate recovery operation that can discard writes since backup.

## Checks
`cd market-memory-backend && python -m unittest discover -s tests -v`

`npm ci --prefix market-memory-frontend && npm run typecheck --prefix market-memory-frontend`

SQL smoke test must run only in a disposable database with no existing auth schema: `psql -v ON_ERROR_STOP=1 -f market-memory-backend/tests/migration_smoke.sql`.
