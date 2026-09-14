from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api import alerts, journal, market, memory, watchlist
from app.core.config import settings
from app.modules.account.router import router as account_router
from app.modules.assistant.router import router as assistant_router
from app.mcp_server import build_mcp_app, build_mcp_server
from app.modules.timeseries.router import router as timeseries_router

mcp_server = build_mcp_server()
mcp_app = build_mcp_app(mcp_server) if mcp_server else None


@asynccontextmanager
async def lifespan(_: FastAPI):
    if mcp_server:
        async with mcp_server.session_manager.run():
            yield
    else:
        yield


app = FastAPI(title="Market Memory API", version="2.1.0-alpha", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type", "Last-Event-ID", "Mcp-Method", "Mcp-Name", "Mcp-Protocol-Version", "Mcp-Session-Id"],
    expose_headers=["Mcp-Session-Id"],
)

app.include_router(market.router, prefix="/api", tags=["market"])
app.include_router(timeseries_router, prefix="/api", tags=["timeseries"])
app.include_router(memory.router, prefix="/api", tags=["memory"])
app.include_router(journal.router, prefix="/api", tags=["journal"])
app.include_router(watchlist.router, prefix="/api", tags=["watchlist"])
app.include_router(alerts.router, prefix="/api", tags=["alerts"])
app.include_router(account_router, prefix="/api", tags=["account"])
app.include_router(assistant_router, prefix="/api", tags=["assistant"])

if mcp_app:
    app.mount("/mcp", mcp_app)


@app.get("/")
def health():
    return {"status": "running", "product": "Market Memory", "version": app.version}


@app.get("/health/live")
def liveness():
    return {"status": "ok"}


@app.get("/health/ready")
def readiness():
    return {
        "status": "ready",
        "database": "configured",
        "assistant": bool(settings.groq_api_key or settings.openrouter_api_key),
        "mcp": bool(mcp_server),
    }
