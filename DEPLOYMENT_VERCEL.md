# Market Memory deployment: Vercel + Supabase

Market Memory uses two Vercel projects from this monorepo. Supabase continues to
provide authentication and PostgreSQL storage.

## 1. Prepare Supabase

1. Back up the existing database.
2. Apply the SQL files in `market-memory-backend/migrations` in filename order.
3. Run `market-memory-backend/tests/migration_smoke.sql` against a disposable
   PostgreSQL database before applying the production migration.
4. In Supabase Auth URL Configuration, add the final frontend URL as an allowed
   redirect URL.

Never expose `SUPABASE_SERVICE_ROLE_KEY` in the frontend project.

## 2. Deploy the API project

Import this GitHub repository into Vercel and set the project root directory to
`market-memory-backend`.

Add these server-only environment variables for Production and Preview:

- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `CORS_ORIGINS` (comma-separated frontend origins)

Deploy and verify `https://<api-project>.vercel.app/` returns a JSON health
response with `"status": "running"`.

## 3. Deploy the web project

Import the same repository again as a second Vercel project. Set its root
directory to `market-memory-frontend`.

Add these build-time environment variables for Production and Preview:

- `EXPO_PUBLIC_API_URL=https://<api-project>.vercel.app`
- `EXPO_PUBLIC_SUPABASE_URL`
- `EXPO_PUBLIC_SUPABASE_ANON_KEY`

The Supabase publishable/anon key is safe to expose to the browser when RLS is
correctly configured. The service-role key is not.

## 4. Close the CORS loop

After Vercel assigns the frontend URL, update the API project's `CORS_ORIGINS`
to include that exact origin and redeploy the API. Do not include a trailing
slash.

## 5. Production smoke test

1. Open the frontend in a private browser window.
2. Sign up or sign in.
3. Search for `RELIANCE.NS` and `BTC`.
4. Record an observation and a decision with a review date.
5. Confirm both records appear in Journal and the due review appears on Home.
6. Complete a review and confirm the lesson remains after refresh.
7. Confirm no request is sent to `localhost` and no service-role key appears in
   the browser bundle or network inspector.
