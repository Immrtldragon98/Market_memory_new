from typing import Literal

from pydantic import BaseModel, Field


class WatchlistCreate(BaseModel):
    symbol: str = Field(min_length=1, max_length=32)
    name: str | None = Field(default=None, max_length=200)
    asset_type: Literal["crypto", "stock"]
    backend_id: str | None = Field(default=None, max_length=200)


class AlertCreate(BaseModel):
    symbol: str = Field(min_length=1, max_length=32)
    target_price: float = Field(gt=0)
    condition: Literal["above", "below"]
    asset_type: Literal["crypto", "stock"]
    backend_id: str = Field(min_length=1, max_length=200)
    currency: str | None = Field(default=None, max_length=16)
