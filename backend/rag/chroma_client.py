"""
ChromaDB vector store client.

Connects to the ChromaDB server over HTTP, owns the single collection used
for all document chunks (distinguished by `document_id` metadata), and
exposes typed add/query helpers used by `rag_agent` and `hybrid_retrieval`.
"""

from functools import lru_cache
from typing import Any

import chromadb
from chromadb.api.models.Collection import Collection

from config import get_settings
from utils.logger import logger

settings = get_settings()


@lru_cache
def _get_client() -> chromadb.HttpClient:
    logger.info(f"Connecting to ChromaDB at {settings.chroma_host}:{settings.chroma_port}")
    return chromadb.HttpClient(host=settings.chroma_host, port=settings.chroma_port)


def get_collection() -> Collection:
    """Return (creating if necessary) the shared DocuMind chunks collection."""
    client = _get_client()
    return client.get_or_create_collection(
        name=settings.chroma_collection_name, metadata={"hnsw:space": "cosine"}
    )


def add_chunks(
    document_id: str,
    chunk_ids: list[str],
    texts: list[str],
    embeddings: list[list[float]],
) -> None:
    """Add a batch of embedded chunks for a document to the vector store."""
    if not chunk_ids:
        return
    collection = get_collection()
    metadatas = [{"document_id": document_id, "text": text} for text in texts]
    collection.add(ids=chunk_ids, embeddings=embeddings, documents=texts, metadatas=metadatas)
    logger.info(f"Indexed {len(chunk_ids)} chunks for document {document_id} into ChromaDB")


def delete_document_chunks(document_id: str) -> None:
    """Remove every indexed chunk belonging to a document (used on re-index and on delete)."""
    get_collection().delete(where={"document_id": document_id})
    logger.info(f"Deleted ChromaDB chunks for document {document_id}")


def query_similar(
    query_embedding: list[float], document_id: str | None, top_k: int
) -> list[dict[str, Any]]:
    """Query the vector store for the top-k most similar chunks, optionally scoped to a document."""
    collection = get_collection()
    where_clause = {"document_id": document_id} if document_id else None
    result = collection.query(
        query_embeddings=[query_embedding],
        n_results=top_k,
        where=where_clause,
    )

    matches: list[dict[str, Any]] = []
    ids = result.get("ids", [[]])[0]
    documents = result.get("documents", [[]])[0]
    distances = result.get("distances", [[]])[0]
    metadatas = result.get("metadatas", [[]])[0]

    for chunk_id, document_text, distance, metadata in zip(ids, documents, distances, metadatas):
        matches.append(
            {
                "chunk_id": chunk_id,
                "text": document_text,
                "similarity": 1.0 - distance,
                "metadata": metadata,
            }
        )
    return matches
