"""CORS middleware configuration, sourced entirely from application settings."""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from config import get_settings


def configure_cors(app: FastAPI) -> None:
    """Attach the CORS middleware to the FastAPI app using configured allowed origins."""
    settings = get_settings()
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins_list,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )
