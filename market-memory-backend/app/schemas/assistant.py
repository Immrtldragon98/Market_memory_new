from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator


class AssistantQuestion(BaseModel):
    model_config = ConfigDict(extra="forbid")

    question: str = Field(min_length=3, max_length=2000)
    symbol: str | None = Field(default=None, max_length=32)
    mode: Literal["reflect", "crypto_brief", "thesis_challenge", "bias_scan", "review_coach"] = "reflect"
    asset_type: Literal["stock", "crypto"] | None = None
    backend_id: str | None = Field(default=None, max_length=200)

    @field_validator("question")
    @classmethod
    def clean_question(cls, value: str) -> str:
        value = value.strip()
        if not value:
            raise ValueError("Question must not be blank")
        return value

    @field_validator("symbol")
    @classmethod
    def clean_symbol(cls, value: str | None) -> str | None:
        return value.strip().upper() if value and value.strip() else None

    @field_validator("backend_id")
    @classmethod
    def clean_backend_id(cls, value: str | None) -> str | None:
        return value.strip() if value and value.strip() else None


class AssistantAnswer(BaseModel):
    answer: str
    provider: str
    model: str
    source_entry_ids: list[int]
    mode: str
    evidence_count: int
    market_context: dict | None = None
    disclaimer: str = "Reflection only — not financial advice."
