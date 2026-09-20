# Market Memory Frontend

Production web exports use the Render API at
`https://market-memory-api-s4sj.onrender.com` unless
`EXPO_PUBLIC_API_URL` overrides it. Local development continues to use the
localhost URL from `app.json`.

Expo / React Native client for the clean v1 rebuild.

Before running, set `apiUrl`, `supabaseUrl`, and `supabaseAnonKey` in `app.json` or replace them with environment-driven Expo config.

Commands:

```bash
npm install
npm run start
npm run typecheck
```
