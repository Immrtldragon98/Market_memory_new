from pydantic import BaseModel, ConfigDict, Field, field_validator


class AssistantQuestion(BaseModel):
    model_config = ConfigDict(extra="forbid")

    question: str = Field(min_length=3, max_length=2000)
    symbol: str | None = Field(default=None, max_length=32)

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


class AssistantAnswer(BaseModel):
    answer: str
    provider: str
    model: str
    source_entry_ids: list[int]
