# Market Memory — Integration Setup

## 1. Apply Supabase migrations

Open Supabase → SQL Editor and run these files in order:

1. `market-memory-backend/migrations/001_core_market_memory.sql`
2. `market-memory-backend/migrations/002_active_alerts.sql`

Do not reverse the order.

## 2. Backend configuration

Inside `market-memory-backend/` copy `.env.example` to `.env` and fill:

```env
SUPABASE_URL=https://YOUR_PROJECT.supabase.co
SUPABASE_ANON_KEY=YOUR_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY=YOUR_SERVICE_ROLE_KEY
CORS_ORIGINS=http://localhost:8081,http://localhost:19006,http://localhost:8080
```

Never commit `.env` or the service-role key.

Install and start:

```powershell
cd market-memory-backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```

Verify in a browser on the PC:

`http://localhost:8000/`

Expected response includes `"status":"running"`.

## 3. Frontend configuration

Inside `market-memory-frontend/` copy `.env.example` to `.env`.

For web on the same PC:

```env
EXPO_PUBLIC_API_URL=http://localhost:8000
EXPO_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=YOUR_ANON_KEY
```

For a physical phone on the same Wi-Fi, use the PC's LAN IPv4 address instead of localhost, for example:

```env
EXPO_PUBLIC_API_URL=http://192.168.1.50:8000
```

Find the PC IPv4 address with:

```powershell
ipconfig
```

The phone and PC must be on the same network, and Windows Firewall must allow Python/port 8000 for the private network.

Install and start:

```powershell
cd market-memory-frontend
npm install
npx expo start
```

Use Expo Go or run the web target.

## 4. End-to-end smoke test

Test in this order:

1. Create/sign in to an account.
2. Search for a stock such as Reliance or Nvidia.
3. Search for a crypto asset such as Bitcoin.
4. Select an asset and confirm a quote appears.
5. Add it to Watchlist.
6. Save an Observation.
7. Capture a Snapshot.
8. Create a Journal decision.
9. Create a price Alert from the selected asset.
10. Open Memory and verify Observation + Snapshot + Journal appear in chronological review.
11. Open Alerts and run `Check active alerts now`.
12. Confirm `last checked` price/time appears and a condition changes to Triggered when satisfied.

## 5. Expected boundaries in v1.3

- Market quotes can be delayed.
- Alert checks are manual/on-demand in v1.3; there are no push notifications yet.
- Snapshots are immutable by design.
- The service-role key must remain backend-only.
