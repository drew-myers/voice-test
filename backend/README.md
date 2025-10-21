# Voice Test Backend

FastAPI backend to pair with the Vite/React frontend.

## Local dev

- Run these from the repository root:  
  - `uv sync --project backend` to install dependencies.  
  - `uv run --project backend dev` to launch the reload-enabled server on http://127.0.0.1:8000.
- If you're already inside `backend/`, drop the `--project backend` flag (or use `--project .`).
- If `uv run ... dev` reports “Failed to spawn: `dev`”, re-run `uv sync` so the entrypoint gets installed.
- Re-sync after pulling new dependencies (e.g., ElevenLabs SDK updates).

## Configuration

Set these environment variables before launching the backend when you need ElevenLabs integration:

- `ELEVENLABS_API_KEY` – required API key used to authorize requests.
- `ELEVENLABS_AGENT_ID` – default agent to use when the client does not supply one.
- `ELEVENLABS_BASE_URL` – optional; defaults to `https://api.elevenlabs.io`.
- `OPENAI_API_KEY` – required for prompt suggestions.
- `OPENAI_MODEL` – optional; defaults to `gpt-4o-mini`.
- `ELEVENLABS_STT_MODEL` – optional; defaults to `scribe_v1` for speech-to-text.

## API

- `POST /api/elevenlabs/conversation-token`
  - Body: `{ "agent_id": "optional override" }`
  - Returns the payload from the ElevenLabs SDK (`conversationId`, `token`, etc.).
- `GET /api/elevenlabs/prompt`
  - Query params: `agent_id` (optional override).
  - Returns `{ "agent_id": "...", "prompt": "..." }`.
- `PUT /api/elevenlabs/prompt`
  - Body: `{ "prompt": "updated prompt", "agent_id": "optional override" }`
  - Persists the prompt to ElevenLabs and returns the updated prompt payload.
- `POST /api/elevenlabs/prompt/suggest`
  - Body: `{ "feedback": "developer notes", "agent_id": "optional override" }`
  - Returns `{ "agent_id": "...", "current_prompt": "...", "suggested_prompt": "..." }` from the LLM-driven suggestion.
- `POST /api/elevenlabs/transcribe`
  - Body: `{ "audio": "<base64>", "format": "webm" }`
  - Returns `{ "text": "transcribed feedback" }` using ElevenLabs speech-to-text.
