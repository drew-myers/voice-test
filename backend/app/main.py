from . import app as app


@app.get("/", tags=["root"])
async def root() -> dict[str, str]:
    return {"message": "Voice test backend is running"}


def run_dev() -> None:
    """Start uvicorn with auto-reload for local development."""
    import uvicorn

    uvicorn.run(
        "app:app",
        host="127.0.0.1",
        port=8000,
        reload=True,
        reload_dirs=["."],
        factory=False,
    )


__all__ = ["app", "run_dev"]
