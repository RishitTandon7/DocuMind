"""
Shared low-level image I/O and conversion helpers used across the DIP
pipeline, OCR module, and API layer.
"""

from pathlib import Path

import cv2
import numpy as np

from utils.logger import logger


def load_image(path: str | Path) -> np.ndarray:
    """Load an image from disk as a BGR NumPy array."""
    path = Path(path)
    image = cv2.imread(str(path), cv2.IMREAD_COLOR)
    if image is None:
        logger.error(f"Failed to load image from {path}")
        raise FileNotFoundError(f"Could not read image at {path}")
    return image


def save_image(image: np.ndarray, path: str | Path) -> Path:
    """Save a NumPy array image to disk, creating parent directories as needed."""
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    success = cv2.imwrite(str(path), image)
    if not success:
        logger.error(f"Failed to write image to {path}")
        raise IOError(f"Could not write image to {path}")
    return path


def to_grayscale(image: np.ndarray) -> np.ndarray:
    """Convert a BGR or already-grayscale image to single-channel grayscale."""
    if image.ndim == 2:
        return image
    return cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)


def to_bgr(image: np.ndarray) -> np.ndarray:
    """Convert a single-channel grayscale image to 3-channel BGR for display/storage."""
    if image.ndim == 3:
        return image
    return cv2.cvtColor(image, cv2.COLOR_GRAY2BGR)


def ensure_uint8(image: np.ndarray) -> np.ndarray:
    """Clip and cast an arbitrary-dtype image array to uint8 for saving/display."""
    return np.clip(image, 0, 255).astype(np.uint8)


def pdf_page_to_image(pdf_path: str | Path, page_number: int = 0, dpi: int = 300) -> np.ndarray:
    """Render a single page of a PDF file to a BGR NumPy array using PyMuPDF."""
    import fitz  # PyMuPDF

    doc = fitz.open(str(pdf_path))
    try:
        if page_number >= doc.page_count:
            raise IndexError(f"PDF has {doc.page_count} pages, requested page {page_number}")
        page = doc.load_page(page_number)
        zoom = dpi / 72.0
        matrix = fitz.Matrix(zoom, zoom)
        pixmap = page.get_pixmap(matrix=matrix, colorspace=fitz.csRGB)
        array = np.frombuffer(pixmap.samples, dtype=np.uint8).reshape(
            pixmap.height, pixmap.width, pixmap.n
        )
        return cv2.cvtColor(array, cv2.COLOR_RGB2BGR)
    finally:
        doc.close()


def pdf_page_count(pdf_path: str | Path) -> int:
    """Return the number of pages in a PDF file."""
    import fitz  # PyMuPDF

    doc = fitz.open(str(pdf_path))
    try:
        return doc.page_count
    finally:
        doc.close()
