"""
Text chunking for RAG indexing.

Splits OCR'd document text into overlapping word-based windows sized by
`chunk_size`/`chunk_overlap` from settings. Overlap preserves context across
chunk boundaries so an answer-relevant sentence split across two chunks is
still retrievable from either one.
"""

from dataclasses import dataclass

from config import get_settings
from utils.logger import logger

settings = get_settings()


@dataclass
class TextChunk:
    """A single chunk of document text ready for embedding."""

    chunk_id: str
    text: str
    chunk_index: int


def chunk_text(document_id: str, text: str) -> list[TextChunk]:
    """Split text into overlapping chunks of approximately `chunk_size` words."""
    words = text.split()
    if not words:
        return []

    chunk_size = settings.chunk_size
    overlap = settings.chunk_overlap
    step = max(chunk_size - overlap, 1)

    chunks: list[TextChunk] = []
    index = 0
    for start in range(0, len(words), step):
        window = words[start : start + chunk_size]
        if not window:
            break
        chunk_text_value = " ".join(window)
        chunks.append(
            TextChunk(chunk_id=f"{document_id}_chunk_{index}", text=chunk_text_value, chunk_index=index)
        )
        index += 1
        if start + chunk_size >= len(words):
            break

    logger.info(f"Split document {document_id} into {len(chunks)} chunks")
    return chunks
