"""FastAPI app entrypoint for the scientific-discovery sidecar.

Wires up routes, CORS, and the healthcheck. The actual causal-inference
work happens in `app/services/dowhy_engine.py` and
`app/services/pcmciplus_engine.py`.

Run locally:

    uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload

Or:

    python -m app.main
"""

from __future__ import annotations

import logging
from contextlib import asynccontextmanager
from typing import AsyncIterator

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app import __service__, __version__
from app.routes import dowhy_refute, health, pcmciplus
from app.settings import Settings, load_settings


def _configure_logging(level: str) -> None:
    """Configure root logger once at startup."""
    logging.basicConfig(
        level=getattr(logging, level.upper(), logging.INFO),
        format="%(asctime)s %(levelname)s [%(name)s] %(message)s",
    )


@asynccontextmanager
async def _lifespan(app: FastAPI) -> AsyncIterator[None]:
    """Run startup / shutdown hooks. We pre-warm imports here so the
    first real request doesn't pay the DoWhy / Tigramite import tax."""
    logger = logging.getLogger("scientific-discovery-sidecar.lifespan")
    logger.info("Sidecar %s starting up.", __version__)
    # Pre-warm heavy imports — best-effort, swallow failure so the
    # service can still report degraded health via /health.
    try:
        import dowhy  # noqa: F401
        app.state.dowhy_loaded = True
    except Exception as exc:  # noqa: BLE001 — boundary point
        logger.warning("DoWhy pre-warm failed: %s", exc)
        app.state.dowhy_loaded = False
    try:
        import tigramite  # noqa: F401
        app.state.tigramite_loaded = True
    except Exception as exc:  # noqa: BLE001 — boundary point
        logger.warning("Tigramite pre-warm failed: %s", exc)
        app.state.tigramite_loaded = False
    yield
    logger.info("Sidecar %s shutting down.", __version__)


def create_app(settings: Settings | None = None) -> FastAPI:
    """App factory — exposed so tests can pass their own settings."""
    cfg = settings or load_settings()
    _configure_logging(cfg.log_level)

    app = FastAPI(
        title=__service__,
        version=__version__,
        description="Causal-inference sidecar for @bossnyumba/scientific-discovery.",
        lifespan=_lifespan,
    )
    app.state.settings = cfg

    if cfg.cors_allow_origins:
        app.add_middleware(
            CORSMiddleware,
            allow_origins=list(cfg.cors_allow_origins),
            allow_credentials=False,
            allow_methods=["GET", "POST"],
            allow_headers=["content-type"],
        )

    app.include_router(health.router)
    app.include_router(dowhy_refute.router)
    app.include_router(pcmciplus.router)

    return app


app = create_app()


def run() -> None:
    """`scientific-discovery-sidecar` console-script entrypoint."""
    import uvicorn

    cfg = load_settings()
    uvicorn.run(
        "app.main:app",
        host=cfg.host,
        port=cfg.port,
        log_level=cfg.log_level.lower(),
        reload=False,
    )


if __name__ == "__main__":
    run()
