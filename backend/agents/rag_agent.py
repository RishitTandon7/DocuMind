"""
RAG Indexing Agent.

Chunks the document's OCR text, embeds each chunk with the BGE embedding
model, and stores the embeddings in ChromaDB so the document becomes
queryable through vector retrieval.
"""

import asyncio

from rag.chroma_client import add_chunks, delete_document_chunks
from rag.chunker import chunk_text
from rag.embedder import embed_passages
from utils.logger import logger


async def run_rag_agent(document_id: str, document_text: str) -> int:
    """Chunk, embed, and index a document's text into the vector store. Returns chunk count."""
    logger.info(f"[rag_agent] Indexing document {document_id} for retrieval")
    await asyncio.to_thread(delete_document_chunks, document_id)  # re-runs (re-crop, rotate) replace stale chunks instead of duplicating
    chunks = chunk_text(document_id, document_text)
    if not chunks:
        logger.warning(f"[rag_agent] No text to index for document {document_id}")
        return 0

    texts = [chunk.text for chunk in chunks]
    chunk_ids = [chunk.chunk_id for chunk in chunks]
    embeddings = await asyncio.to_thread(embed_passages, texts)

    await asyncio.to_thread(
        add_chunks, document_id=document_id, chunk_ids=chunk_ids, texts=texts, embeddings=embeddings
    )
    logger.info(f"[rag_agent] Indexed {len(chunks)} chunks for document {document_id}")
    return len(chunks)
