from pydantic import BaseModel, Field


class JournalCreate(BaseModel):
    symbol: str = Field(min_length=1, max_length=32)
    title: str = Field(min_length=1, max_length=200)
    note: str = Field(min_length=1, max_length=5000)
    confidence: int | None = Field(default=None, ge=1, le=10)
    emotion: str | None = Field(default=None, max_length=50)
    mistake: bool = False
