"""AWS Lambda entry point. Leave MCP_PUBLIC_URL unset on Lambda."""

from mangum import Mangum

from main import app

handler = Mangum(app, lifespan="off")
