"""
Document Understanding Agent.

Uses the configured multimodal LLM (Gemini or a local Ollama vision model)
to read the restored document image together with its OCR'd text and
produce a concise semantic summary. This summary augments the raw OCR text
before it is handed to the Knowledge Graph and RAG agents, giving
downstream steps richer context than raw OCR alone (e.g. document type,
key topics).
"""

from dataclasses import dataclass

import numpy as np

from agents.llm_client import LLMError, generate
from utils.logger import logger

_UNDERSTANDING_PROMPT = """You are a document understanding engine. Given this document image and its \
OCR-extracted text, produce a concise semantic summary (3-6 sentences) covering: the document type, \
its purpose, and its most important facts. Do not repeat the raw text verbatim.

OCR text:
---
{ocr_text}
---
"""


@dataclass
class DocumentUnderstanding:
    """Semantic summary produced by the multimodal LLM for a document."""

    summary: str


def understand_document(processed_image: np.ndarray, ocr_text: str) -> DocumentUnderstanding:
    """Ask the multimodal LLM to summarize the document from its image and OCR text."""
    prompt = _UNDERSTANDING_PROMPT.format(ocr_text=ocr_text[:8000] or "(no text extracted)")

    try:
        summary = generate(prompt, image=processed_image, temperature=0.2).strip()
    except LLMError as exc:
        logger.error(f"Document understanding failed: {exc}")
        summary = ""

    logger.info(f"Document understanding summary length={len(summary)} chars")
    return DocumentUnderstanding(summary=summary)
