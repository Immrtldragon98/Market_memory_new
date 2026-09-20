# Market Memory API deployment

The backend ships as one portable container. Keep the Vercel deployment for the
static web app and point `EXPO_PUBLIC_API_URL` at this API.

## Selected free path: AWS Lambda Function URL

The repository includes `.github/workflows/deploy-aws-lambda.yml`. It builds a
direct Lambda ZIP on GitHub Actions, deploys with short-lived GitHub OIDC
credentials, creates a public HTTPS Function URL, caps concurrency at two, and
smoke-tests `/health/live`. It does not require API Gateway, ECR, or a permanent
AWS access key.

One-time AWS setup:

1. Create a Lambda execution role with `AWSLambdaBasicExecutionRole`.
2. Create a GitHub OIDC deployment role restricted to this repository and the
   `main` branch. Grant it only the Lambda read/update/create, function URL,
   permission-policy, and `iam:PassRole` actions needed for the execution role.
3. Add GitHub repository variables `AWS_DEPLOY_ROLE_ARN`,
   `AWS_LAMBDA_ROLE_ARN`, and
   `WEB_ORIGIN=https://market-memory-web-immrtldragon931-2094.vercel.app`.
4. Add GitHub Actions secrets `SUPABASE_URL`, `SUPABASE_ANON_KEY`,
   `SUPABASE_SERVICE_ROLE_KEY`, `GROQ_API_KEY`, and `OPENROUTER_API_KEY`.
5. Run **Deploy API to AWS Lambda** manually. Copy its API URL into the Vercel
   web project's `EXPO_PUBLIC_API_URL`, then redeploy the web project.

Keep `MCP_PUBLIC_URL` unset. Lambda hosts the REST assistant; its read-only MCP
surface requires a stateful container host and remains disabled here.

## Alternative: Koyeb

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

## AWS Lambda + API Gateway (not selected)

API Gateway is unnecessary for this lightweight release because the Lambda
Function URL provides the required public HTTPS endpoint directly.

## AI behavior

The API tries Groq first, then OpenRouter. `OPENROUTER_MODEL=openrouter/free`
uses OpenRouter's free-model router, whose availability and rate limits vary.
The assistant only receives a bounded set of the authenticated user's journal
entries. It has no database credentials and no ability to write journal data.

The built-in request limiter is per process. Before scaling beyond one instance,
replace it with an atomic Redis/Valkey limiter and add centrally aggregated AI
usage and failure metrics.
