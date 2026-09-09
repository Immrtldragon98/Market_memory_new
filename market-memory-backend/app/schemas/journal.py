from datetime import date
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator


class JournalCreate(BaseModel):
    symbol: str = Field(min_length=1, max_length=32)
    title: str = Field(min_length=1, max_length=200)
    note: str = Field(min_length=1, max_length=5000)
    confidence: int | None = Field(default=None, ge=1, le=10)
    emotion: str | None = Field(default=None, max_length=50)
    mistake: bool = False
    entry_type: Literal["observation", "decision"] = "decision"
    decision_action: Literal["buy", "sell", "hold", "wait", "avoid"] | None = None
    invalidation: str | None = Field(default=None, max_length=2000)
    review_due_on: date | None = None

    @field_validator("symbol", "title", "note")
    @classmethod
    def require_text(cls, value: str) -> str:
        value = value.strip()
        if not value:
            raise ValueError("Must not be blank")
        return value

    # v2 canonical asset fields. Optional keeps old clients compatible.
    asset_name: str | None = Field(default=None, max_length=200)
    asset_type: Literal["stock", "crypto"] | None = None
    backend_id: str | None = Field(default=None, max_length=200)
    exchange: str | None = Field(default=None, max_length=100)


class JournalReviewCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")
    lesson: str = Field(min_length=1, max_length=5000)

    @field_validator("lesson")
    @classmethod
    def require_lesson(cls, value: str) -> str:
        value = value.strip()
        if not value:
            raise ValueError("Write a lesson before completing the review")
        return value


class JournalSchedule(BaseModel):
    model_config = ConfigDict(extra="forbid")
    review_due_on: date | None
