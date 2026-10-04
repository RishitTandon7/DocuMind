"""
OCR Agent.

Runs PaddleOCR over the DIP-restored image and persists the extracted text,
confidence, and word count into `ocr_results`.
"""

import asyncio

import numpy as np

from db import postgres as db
from ocr.paddle_ocr import OCRResult, extract_text
from utils.logger import logger


async def run_ocr_agent(document_id: str, processed_image: np.ndarray) -> OCRResult:
    """Extract text from the restored document image and persist the OCR result."""
    logger.info(f"[ocr_agent] Running OCR for document {document_id}")
    result = await asyncio.to_thread(extract_text, processed_image)

    await db.insert_ocr_result(
        document_id=document_id,
        raw_text=result.raw_text,
        confidence=result.average_confidence,
        word_count=result.word_count,
    )
    logger.info(
        f"[ocr_agent] Extracted {result.word_count} words, confidence={result.average_confidence:.3f} "
        f"for document {document_id}"
    )
    return result


async def run_ocr_agent_pages(document_id: str, page_images: list[np.ndarray]) -> OCRResult:
    """OCR every page, join the text in page order, and persist one combined OCR result."""
    logger.info(f"[ocr_agent] Running OCR for document {document_id} ({len(page_images)} page(s))")
    page_results = [await asyncio.to_thread(extract_text, image) for image in page_images]

    texts = [result.raw_text for result in page_results if result.raw_text.strip()]
    total_words = sum(result.word_count for result in page_results)
    weighted_confidence = (
        sum(result.average_confidence * result.word_count for result in page_results) / total_words
        if total_words
        else 0.0
    )
    combined = OCRResult(
        raw_text="\n\n".join(texts),
        words=[word for result in page_results for word in result.words],
        average_confidence=weighted_confidence,
        word_count=total_words,
    )
    await db.insert_ocr_result(
        document_id=document_id,
        raw_text=combined.raw_text,
        confidence=combined.average_confidence,
        word_count=combined.word_count,
    )
    logger.info(
        f"[ocr_agent] Extracted {combined.word_count} words across {len(page_images)} page(s), "
        f"confidence={combined.average_confidence:.3f} for document {document_id}"
    )
    return combined
