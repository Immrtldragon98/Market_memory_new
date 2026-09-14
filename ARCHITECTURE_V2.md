# Market Memory v2 Architecture

## Goal
Keep the original product simple for the user while making the codebase easy to extend with research, AI, richer charts, notifications, and analytics.

## Architecture style
**Modular monolith.** One FastAPI deployment and one Expo application, split into strict feature modules. This is enough for thousands of users and avoids premature microservices.

## Core domain

### Asset
Canonical market identity. A stock/ETF/crypto exists once globally.

### Price sample
Append-only global market fact. Prices are **not owned by a user**. Samples are deduplicated by asset + time bucket so many users opening the same asset do not create duplicate rows.

### User memory events
User-owned events reference an asset:
- observation
- immutable snapshot
- journal decision
- alert
- watchlist membership

### Memory
Memory is a read model/projection over those events. It should not become a second source of truth.

## Time-series strategy
When the application moves to foreground or background, the client asks the backend to sample relevant assets. The backend fetches the current quote and inserts it only if that asset/time bucket is not already present.

History API returns data at useful resolutions:
- 1 day: raw samples
- 7 days: daily average
- 30/90 days: daily average
- 1 year: monthly average
- multi-year: yearly average

Each aggregate can expose average, min, max, first/open-ish and last/close-ish observed prices plus sample count.

This means a journal entry created today can later show how the market evolved without rewriting the original decision.

## Backend layout target

```text
app/
  core/                 # config, auth, database, errors
  modules/
    market/             # search, quote providers, canonical assets
    timeseries/         # price sampling + aggregation
    journal/            # decisions and review
    memory/             # event projection/read model
    alerts/
    watchlist/
    account/
  shared/               # shared types/utilities only
```

Each module owns router -> service -> repository/provider boundaries. Routers do HTTP only; business rules belong in services; database code belongs in repositories.

## Frontend layout target

```text
src/
  app/ or routes/       # routing only
  core/                 # session, API client, app lifecycle
  features/
    market/
    journal/
    memory/
    alerts/
    account/
  shared/
    components/
    theme/
    hooks/
    types/
```

Screens compose feature components. They do not contain API/data logic directly.

## Performance rules
- search returns 5-10 ranked results only (default 8)
- stock + crypto provider calls run concurrently
- short-lived in-memory cache for search and quotes
- debounce search in the client
- virtualized lists for long timelines
- no N+1 provider calls from render loops
- global price samples are deduplicated by time bucket
- database queries use asset/time indexes
- analytics use server-side aggregation, never download raw years of data to the phone

## Product rule
**Observe -> Record -> Decide -> Remember -> Review** remains the product loop.

The architecture should allow AI/research/thesis features later, but the core product must remain useful without them.
# Architecture hardening addendum (September 2026)

The web client remains a static Vercel deployment. The FastAPI backend is a
portable Docker service with Koyeb as the first deployment target, Oracle Cloud
VM as the persistent free-tier alternative, and AWS Lambda/API Gateway as an
HTTP-only fallback.

The reflection assistant uses Groq first and OpenRouter second. Providers never
receive database credentials or a user's Supabase access token. The API loads a
bounded, owner-filtered evidence set and sends only that text to the provider.
Answers must cite journal IDs and cannot modify journal data.

An optional Streamable HTTP MCP resource server exposes read-only journal tools.
It validates Supabase bearer tokens on every request and derives the database
owner filter from the verified subject. MCP is disabled unless `MCP_PUBLIC_URL`
is explicitly configured, and it should not be enabled on Lambda.

Remaining scaling boundary: all backend access currently uses a service-role
Supabase client and therefore bypasses RLS. Manual `user_id` filters are now
required at every query, but this is not sufficient as the codebase grows. The
next security migration should construct a request-scoped Supabase client with
the user's bearer token for all user-owned data, leaving service-role access in
small, audited infrastructure adapters only.
