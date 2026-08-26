from typing import Literal

from pydantic import BaseModel, Field


class JournalCreate(BaseModel):
    symbol: str = Field(min_length=1, max_length=32)
    title: str = Field(min_length=1, max_length=200)
    note: str = Field(min_length=1, max_length=5000)
    confidence: int | None = Field(default=None, ge=1, le=10)
    emotion: str | None = Field(default=None, max_length=50)
    mistake: bool = False

    # v2 canonical asset fields. Optional keeps old clients compatible.
    asset_name: str | None = Field(default=None, max_length=200)
    asset_type: Literal["stock", "crypto"] | None = None
    backend_id: str | None = Field(default=None, max_length=200)
    exchange: str | None = Field(default=None, max_length=100)
