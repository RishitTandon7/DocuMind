"""
Cross-encoder reranking.

Vector similarity search (bi-encoder) is fast but scores query and passage
independently, missing fine-grained interactions between them. The
cross-encoder reranker jointly encodes each (query, passage) pair and
outputs a relevance score directly, which is far more accurate but too
slow to run over an entire corpus — so it is only applied to the top-k
candidates already retrieved by the vector search.
"""

from functools import lru_cache

from config import get_settings
from utils.logger import logger

settings = get_settings()


@lru_cache
def _get_reranker():
    from sentence_transformers import CrossEncoder

    logger.info(f"Loading reranker model {settings.reranker_model_name}")
    return CrossEncoder(settings.reranker_model_name)


def rerank(query: str, candidates: list[dict], top_k: int) -> list[dict]:
    """Rerank candidate chunks by cross-encoder relevance to the query and keep the top-k."""
    if not candidates:
        return []

    model = _get_reranker()
    pairs = [(query, candidate["text"]) for candidate in candidates]
    scores = model.predict(pairs)

    for candidate, score in zip(candidates, scores):
        candidate["rerank_score"] = float(score)

    reranked = sorted(candidates, key=lambda item: item["rerank_score"], reverse=True)
    logger.debug(f"Reranked {len(candidates)} candidates, keeping top {top_k}")
    return reranked[:top_k]
