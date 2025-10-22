## Voice Test Deployment

This repository hosts the FastAPI backend (`backend/`) and the Vite/React frontend (`frontend/`).

- Run `npm run build` from `frontend/` to produce a production bundle at `backend/app/static`. The backend serves this directory when it exists.
- The repository ships with `railway.toml`, which configures Railway/Nixpacks to build the frontend, install Python dependencies (in editable mode so the freshly built assets remain available), and launch Uvicorn.

### Deploying to Railway

1. Install the Railway CLI and log in: `npm i -g @railway/cli && railway login`.
2. From the repository root run `railway up` (initial provisioning) or `railway deploy` (subsequent deploys). Railway consumes `railway.toml` for the build and start commands.
3. Ensure the required ElevenLabs/OpenAI environment variables listed in `backend/README.md` are set in your Railway project before promoting a deployment.

During deployment the build pipeline executes:

```bash
npm ci --prefix frontend
npm run build --prefix frontend   # emits assets to backend/app/static
pip install -e ./backend
```

The service starts with:

```bash
cd backend && uvicorn app:app --host 0.0.0.0 --port ${PORT:-8000}
```

Any subsequent `npm run build` regenerates the static assets consumed by the backend.
