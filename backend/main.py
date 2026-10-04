"""
FastAPI application entry point.

Wires together configuration, middleware, routers, static file serving for
processed images, and startup/shutdown lifecycle hooks for the PostgreSQL
and Neo4j connections.
"""

from contextlib import asynccontextmanager

# torch must be imported before paddleocr anywhere in this process: on Windows,
# loading paddlepaddle's bundled OpenMP/MKL DLLs first shadows the symbols
# torch's shm.dll expects, causing a WinError 127 at torch import time.
import torch  # noqa: F401,E402

from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles

from api.middleware.cors import configure_cors
from api.middleware.error_handler import configure_error_handlers
from api.routes import documents, query, websocket
from config import get_settings
from db import postgres
from graph import neo4j_client
from utils.logger import logger

settings = get_settings()


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Manage application startup and shutdown: open and close external connections."""
    logger.info(f"Starting {settings.app_name} in {settings.app_env} mode")
    settings.ensure_storage_dirs()
    await postgres.connect()
    try:
        await neo4j_client.connect()
    except Exception as exc:
        logger.warning(f"Neo4j connection unavailable at startup: {exc}")

    yield

    await postgres.disconnect()
    try:
        await neo4j_client.disconnect()
    except Exception:
        pass
    logger.info(f"{settings.app_name} shutdown complete")


settings.ensure_storage_dirs()

app = FastAPI(
    title="DocuMind API",
    description="Agentic Multimodal Document Intelligence System",
    version="0.1.0",
    lifespan=lifespan,
)

configure_cors(app)
configure_error_handlers(app)

app.include_router(documents.router, prefix=settings.api_v1_prefix)
app.include_router(query.router, prefix=settings.api_v1_prefix)
app.include_router(websocket.router)

app.mount("/static", StaticFiles(directory=settings.storage_root), name="static")


@app.get("/health", tags=["health"])
async def health_check() -> dict[str, str]:
    """Basic liveness check used by Docker Compose health checks."""
    return {"status": "ok", "service": settings.app_name}
