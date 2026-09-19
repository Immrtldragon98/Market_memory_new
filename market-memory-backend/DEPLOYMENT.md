# Market Memory API deployment

The backend ships as one portable container. Keep the Vercel deployment for the
static web app and point `EXPO_PUBLIC_API_URL` at this API.

## Preferred: Koyeb

Create a Web Service from this GitHub repository, choose Docker, and set the
root directory to `market-memory-backend`. The container listens on `PORT` and
publishes `/health/live` and `/health/ready`.

Required secrets: `SUPABASE_URL`, `SUPABASE_ANON_KEY`, and
`SUPABASE_SERVICE_ROLE_KEY`. Add `GROQ_API_KEY` as the primary AI provider and
`OPENROUTER_API_KEY` for fallback. Set `CORS_ORIGINS` to the exact public web
origin; do not use `*` with credentials.

Set `MCP_PUBLIC_URL=https://<api-host>/mcp` and include the API hostname in
`MCP_ALLOWED_HOSTS` only when MCP is intentionally public. MCP clients must send
the user's Supabase bearer token. The service-role key must never leave the API.

## Oracle Cloud Always Free VM

Install Docker, clone the repository, and build `market-memory-backend`. Run the
container behind Caddy or another TLS reverse proxy. Persist secrets in a
root-readable environment file outside the repository. Configure automatic OS
security updates and container restarts.

## AWS Lambda + API Gateway

Use `lambda_handler.handler` as the entry point with a Python 3.12 deployment
package or container image. The normal REST API and assistant endpoint work via
Mangum. Keep `MCP_PUBLIC_URL` unset: stateful Streamable HTTP MCP sessions are a
poor fit for independently scaled Lambda invocations.

## AI behavior

The API tries Groq first, then OpenRouter. `OPENROUTER_MODEL=openrouter/free`
uses OpenRouter's free-model router, whose availability and rate limits vary.
The assistant only receives a bounded set of the authenticated user's journal
entries. It has no database credentials and no ability to write journal data.

The built-in request limiter is per process. Before scaling beyond one instance,
replace it with an atomic Redis/Valkey limiter and add centrally aggregated AI
usage and failure metrics.
