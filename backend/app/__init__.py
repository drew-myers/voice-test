from __future__ import annotations

import logging
from pathlib import Path

from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles

from .routes import elevenlabs

logger = logging.getLogger(__name__)
FRONTEND_DIST = Path(__file__).resolve().parent / "static"


def create_app() -> FastAPI:
    app = FastAPI(title="Voice Test API")

    @app.get("/health", tags=["health"])
    async def health() -> dict[str, str]:
        return {"status": "ok"}

    app.include_router(elevenlabs.router, prefix="/api")

    if FRONTEND_DIST.exists():
        app.mount("/", StaticFiles(directory=FRONTEND_DIST, html=True), name="frontend")
    else:
        logger.warning("Frontend build directory %s not found; serving JSON root response.", FRONTEND_DIST)

        @app.get("/", tags=["root"])
        async def root() -> dict[str, str]:
            return {"message": "Voice test backend is running"}

    return app


app = create_app()

__all__ = ["app", "create_app"]
