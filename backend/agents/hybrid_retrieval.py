"""
Hybrid Graph + Vector Retrieval Agent.

Combines two complementary retrieval signals for a user query:
1. Vector similarity search over ChromaDB — finds text chunks that are
   semantically close to the query, good at recall over phrasing variation.
2. Knowledge Graph traversal over Neo4j — finds entities related to terms
   mentioned in the query and pulls in chunks/context tied to those
   entities, good at precise multi-hop factual grounding vector search
   alone would miss (e.g. "who approved the invoice that references
   contract X").

Vector candidates are reranked with the cross-encoder; graph hits are
appended as additional high-trust sources since they come from explicit
extracted relationships rather than approximate similarity.
"""

from dataclasses import dataclass, field

from config import get_settings
from graph.neo4j_client import find_related_entities
from rag.chroma_client import query_similar
from rag.embedder import embed_query
from rag.reranker import rerank
from utils.logger import logger

settings = get_settings()


@dataclass
class RetrievedSource:
    """A single piece of retrieved context backing an answer."""

    content: str
    score: float
    source_type: str
    metadata: dict = field(default_factory=dict)


def _extract_candidate_terms(question: str) -> list[str]:
    """Extract capitalized-looking / significant terms from the question for graph lookup."""
    words = [word.strip(".,?!:;\"'()") for word in question.split()]
    return [word for word in words if len(word) > 2]


async def hybrid_retrieve(question: str, document_id: str | None) -> list[RetrievedSource]:
    """Retrieve and merge vector + graph context for a question."""
    logger.info(f"Running hybrid retrieval for question scoped to document={document_id}")

    query_embedding = embed_query(question)
    vector_candidates = query_similar(
        query_embedding=query_embedding, document_id=document_id, top_k=settings.retrieval_top_k
    )
    reranked = rerank(question, vector_candidates, top_k=settings.rerank_top_k)

    sources = [
        RetrievedSource(
            content=candidate["text"],
            score=candidate.get("rerank_score", candidate.get("similarity", 0.0)),
            source_type="vector",
            metadata=candidate.get("metadata", {}),
        )
        for candidate in reranked
    ]

    if document_id:
        try:
            candidate_terms = _extract_candidate_terms(question)
            related_entities = await find_related_entities(document_id, candidate_terms, hops=1)
            for entity in related_entities[:5]:
                sources.append(
                    RetrievedSource(
                        content=f"{entity['label']} ({entity['type']})",
                        score=0.75,
                        source_type="graph",
                        metadata={"entity_id": entity["id"], "entity_type": entity["type"]},
                    )
                )
        except Exception as exc:
            logger.warning(f"Graph retrieval failed, continuing with vector-only results: {exc}")

    logger.info(f"Hybrid retrieval returned {len(sources)} sources")
    return sources
