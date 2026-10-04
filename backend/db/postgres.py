"""
Async PostgreSQL access layer built on asyncpg.

Owns a single connection pool for the application lifetime and exposes
typed helper functions for every table defined in `db/migrations/init.sql`.
Routes and agents call these helpers instead of writing raw SQL inline.
"""

import json
from datetime import datetime
from typing import Any
from uuid import UUID

import asyncpg

from config import get_settings
from utils.logger import logger

settings = get_settings()

_pool: asyncpg.Pool | None = None


async def connect() -> None:
    """Create the global asyncpg connection pool. Call once on application startup."""
    global _pool
    if _pool is not None:
        return
    logger.info(f"Connecting to PostgreSQL at {settings.postgres_host}:{settings.postgres_port}")
    try:
        _pool = await asyncpg.create_pool(
            dsn=settings.postgres_dsn,
            min_size=2,
            max_size=10,
            command_timeout=30,
        )
    except Exception as exc:
        logger.error(f"Failed to connect to PostgreSQL: {exc}")
        raise
    logger.info("PostgreSQL connection pool established")
    await ensure_schema()


SCHEMA_UPGRADES = """
ALTER TABLE dip_operations ADD COLUMN IF NOT EXISTS page_number INTEGER NOT NULL DEFAULT 0;
CREATE TABLE IF NOT EXISTS document_pages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    doc_id UUID NOT NULL REFERENCES documents (id) ON DELETE CASCADE,
    page_number INTEGER NOT NULL,
    file_path TEXT NOT NULL,
    UNIQUE (doc_id, page_number)
);
CREATE INDEX IF NOT EXISTS idx_document_pages_doc_id ON document_pages (doc_id);
CREATE INDEX IF NOT EXISTS idx_dip_operations_page ON dip_operations (doc_id, page_number);
"""


async def ensure_schema() -> None:
    """Apply idempotent schema upgrades (multi-page support) so existing databases keep working."""
    await get_pool().execute(SCHEMA_UPGRADES)


async def disconnect() -> None:
    """Close the global asyncpg connection pool. Call once on application shutdown."""
    global _pool
    if _pool is not None:
        await _pool.close()
        _pool = None
        logger.info("PostgreSQL connection pool closed")


def get_pool() -> asyncpg.Pool:
    """Return the active connection pool, raising if it has not been initialized."""
    if _pool is None:
        raise RuntimeError("PostgreSQL pool is not initialized. Call db.postgres.connect() first.")
    return _pool


# --- documents ---


async def create_document(document_id: str, filename: str, file_path: str) -> dict[str, Any]:
    """Insert a new document row with status 'uploaded'."""
    pool = get_pool()
    row = await pool.fetchrow(
        """
        INSERT INTO documents (id, filename, file_path, status)
        VALUES ($1, $2, $3, 'uploaded')
        RETURNING id, filename, file_path, status, error_message, upload_time, completed_time
        """,
        UUID(document_id),
        filename,
        file_path,
    )
    return dict(row)


async def update_document_status(
    document_id: str, status: str, error_message: str | None = None
) -> None:
    """Update a document's processing status, optionally recording an error message."""
    pool = get_pool()
    completed_time = datetime.utcnow() if status in ("completed", "failed") else None
    await pool.execute(
        """
        UPDATE documents
        SET status = $2, error_message = $3, completed_time = COALESCE($4, completed_time)
        WHERE id = $1
        """,
        UUID(document_id),
        status,
        error_message,
        completed_time,
    )


async def get_document(document_id: str) -> dict[str, Any] | None:
    """Fetch a single document by id."""
    pool = get_pool()
    row = await pool.fetchrow(
        """
        SELECT id, filename, file_path, status, error_message, upload_time, completed_time
        FROM documents WHERE id = $1
        """,
        UUID(document_id),
    )
    return dict(row) if row else None


async def update_document_filename(document_id: str, filename: str) -> dict[str, Any] | None:
    """Rename a document. Returns the updated row, or None if it does not exist."""
    pool = get_pool()
    row = await pool.fetchrow(
        """
        UPDATE documents SET filename = $2 WHERE id = $1
        RETURNING id, filename, file_path, status, error_message, upload_time, completed_time
        """,
        UUID(document_id),
        filename,
    )
    return dict(row) if row else None


async def delete_document(document_id: str) -> bool:
    """Delete a document row (cascading to pages, DIP operations, OCR results, logs and history)."""
    pool = get_pool()
    result = await pool.execute("DELETE FROM documents WHERE id = $1", UUID(document_id))
    return result.endswith(" 1")


# --- document_pages ---


async def insert_pages(document_id: str, file_paths: list[str]) -> None:
    """Register the stored raw image of every page of a document, in order."""
    pool = get_pool()
    await pool.executemany(
        "INSERT INTO document_pages (doc_id, page_number, file_path) VALUES ($1, $2, $3)",
        [(UUID(document_id), index, path) for index, path in enumerate(file_paths)],
    )


async def get_pages(document_id: str) -> list[dict[str, Any]]:
    """Fetch a document's pages in order. Documents created before multi-page support
    have no rows here, so they are reported as a single page backed by `documents.file_path`."""
    pool = get_pool()
    rows = await pool.fetch(
        "SELECT page_number, file_path FROM document_pages WHERE doc_id = $1 ORDER BY page_number ASC",
        UUID(document_id),
    )
    if rows:
        return [dict(row) for row in rows]
    document = await get_document(document_id)
    return [{"page_number": 0, "file_path": document["file_path"]}] if document else []


# --- dip_operations ---


async def insert_dip_operation(
    document_id: str,
    operation_name: str,
    params: dict[str, Any],
    psnr_before: float,
    psnr_after: float,
    ssim_before: float,
    ssim_after: float,
    image_before_path: str,
    image_after_path: str,
    step_order: int,
    page_number: int = 0,
) -> dict[str, Any]:
    """Insert a single DIP operation record for one page of a document."""
    pool = get_pool()
    row = await pool.fetchrow(
        """
        INSERT INTO dip_operations (
            doc_id, operation_name, params, psnr_before, psnr_after,
            ssim_before, ssim_after, image_before_path, image_after_path, step_order, page_number
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
        RETURNING id, doc_id, operation_name, params, psnr_before, psnr_after,
                  ssim_before, ssim_after, image_before_path, image_after_path, step_order, timestamp
        """,
        UUID(document_id),
        operation_name,
        json.dumps(params),
        psnr_before,
        psnr_after,
        ssim_before,
        ssim_after,
        image_before_path,
        image_after_path,
        step_order,
        page_number,
    )
    return dict(row)


async def get_dip_operations(document_id: str, page_number: int | None = 0) -> list[dict[str, Any]]:
    """Fetch DIP operations for one page of a document (or every page when `page_number` is None),
    ordered by page then step order."""
    pool = get_pool()
    rows = await pool.fetch(
        """
        SELECT id, doc_id, operation_name, params, psnr_before, psnr_after,
               ssim_before, ssim_after, image_before_path, image_after_path, step_order, page_number, timestamp
        FROM dip_operations
        WHERE doc_id = $1 AND ($2::int IS NULL OR page_number = $2)
        ORDER BY page_number ASC, step_order ASC
        """,
        UUID(document_id),
        page_number,
    )
    return [dict(row) for row in rows]


async def delete_dip_operations(document_id: str, page_number: int | None = None) -> None:
    """Delete DIP operation rows for one page (or all pages), used before a page is re-processed."""
    pool = get_pool()
    await pool.execute(
        "DELETE FROM dip_operations WHERE doc_id = $1 AND ($2::int IS NULL OR page_number = $2)",
        UUID(document_id),
        page_number,
    )


async def list_recent_documents(limit: int = 8) -> list[dict[str, Any]]:
    """Fetch the most recently uploaded documents, each with its color output thumbnail,
    word count from OCR, and completion time if available."""
    pool = get_pool()
    rows = await pool.fetch(
        """
        SELECT d.id, d.filename, d.file_path, d.status, d.upload_time, d.completed_time,
               thumb.image_after_path AS thumbnail_path,
               ocr.word_count
        FROM documents d
        LEFT JOIN LATERAL (
            SELECT image_after_path
            FROM dip_operations
            WHERE doc_id = d.id AND page_number = 0 AND operation_name NOT IN ('output_grayscale', 'output_bw')
            ORDER BY step_order DESC
            LIMIT 1
        ) thumb ON true
        LEFT JOIN LATERAL (
            SELECT word_count
            FROM ocr_results
            WHERE doc_id = d.id
            ORDER BY timestamp DESC
            LIMIT 1
        ) ocr ON true
        ORDER BY d.upload_time DESC
        LIMIT $1
        """,
        limit,
    )
    return [dict(row) for row in rows]


async def list_all_documents(
    offset: int = 0,
    limit: int = 20,
    search: str | None = None,
    status_filter: str | None = None,
) -> list[dict[str, Any]]:
    """Fetch a paginated list of all documents with optional filename search and status filter."""
    pool = get_pool()
    conditions = []
    params: list[Any] = []
    param_idx = 1

    if search:
        conditions.append(f"d.filename ILIKE ${param_idx}")
        params.append(f"%{search}%")
        param_idx += 1

    if status_filter and status_filter != "all":
        conditions.append(f"d.status = ${param_idx}::document_status")
        params.append(status_filter)
        param_idx += 1

    where_clause = f"WHERE {' AND '.join(conditions)}" if conditions else ""

    params.append(limit)
    limit_idx = param_idx
    param_idx += 1

    params.append(offset)
    offset_idx = param_idx

    query = f"""
        SELECT d.id, d.filename, d.file_path, d.status, d.upload_time, d.completed_time, d.error_message,
               thumb.image_after_path AS thumbnail_path,
               ocr.word_count
        FROM documents d
        LEFT JOIN LATERAL (
            SELECT image_after_path
            FROM dip_operations
            WHERE doc_id = d.id AND page_number = 0 AND operation_name NOT IN ('output_grayscale', 'output_bw')
            ORDER BY step_order DESC
            LIMIT 1
        ) thumb ON true
        LEFT JOIN LATERAL (
            SELECT word_count
            FROM ocr_results
            WHERE doc_id = d.id
            ORDER BY timestamp DESC
            LIMIT 1
        ) ocr ON true
        {where_clause}
        ORDER BY d.upload_time DESC
        LIMIT ${limit_idx} OFFSET ${offset_idx}
    """

    rows = await pool.fetch(query, *params)
    return [dict(row) for row in rows]


async def count_documents(
    search: str | None = None,
    status_filter: str | None = None,
) -> int:
    """Count total documents, with optional filename search and status filter."""
    pool = get_pool()
    conditions = []
    params: list[Any] = []
    param_idx = 1

    if search:
        conditions.append(f"filename ILIKE ${param_idx}")
        params.append(f"%{search}%")
        param_idx += 1

    if status_filter and status_filter != "all":
        conditions.append(f"status = ${param_idx}::document_status")
        params.append(status_filter)
        param_idx += 1

    where_clause = f"WHERE {' AND '.join(conditions)}" if conditions else ""
    query = f"SELECT COUNT(*) FROM documents {where_clause}"

    row = await pool.fetchval(query, *params)
    return int(row)


# --- ocr_results ---


async def insert_ocr_result(
    document_id: str, raw_text: str, confidence: float, word_count: int
) -> dict[str, Any]:
    """Insert an OCR result record for a document."""
    pool = get_pool()
    row = await pool.fetchrow(
        """
        INSERT INTO ocr_results (doc_id, raw_text, confidence, word_count)
        VALUES ($1, $2, $3, $4)
        RETURNING id, doc_id, raw_text, confidence, word_count, timestamp
        """,
        UUID(document_id),
        raw_text,
        confidence,
        word_count,
    )
    return dict(row)


async def get_ocr_result(document_id: str) -> dict[str, Any] | None:
    """Fetch the most recent OCR result for a document."""
    pool = get_pool()
    row = await pool.fetchrow(
        """
        SELECT id, doc_id, raw_text, confidence, word_count, timestamp
        FROM ocr_results WHERE doc_id = $1 ORDER BY timestamp DESC LIMIT 1
        """,
        UUID(document_id),
    )
    return dict(row) if row else None


# --- agent_logs ---


async def insert_agent_log(
    document_id: str, agent_name: str, action: str, decision: str | None, reasoning: str | None
) -> dict[str, Any]:
    """Insert an agent decision/action log entry."""
    pool = get_pool()
    row = await pool.fetchrow(
        """
        INSERT INTO agent_logs (doc_id, agent_name, action, decision, reasoning)
        VALUES ($1, $2, $3, $4, $5)
        RETURNING id, doc_id, agent_name, action, decision, reasoning, timestamp
        """,
        UUID(document_id),
        agent_name,
        action,
        decision,
        reasoning,
    )
    return dict(row)


async def get_agent_logs(document_id: str) -> list[dict[str, Any]]:
    """Fetch the full agent decision log for a document, ordered chronologically."""
    pool = get_pool()
    rows = await pool.fetch(
        """
        SELECT id, doc_id, agent_name, action, decision, reasoning, timestamp
        FROM agent_logs WHERE doc_id = $1 ORDER BY timestamp ASC
        """,
        UUID(document_id),
    )
    return [dict(row) for row in rows]


# --- query_history ---


async def insert_query_history(
    document_id: str | None,
    question: str,
    answer: str,
    sources: list[dict[str, Any]],
    retrieval_strategy: str,
    confidence: float,
) -> dict[str, Any]:
    """Insert a question/answer record into query history."""
    pool = get_pool()
    row = await pool.fetchrow(
        """
        INSERT INTO query_history (doc_id, question, answer, sources, retrieval_strategy, confidence)
        VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING id, doc_id, question, answer, sources, retrieval_strategy, confidence, timestamp
        """,
        UUID(document_id) if document_id else None,
        question,
        answer,
        json.dumps(sources),
        retrieval_strategy,
        confidence,
    )
    return dict(row)
