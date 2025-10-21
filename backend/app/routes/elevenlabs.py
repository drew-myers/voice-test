from typing import Any, Optional

from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel, Field

from ..services.elevenlabs import ElevenLabsError, create_conversation_token

router = APIRouter(tags=["elevenlabs"])


class ConversationTokenRequest(BaseModel):
    agent_id: Optional[str] = Field(
        default=None, description="Overrides ELEVENLABS_AGENT_ID for this request."
    )


@router.post(
    "/elevenlabs/conversation-token",
    summary="Create ElevenLabs conversation token",
)
async def issue_conversation_token(
    body: ConversationTokenRequest,
) -> dict[str, Any]:
    try:
        return await create_conversation_token(agent_id=body.agent_id)
    except ElevenLabsError as exc:
        raise HTTPException(
            status_code=int(getattr(exc, "status_code", status.HTTP_502_BAD_GATEWAY)),
            detail=str(exc),
        ) from exc
