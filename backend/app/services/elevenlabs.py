from __future__ import annotations

import asyncio
from http import HTTPStatus
from functools import lru_cache
from typing import Any, Optional

from ..config import get_settings


class ElevenLabsError(RuntimeError):
    """Raised when the ElevenLabs SDK encounters an error."""

    def __init__(self, message: str, *, status_code: int = HTTPStatus.BAD_GATEWAY):
        super().__init__(message)
        self.status_code = status_code


@lru_cache(maxsize=1)
def _build_client(api_key: str | None, base_url: str):
    if not api_key:
        raise ElevenLabsError(
            "ELEVENLABS_API_KEY is not configured",
            status_code=HTTPStatus.INTERNAL_SERVER_ERROR,
        )
    from elevenlabs import ElevenLabs  # local import to avoid circular issues

    return ElevenLabs(
        api_key=api_key,
        base_url=base_url,
    )


def _resolve_agent_id(requested_id: Optional[str]) -> str:
    if not requested_id:
        raise ElevenLabsError(
            "No agent_id provided and ELEVENLABS_AGENT_ID is not configured",
            status_code=HTTPStatus.BAD_REQUEST,
        )
    return requested_id


async def create_conversation_token(agent_id: str | None = None) -> dict[str, Any]:
    settings = get_settings()
    resolved_agent_id = _resolve_agent_id(agent_id or settings.elevenlabs_agent_id)

    client = _build_client(settings.elevenlabs_api_key, settings.elevenlabs_base_url)

    try:
        result = await asyncio.to_thread(
            client.conversational_ai.conversations.get_webrtc_token,
            agent_id=resolved_agent_id,
        )
    except Exception as exc:  # noqa: BLE001
        raise ElevenLabsError(str(exc)) from exc

    payload = result.model_dump() if hasattr(result, "model_dump") else result
    if isinstance(payload, dict):
        payload.setdefault("agent_id", resolved_agent_id)
        return payload

    raise ElevenLabsError(f"Unexpected ElevenLabs response: {type(result)!r}")


__all__ = [
    "ElevenLabsError",
    "create_conversation_token",
]
