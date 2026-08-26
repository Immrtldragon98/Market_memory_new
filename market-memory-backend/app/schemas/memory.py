from typing import Any, Literal

from pydantic import BaseModel, Field

AssetType = Literal["crypto", "stock"]


class ObservationCreate(BaseModel):
    symbol: str = Field(min_length=1, max_length=32)
    asset_name: str | None = Field(default=None, max_length=200)
    asset_type: AssetType
    backend_id: str | None = Field(default=None, max_length=200)
    observation: str = Field(min_length=1, max_length=5000)
    price: float | None = None


class SnapshotCreate(BaseModel):
    symbol: str = Field(min_length=1, max_length=32)
    asset_name: str | None = Field(default=None, max_length=200)
    asset_type: AssetType
    backend_id: str | None = Field(default=None, max_length=200)
    price: float | None = None
    note: str | None = Field(default=None, max_length=5000)
    market_payload: dict[str, Any] = Field(default_factory=dict)
