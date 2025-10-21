from dataclasses import dataclass
import os
from functools import lru_cache


@dataclass
class Settings:
    elevenlabs_api_key: str | None
    elevenlabs_agent_id: str | None
    elevenlabs_base_url: str
    openai_api_key: str | None
    openai_model: str
    elevenlabs_stt_model: str

    @property
    def has_elevenlabs_credentials(self) -> bool:
        return bool(self.elevenlabs_api_key)


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    return Settings(
        elevenlabs_api_key=os.getenv("ELEVENLABS_API_KEY"),
        elevenlabs_agent_id=os.getenv("ELEVENLABS_AGENT_ID"),
        elevenlabs_base_url=os.getenv(
            "ELEVENLABS_BASE_URL", "https://api.elevenlabs.io"
        ),
        openai_api_key=os.getenv("OPENAI_API_KEY"),
        openai_model=os.getenv("OPENAI_MODEL", "gpt-4o-mini"),
        elevenlabs_stt_model=os.getenv(
            "ELEVENLABS_STT_MODEL", "scribe_v1"
        ),
    )


__all__ = ["Settings", "get_settings"]
