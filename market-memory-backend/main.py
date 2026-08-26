from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api import alerts, journal, market, memory, watchlist
from app.core.config import settings
from app.modules.timeseries.router import router as timeseries_router

app = FastAPI(title="Market Memory API", version="2.0.0-alpha")

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type"],
)

app.include_router(market.router, prefix="/api", tags=["market"])
app.include_router(timeseries_router, prefix="/api", tags=["timeseries"])
app.include_router(memory.router, prefix="/api", tags=["memory"])
app.include_router(journal.router, prefix="/api", tags=["journal"])
app.include_router(watchlist.router, prefix="/api", tags=["watchlist"])
app.include_router(alerts.router, prefix="/api", tags=["alerts"])


@app.get("/")
def health():
    return {"status": "running", "product": "Market Memory", "version": app.version}
