from fastapi import APIRouter, Depends, HTTPException, status

from app.core.auth import get_current_user
from app.modules.assistant.service import AssistantUnavailable, answer_question
from app.schemas.assistant import AssistantAnswer, AssistantQuestion

router = APIRouter()


@router.post("/assistant/ask", response_model=AssistantAnswer)
async def ask_assistant(payload: AssistantQuestion, user=Depends(get_current_user)):
    try:
        return await answer_question(
            str(user.id), payload.question, payload.symbol, user.db,
            mode=payload.mode, asset_type=payload.asset_type, backend_id=payload.backend_id,
        )
    except AssistantUnavailable as exc:
        detail = str(exc)
        code = status.HTTP_429_TOO_MANY_REQUESTS if "rate limit" in detail else status.HTTP_503_SERVICE_UNAVAILABLE
        raise HTTPException(status_code=code, detail=detail) from exc
