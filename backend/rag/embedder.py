"""
Text embedding via BAAI/bge-small-en-v1.5.

Loads the sentence-transformers embedding model once and caches it for the
process lifetime (model loading is expensive), exposing a simple batch
embedding function used by both the indexing path (rag_agent) and the query
path (hybrid_retrieval).
"""

from functools import lru_cache

import numpy as np

from config import get_settings
from utils.logger import logger

settings = get_settings()

# BGE models are trained with an instruction prefix for queries (not for
# passages) to improve retrieval quality asymmetrically.
_QUERY_INSTRUCTION = "Represent this sentence for searching relevant passages: "


@lru_cache
def _get_model():
    """Lazily construct and cache the sentence-transformers embedding model."""
    from sentence_transformers import SentenceTransformer

    logger.info(f"Loading embedding model {settings.embedding_model_name}")
    return SentenceTransformer(settings.embedding_model_name)


def embed_passages(texts: list[str]) -> list[list[float]]:
    """Embed a batch of document passages/chunks."""
    if not texts:
        return []
    model = _get_model()
    vectors: np.ndarray = model.encode(texts, normalize_embeddings=True, show_progress_bar=False)
    return vectors.tolist()


def embed_query(query: str) -> list[float]:
    """Embed a single user query, applying the BGE query instruction prefix."""
    model = _get_model()
    vector: np.ndarray = model.encode(
        _QUERY_INSTRUCTION + query, normalize_embeddings=True, show_progress_bar=False
    )
    return vector.tolist()
