from typing import Any, Optional

from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel, Field

from ..services.elevenlabs import (
    ElevenLabsError,
    create_conversation_token,
    get_prompt,
    suggest_prompt,
    transcribe_audio,
    update_prompt,
)

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


class PromptResponse(BaseModel):
    agent_id: str
    display_name: Optional[str] = None
    prompt: Optional[str] = None
    first_message: Optional[str] = None


class PromptUpdateRequest(BaseModel):
    prompt: str
    first_message: Optional[str] = None
    agent_id: Optional[str] = Field(
        default=None, description="Overrides ELEVENLABS_AGENT_ID for this request."
    )


class PromptSuggestionRequest(BaseModel):
    feedback: str
    agent_id: Optional[str] = Field(
        default=None, description="Overrides ELEVENLABS_AGENT_ID for this request."
    )


class PromptSuggestionResponse(BaseModel):
    agent_id: str
    display_name: Optional[str] = None
    current_prompt: str
    suggested_prompt: str


class TranscriptionRequest(BaseModel):
    audio: str = Field(..., description="Base64-encoded audio data")
    format: str = Field(default="webm", description="Audio format (e.g. webm, wav)")
    language_code: Optional[str] = Field(
        default=None, description="Optional language code override"
    )
    model_id: Optional[str] = Field(
        default=None, description="Optional ElevenLabs STT model override"
    )


class TranscriptionResponse(BaseModel):
    text: str


@router.get(
    "/elevenlabs/prompt",
    response_model=PromptResponse,
    summary="Fetch the current ElevenLabs agent prompt",
)
async def fetch_prompt(agent_id: Optional[str] = None) -> PromptResponse:
    try:
        data = await get_prompt(agent_id=agent_id)
        return PromptResponse(**data)
    except ElevenLabsError as exc:
        raise HTTPException(
            status_code=int(getattr(exc, "status_code", status.HTTP_502_BAD_GATEWAY)),
            detail=str(exc),
        ) from exc


@router.post(
    "/elevenlabs/transcribe",
    response_model=TranscriptionResponse,
    summary="Transcribe recorded audio via ElevenLabs speech-to-text",
)
async def transcribe(body: TranscriptionRequest) -> TranscriptionResponse:
    try:
        data = await transcribe_audio(
            audio_base64=body.audio,
            fmt=body.format,
            language_code=body.language_code,
            model_id=body.model_id,
        )
        return TranscriptionResponse(**data)
    except ElevenLabsError as exc:
        raise HTTPException(
            status_code=int(getattr(exc, "status_code", status.HTTP_502_BAD_GATEWAY)),
            detail=str(exc),
        ) from exc


@router.put(
    "/elevenlabs/prompt",
    response_model=PromptResponse,
    summary="Persist a new agent prompt to ElevenLabs",
)
async def save_prompt(body: PromptUpdateRequest) -> PromptResponse:
    try:
        updated = await update_prompt(
            prompt=body.prompt,
            first_message=body.first_message,
            agent_id=body.agent_id,
        )
        prompt_text = None
        first_message = None
        display_name = None
        try:
            prompt_text = (
                updated["conversation_config"]["agent"]["prompt"]["prompt"]
            )  # type: ignore[index]
        except (KeyError, TypeError):
            prompt_text = body.prompt
        try:
            first_message = (
                updated["conversation_config"]["agent"]["first_message"]
            )  # type: ignore[index]
        except (KeyError, TypeError):
            first_message = body.first_message
        if isinstance(updated, dict):
            raw_name = updated.get("display_name")
            if isinstance(raw_name, str):
                display_name = raw_name.strip() or None
            elif raw_name is None:
                display_name = None
        resolved_agent_id = ""
        if isinstance(updated, dict):
            resolved_agent_id = str(updated.get("agent_id") or "")
        if not resolved_agent_id:
            resolved_agent_id = body.agent_id or ""

        return PromptResponse(
            agent_id=resolved_agent_id,
            display_name=display_name,
            prompt=prompt_text,
            first_message=first_message,
        )
    except ElevenLabsError as exc:
        raise HTTPException(
            status_code=int(getattr(exc, "status_code", status.HTTP_502_BAD_GATEWAY)),
            detail=str(exc),
        ) from exc


@router.post(
    "/elevenlabs/prompt/suggest",
    response_model=PromptSuggestionResponse,
    summary="Generate a prompt update suggestion using developer feedback",
)
async def suggest_prompt_update(
    body: PromptSuggestionRequest,
) -> PromptSuggestionResponse:
    try:
        data = await suggest_prompt(feedback=body.feedback, agent_id=body.agent_id)
        return PromptSuggestionResponse(**data)
    except ElevenLabsError as exc:
        raise HTTPException(
            status_code=int(getattr(exc, "status_code", status.HTTP_502_BAD_GATEWAY)),
            detail=str(exc),
        ) from exc
