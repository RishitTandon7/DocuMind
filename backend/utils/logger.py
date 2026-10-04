"""
Centralized structured logging configuration using loguru.

All modules in the backend import `logger` from here instead of configuring
their own logging, guaranteeing consistent formatting and log levels across
the application.
"""

import sys

from loguru import logger

from config import get_settings

_settings = get_settings()

logger.remove()
logger.add(
    sys.stdout,
    level=_settings.log_level,
    format=(
        "<green>{time:YYYY-MM-DD HH:mm:ss.SSS}</green> | "
        "<level>{level: <8}</level> | "
        "<cyan>{name}</cyan>:<cyan>{function}</cyan>:<cyan>{line}</cyan> - "
        "<level>{message}</level>"
    ),
    colorize=True,
    backtrace=True,
    diagnose=_settings.debug,
)
logger.add(
    "storage/logs/documind_{time:YYYY-MM-DD}.log",
    level=_settings.log_level,
    rotation="00:00",
    retention="14 days",
    format="{time:YYYY-MM-DD HH:mm:ss.SSS} | {level: <8} | {name}:{function}:{line} - {message}",
    encoding="utf-8",
)

__all__ = ["logger"]
