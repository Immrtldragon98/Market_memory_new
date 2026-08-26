from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api import alerts, journal, memory, watchlist
from app.core.config import settings

app = FastAPI(title="Market Memory API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type"],
)

app.include_router(memory.router, prefix="/api", tags=["memory"])
app.include_router(journal.router, prefix="/api", tags=["journal"])
app.include_router(watchlist.router, prefix="/api", tags=["watchlist"])
app.include_router(alerts.router, prefix="/api", tags=["alerts"])


@app.get("/")
def health():
    return {"status": "running", "product": "Market Memory", "version": app.version}
