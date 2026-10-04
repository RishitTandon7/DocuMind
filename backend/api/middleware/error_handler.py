"""
Centralized exception handling.

Maps every exception type raised anywhere in the backend to a consistent
JSON error envelope (`ErrorResponse`) and the correct HTTP status code, and
logs the failure with full context before responding.
"""

from fastapi import FastAPI, Request, status
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse

from ocr.paddle_ocr import OCREngineError
from utils.file_utils import FileTooLargeError, UnsupportedFileTypeError
from utils.logger import logger


def _error_response(status_code: int, detail: str, error_type: str) -> JSONResponse:
    return JSONResponse(
        status_code=status_code,
        content={"detail": detail, "error_type": error_type},
    )


def configure_error_handlers(app: FastAPI) -> None:
    """Register exception handlers covering validation, domain, and unexpected errors."""

    @app.exception_handler(RequestValidationError)
    async def validation_exception_handler(request: Request, exc: RequestValidationError) -> JSONResponse:
        logger.warning(f"Validation error on {request.url.path}: {exc.errors()}")
        return _error_response(
            status.HTTP_422_UNPROCESSABLE_ENTITY, str(exc.errors()), "validation_error"
        )

    @app.exception_handler(UnsupportedFileTypeError)
    async def unsupported_file_type_handler(request: Request, exc: UnsupportedFileTypeError) -> JSONResponse:
        logger.warning(f"Unsupported file type on {request.url.path}: {exc}")
        return _error_response(status.HTTP_415_UNSUPPORTED_MEDIA_TYPE, str(exc), "unsupported_file_type")

    @app.exception_handler(FileTooLargeError)
    async def file_too_large_handler(request: Request, exc: FileTooLargeError) -> JSONResponse:
        logger.warning(f"File too large on {request.url.path}: {exc}")
        return _error_response(status.HTTP_413_REQUEST_ENTITY_TOO_LARGE, str(exc), "file_too_large")

    @app.exception_handler(FileNotFoundError)
    async def file_not_found_handler(request: Request, exc: FileNotFoundError) -> JSONResponse:
        logger.warning(f"Not found on {request.url.path}: {exc}")
        return _error_response(status.HTTP_404_NOT_FOUND, str(exc), "not_found")

    @app.exception_handler(OCREngineError)
    async def ocr_engine_error_handler(request: Request, exc: OCREngineError) -> JSONResponse:
        logger.error(f"OCR engine error on {request.url.path}: {exc}")
        return _error_response(status.HTTP_502_BAD_GATEWAY, str(exc), "ocr_engine_error")

    @app.exception_handler(Exception)
    async def unhandled_exception_handler(request: Request, exc: Exception) -> JSONResponse:
        logger.exception(f"Unhandled exception on {request.url.path}: {exc}")
        return _error_response(
            status.HTTP_500_INTERNAL_SERVER_ERROR, "An unexpected error occurred", "internal_error"
        )
