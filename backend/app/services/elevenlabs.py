from __future__ import annotations

import asyncio
import base64
import binascii
from http import HTTPStatus
from functools import lru_cache
from typing import Any, Optional

import httpx

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


async def _request_json(
    method: str,
    path: str,
    *,
    api_key: str | None,
    base_url: str,
    json: Optional[dict[str, Any]] = None,
) -> dict[str, Any]:
    if not api_key:
        raise ElevenLabsError(
            "ELEVENLABS_API_KEY is not configured",
            status_code=HTTPStatus.INTERNAL_SERVER_ERROR,
        )

    headers = {"xi-api-key": api_key}
    if json is not None:
        headers["Content-Type"] = "application/json"

    try:
        async with httpx.AsyncClient(base_url=base_url, timeout=10.0) as client:
            response = await client.request(method, path, json=json, headers=headers)
    except httpx.RequestError as exc:  # pragma: no cover - network failure
        raise ElevenLabsError(
            f"Failed to reach ElevenLabs API: {exc}",
            status_code=HTTPStatus.BAD_GATEWAY,
        ) from exc

    if response.status_code >= 400:
        try:
            detail: Any = response.json()
        except ValueError:
            detail = response.text
        raise ElevenLabsError(
            f"ElevenLabs API error ({response.status_code}): {detail}",
            status_code=response.status_code,
        )

    try:
        return response.json()
    except ValueError as exc:
        raise ElevenLabsError(
            "Invalid JSON response from ElevenLabs API",
            status_code=HTTPStatus.BAD_GATEWAY,
        ) from exc


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


async def get_prompt(agent_id: str | None = None) -> dict[str, Optional[str]]:
    settings = get_settings()
    resolved_agent_id = _resolve_agent_id(agent_id or settings.elevenlabs_agent_id)
    agent = await _request_json(
        "GET",
        f"/v1/convai/agents/{resolved_agent_id}",
        api_key=settings.elevenlabs_api_key,
        base_url=settings.elevenlabs_base_url,
    )

    prompt = (
        agent.get("conversation_config", {})
        .get("agent", {})
        .get("prompt", {})
        .get("prompt")
        if isinstance(agent, dict)
        else None
    )
    first_message = (
        agent.get("conversation_config", {})
        .get("agent", {})
        .get("first_message")
        if isinstance(agent, dict)
        else None
    )

    return {
        "agent_id": resolved_agent_id,
        "prompt": prompt,
        "first_message": first_message,
    }


async def update_prompt(
    *,
    prompt: str,
    agent_id: str | None = None,
    first_message: str | None = None,
) -> dict[str, Any]:
    if not prompt.strip():
        raise ElevenLabsError(
            "Prompt cannot be empty",
            status_code=HTTPStatus.BAD_REQUEST,
    )

    settings = get_settings()
    resolved_agent_id = _resolve_agent_id(agent_id or settings.elevenlabs_agent_id)
    agent = await _request_json(
        "GET",
        f"/v1/convai/agents/{resolved_agent_id}",
        api_key=settings.elevenlabs_api_key,
        base_url=settings.elevenlabs_base_url,
    )

    conversation_config = (
        agent.get("conversation_config") if isinstance(agent, dict) else None
    )
    if not isinstance(conversation_config, dict):
        conversation_config = {}

    agent_config = conversation_config.get("agent")
    if not isinstance(agent_config, dict):
        agent_config = {}

    prompt_config = agent_config.get("prompt")
    if not isinstance(prompt_config, dict):
        prompt_config = {}

    prompt_config = {**prompt_config, "prompt": prompt}
    agent_config["prompt"] = prompt_config
    if first_message is not None:
        agent_config["first_message"] = first_message
    conversation_config["agent"] = agent_config

    updated_agent = await _request_json(
        "PATCH",
        f"/v1/convai/agents/{resolved_agent_id}",
        api_key=settings.elevenlabs_api_key,
        base_url=settings.elevenlabs_base_url,
        json={"conversation_config": conversation_config},
    )

    return updated_agent


async def suggest_prompt(
    *,
    feedback: str,
    agent_id: str | None = None,
) -> dict[str, str]:
    if not feedback.strip():
        raise ElevenLabsError(
            "Feedback cannot be empty",
            status_code=HTTPStatus.BAD_REQUEST,
        )

    settings = get_settings()
    current = await get_prompt(agent_id=agent_id)
    current_prompt = current.get("prompt") or ""

    if not settings.openai_api_key:
        raise ElevenLabsError(
            "OPENAI_API_KEY is not configured",
            status_code=HTTPStatus.INTERNAL_SERVER_ERROR,
        )

    system_prompt = (
        "You assist with refining voice agent system prompts. "
        "Given the existing prompt and developer feedback, propose an improved prompt that "
        "addresses the feedback while preserving helpful instructions. Return only the full prompt text."
    )

    user_prompt = (
        "Current prompt:\n" f"""```\n{current_prompt}\n```""" "\n\n"
        "Developer feedback:\n"
        f"""```\n{feedback}\n```""" "\n\n"
        "Provide the revised prompt that incorporates the feedback."
    )

    payload = {
        "model": settings.openai_model,
        "messages": [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt},
        ],
        "temperature": 0.2,
    }

    try:
        async with httpx.AsyncClient(timeout=20.0) as client:
            response = await client.post(
                "https://api.openai.com/v1/chat/completions",
                json=payload,
                headers={
                    "Authorization": f"Bearer {settings.openai_api_key}",
                    "Content-Type": "application/json",
                },
            )
    except httpx.RequestError as exc:  # pragma: no cover - network failure
        raise ElevenLabsError(
            f"Failed to reach OpenAI API: {exc}",
            status_code=HTTPStatus.BAD_GATEWAY,
        ) from exc

    if response.status_code >= 400:
        detail = response.text
        try:
            detail = response.json()
        except ValueError:
            pass
        raise ElevenLabsError(
            f"OpenAI API error ({response.status_code}): {detail}",
            status_code=response.status_code,
        )

    data = response.json()
    try:
        suggested_prompt = data["choices"][0]["message"]["content"].strip()
    except (KeyError, IndexError, TypeError):
        raise ElevenLabsError(
            "Unexpected response from OpenAI API",
            status_code=HTTPStatus.BAD_GATEWAY,
        )

    resolved_agent_id = current.get("agent_id") or _resolve_agent_id(
        agent_id or settings.elevenlabs_agent_id
    )

    return {
        "agent_id": resolved_agent_id,
        "current_prompt": current_prompt,
        "suggested_prompt": suggested_prompt,
    }


async def transcribe_audio(
    *,
    audio_base64: str,
    fmt: str = "webm",
    language_code: str | None = None,
    model_id: str | None = None,
) -> dict[str, str]:
    settings = get_settings()

    try:
        audio_bytes = base64.b64decode(audio_base64, validate=True)
    except (ValueError, binascii.Error) as exc:  # type: ignore[name-defined]
        raise ElevenLabsError(
            "Invalid audio payload",
            status_code=HTTPStatus.BAD_REQUEST,
        ) from exc

    if not audio_bytes:
        raise ElevenLabsError(
            "Audio payload is empty",
            status_code=HTTPStatus.BAD_REQUEST,
        )

    filename = f"feedback.{fmt}"
    mime_type = f"audio/{fmt}"

    client = _build_client(settings.elevenlabs_api_key, settings.elevenlabs_base_url)

    kwargs: dict[str, Any] = {
        "model_id": model_id or settings.elevenlabs_stt_model,
        "file": (filename, audio_bytes, mime_type),
    }
    if language_code:
        kwargs["language_code"] = language_code

    try:
        response = await asyncio.to_thread(
            client.speech_to_text.convert,
            **kwargs,
        )
    except Exception as exc:  # noqa: BLE001
        raise ElevenLabsError(str(exc)) from exc

    text: Optional[str] = None
    if hasattr(response, "text"):
        text = getattr(response, "text")
    elif hasattr(response, "model_dump"):
        data = response.model_dump()  # type: ignore[attr-defined]
        text = data.get("text") or data.get("transcription")
    elif isinstance(response, dict):
        text = response.get("text") or response.get("transcription")
    else:
        text = str(response)

    if not text or not text.strip():
        raise ElevenLabsError(
            "Speech-to-text transcription returned no text",
            status_code=HTTPStatus.BAD_GATEWAY,
        )

    return {"text": text.strip()}


__all__ = [
    "ElevenLabsError",
    "create_conversation_token",
    "get_prompt",
    "update_prompt",
    "suggest_prompt",
    "transcribe_audio",
]
