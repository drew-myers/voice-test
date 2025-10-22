from . import app as app


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
