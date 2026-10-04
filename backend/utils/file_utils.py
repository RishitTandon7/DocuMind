"""
Filesystem helper utilities for validating, persisting, and naming uploaded
and processed document files.
"""

import uuid
from pathlib import Path

from fastapi import UploadFile

from config import get_settings
from utils.logger import logger

settings = get_settings()


class UnsupportedFileTypeError(Exception):
    """Raised when an uploaded file's extension is not in the allow-list."""


class FileTooLargeError(Exception):
    """Raised when an uploaded file exceeds the configured maximum size."""


def validate_upload_extension(filename: str) -> str:
    """Validate that the filename has an allowed extension and return it lowercased."""
    extension = Path(filename).suffix.lower()
    if extension not in settings.allowed_upload_extensions_list:
        logger.warning(f"Rejected upload with unsupported extension: {extension}")
        raise UnsupportedFileTypeError(
            f"File extension '{extension}' is not supported. "
            f"Allowed: {', '.join(settings.allowed_upload_extensions_list)}"
        )
    return extension


def generate_document_id() -> str:
    """Generate a new unique document identifier."""
    return str(uuid.uuid4())


async def persist_upload(upload_file: UploadFile, document_id: str, tag: str | None = None) -> Path:
    """Stream an UploadFile to disk under the upload directory and return its path.

    `tag` names the file `<id>_<tag>.<ext>` so several files can belong to one document.
    """
    extension = validate_upload_extension(upload_file.filename or "")
    settings.ensure_storage_dirs()
    suffix = "" if tag is None else f"_{tag}"
    destination = Path(settings.upload_dir) / f"{document_id}{suffix}{extension}"

    max_bytes = settings.max_upload_size_mb * 1024 * 1024
    total_bytes = 0

    try:
        with destination.open("wb") as buffer:
            while chunk := await upload_file.read(1024 * 1024):
                total_bytes += len(chunk)
                if total_bytes > max_bytes:
                    buffer.close()
                    destination.unlink(missing_ok=True)
                    raise FileTooLargeError(
                        f"File exceeds maximum allowed size of {settings.max_upload_size_mb}MB"
                    )
                buffer.write(chunk)
    finally:
        await upload_file.close()

    logger.info(f"Persisted upload for document {document_id} to {destination} ({total_bytes} bytes)")
    return destination


def processed_image_path(document_id: str, operation_name: str, suffix: str = ".png") -> Path:
    """Build the on-disk path for a DIP-processed intermediate image."""
    settings.ensure_storage_dirs()
    directory = Path(settings.processed_dir) / document_id
    directory.mkdir(parents=True, exist_ok=True)
    return directory / f"{operation_name}{suffix}"


def page_upload_path(document_id: str, page_index: int, extension: str = ".png") -> Path:
    """Build the on-disk path for a page image derived from an upload (e.g. a rendered PDF page)."""
    settings.ensure_storage_dirs()
    return Path(settings.upload_dir) / f"{document_id}_p{page_index}{extension}"
