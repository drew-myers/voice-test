from fastapi import FastAPI

from .routes import elevenlabs


def create_app() -> FastAPI:
    app = FastAPI(title="Voice Test API")

    @app.get("/health", tags=["health"])
    async def health() -> dict[str, str]:
        return {"status": "ok"}

    app.include_router(elevenlabs.router, prefix="/api")

    return app


app = create_app()

__all__ = ["app", "create_app"]
