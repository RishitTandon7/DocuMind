"""
PaddleOCR integration.

Wraps PaddleOCR's detection + recognition pipeline behind a small typed API
that returns full extracted text alongside per-word bounding boxes and
confidence scores, so the frontend can highlight exactly which words the
OCR engine was unsure about. The PaddleOCR engine instance is expensive to
construct (it loads detection + recognition + classification models), so it
is built once and cached for the lifetime of the process.
"""

from dataclasses import dataclass
from functools import lru_cache

import numpy as np

from config import get_settings
from utils.logger import logger

settings = get_settings()


@dataclass
class OCRWord:
    """A single recognized word/text-line with its bounding box and confidence."""

    text: str
    confidence: float
    bounding_box: list[list[float]]


@dataclass
class OCRResult:
    """Full OCR output for a single image: concatenated text plus per-word detail."""

    raw_text: str
    words: list[OCRWord]
    average_confidence: float
    word_count: int


class OCREngineError(Exception):
    """Raised when the PaddleOCR engine fails to initialize or process an image."""


@lru_cache
def _get_engine():
    """Lazily construct and cache the PaddleOCR engine (expensive model load)."""
    try:
        from paddleocr import PaddleOCR
    except ImportError as exc:
        logger.error("paddleocr is not installed")
        raise OCREngineError("PaddleOCR is not installed in this environment") from exc

    logger.info(f"Initializing PaddleOCR engine lang={settings.paddleocr_lang} use_gpu={settings.paddleocr_use_gpu}")
    return PaddleOCR(
        use_angle_cls=True,
        lang=settings.paddleocr_lang,
        use_gpu=settings.paddleocr_use_gpu,
        show_log=False,
    )


def extract_text(image: np.ndarray) -> OCRResult:
    """Run PaddleOCR detection + recognition over an image and return structured results."""
    engine = _get_engine()
    try:
        raw_output = engine.ocr(image, cls=True)
    except Exception as exc:  # PaddleOCR raises a variety of underlying errors
        logger.error(f"PaddleOCR inference failed: {exc}")
        raise OCREngineError(f"OCR inference failed: {exc}") from exc

    words: list[OCRWord] = []
    lines = raw_output[0] if raw_output and raw_output[0] is not None else []

    for detection in lines:
        box, (text, confidence) = detection
        words.append(OCRWord(text=text, confidence=float(confidence), bounding_box=box))

    raw_text = "\n".join(word.text for word in words)
    average_confidence = (
        sum(word.confidence for word in words) / len(words) if words else 0.0
    )

    logger.info(f"OCR extracted {len(words)} text lines, avg_confidence={average_confidence:.3f}")
    return OCRResult(
        raw_text=raw_text,
        words=words,
        average_confidence=average_confidence,
        word_count=len(words),
    )
