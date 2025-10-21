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

## API

- `POST /api/elevenlabs/conversation-token`
  - Body: `{ "agent_id": "optional override" }`
  - Returns the payload from the ElevenLabs SDK (`conversationId`, `token`, etc.).
