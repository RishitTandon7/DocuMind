"""Query route: question answering via the hybrid graph + vector RAG pipeline."""

from datetime import datetime, timezone

from fastapi import APIRouter

from agents.hybrid_retrieval import hybrid_retrieve
from agents.verification import generate_and_verify_answer
from db import postgres as db
from models.schemas import QueryRequest, QueryResponse, QuerySource
from utils.logger import logger

router = APIRouter(prefix="/query", tags=["query"])


@router.post("", response_model=QueryResponse)
async def query_documents(request: QueryRequest) -> QueryResponse:
    """Answer a user question using hybrid graph + vector retrieval, with verified confidence."""
    logger.info(f"Received query: '{request.question}' (document_id={request.document_id})")

    sources = await hybrid_retrieve(request.question, request.document_id)
    verified = generate_and_verify_answer(request.question, sources)

    query_sources = [
        QuerySource(
            content=source.content,
            score=source.score,
            source_type=source.source_type,
            metadata=source.metadata,
        )
        for source in sources
    ]

    retrieval_strategy = "hybrid" if any(s.source_type == "graph" for s in sources) else "vector"

    await db.insert_query_history(
        document_id=request.document_id,
        question=request.question,
        answer=verified.answer,
        sources=[source.model_dump() for source in query_sources],
        retrieval_strategy=retrieval_strategy,
        confidence=verified.confidence,
    )

    return QueryResponse(
        question=request.question,
        answer=verified.answer,
        sources=query_sources,
        retrieval_strategy=retrieval_strategy,
        confidence=verified.confidence,
        timestamp=datetime.now(timezone.utc),
    )
