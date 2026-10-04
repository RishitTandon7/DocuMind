"""
Supervisor Agent.

Orchestrates the full document processing pipeline as a LangGraph
`StateGraph`: DIP (document detection, cropping, adaptive enhancement, and
the three output modes) -> OCR -> document understanding -> knowledge
graph extraction -> RAG indexing. Every node updates the document's status
in PostgreSQL, writes a row to `agent_logs`, and broadcasts the same event
live over the document's WebSocket channel so the frontend timeline
updates in real time.
"""

import asyncio
from dataclasses import dataclass
from typing import Any, TypedDict

import numpy as np
from langgraph.graph import END, StateGraph

from agents.dip_agent import run_dip_agent
from agents.doc_understanding import understand_document
from agents.kg_agent import run_kg_agent
from agents.ocr_agent import run_ocr_agent_pages
from agents.rag_agent import run_rag_agent
from api.routes.websocket import broadcast_agent_event
from db import postgres as db
from utils.image_utils import load_image
from utils.logger import logger

OUTPUT_MODE_OPERATIONS = {"output_grayscale", "output_bw"}


@dataclass
class PageJob:
    """One page to (re-)process through Tier 0: its raw image and optional user-supplied corners."""

    page_number: int
    raw_image: np.ndarray
    corners: list[list[float]] | None = None


class PipelineState(TypedDict, total=False):
    document_id: str
    page_jobs: list[PageJob]
    ocr_text: str
    understanding_summary: str
    error: str


async def _log_and_broadcast(
    document_id: str, agent_name: str, action: str, decision: str | None = None, reasoning: str | None = None
) -> None:
    await db.insert_agent_log(document_id, agent_name, action, decision, reasoning)
    await broadcast_agent_event(document_id, agent_name, action, decision, reasoning)


async def _load_page_outputs(document_id: str, page_number: int) -> tuple[np.ndarray, np.ndarray]:
    """Load a page's final (color, grayscale) Tier 0 outputs back from disk."""
    operations = await db.get_dip_operations(document_id, page_number)
    color_op = next((op for op in reversed(operations) if op["operation_name"] not in OUTPUT_MODE_OPERATIONS), None)
    gray_op = next((op for op in operations if op["operation_name"] == "output_grayscale"), color_op)
    if color_op is None or gray_op is None:
        raise RuntimeError(f"No DIP output found for page {page_number}")
    return load_image(color_op["image_after_path"]), load_image(gray_op["image_after_path"])


async def _node_dip(state: PipelineState) -> PipelineState:
    document_id = state["document_id"]
    page_jobs = state["page_jobs"]
    page_count = len(await db.get_pages(document_id))
    await db.update_document_status(document_id, "processing_dip")
    await _log_and_broadcast(
        document_id,
        "DIPAgent",
        "started",
        reasoning=(
            "Detecting document, cropping, and enhancing"
            if page_count == 1
            else f"Detecting, cropping, and enhancing {len(page_jobs)} of {page_count} pages"
        ),
    )
    for job in page_jobs:
        await run_dip_agent(
            document_id,
            job.raw_image,
            manual_corners=job.corners,
            page_number=job.page_number,
            page_count=page_count,
        )
    await _log_and_broadcast(document_id, "DIPAgent", "completed", decision="restoration_complete")
    return {"document_id": document_id}


async def _node_ocr(state: PipelineState) -> PipelineState:
    document_id = state["document_id"]
    await db.update_document_status(document_id, "processing_ocr")
    await _log_and_broadcast(document_id, "OCRAgent", "started", reasoning="Extracting text via PaddleOCR")
    pages = await db.get_pages(document_id)
    gray_images = [(await _load_page_outputs(document_id, page["page_number"]))[1] for page in pages]
    result = await run_ocr_agent_pages(document_id, gray_images)
    await _log_and_broadcast(
        document_id,
        "OCRAgent",
        "completed",
        decision=f"{result.word_count}_words",
        reasoning=f"Average confidence {result.average_confidence:.2f}",
    )
    return {"ocr_text": result.raw_text}


async def _node_understanding(state: PipelineState) -> PipelineState:
    document_id = state["document_id"]
    await db.update_document_status(document_id, "processing_understanding")
    await _log_and_broadcast(document_id, "DocUnderstandingAgent", "started")
    first_color, _ = await _load_page_outputs(document_id, 0)
    understanding = await asyncio.to_thread(understand_document, first_color, state["ocr_text"])
    await _log_and_broadcast(
        document_id, "DocUnderstandingAgent", "completed", reasoning=understanding.summary[:500]
    )
    return {"understanding_summary": understanding.summary}


async def _node_knowledge_graph(state: PipelineState) -> PipelineState:
    document_id = state["document_id"]
    await db.update_document_status(document_id, "processing_graph")
    await _log_and_broadcast(document_id, "KGAgent", "started", reasoning="Extracting entities and relationships")
    combined_text = f"{state['ocr_text']}\n\n{state.get('understanding_summary', '')}"
    extraction = await run_kg_agent(document_id, combined_text)
    await _log_and_broadcast(
        document_id,
        "KGAgent",
        "completed",
        decision=f"{len(extraction.entities)}_entities",
        reasoning=f"{len(extraction.relationships)} relationships extracted",
    )
    return {"document_id": document_id}


async def _node_rag_indexing(state: PipelineState) -> PipelineState:
    document_id = state["document_id"]
    await db.update_document_status(document_id, "processing_embeddings")
    await _log_and_broadcast(document_id, "RAGAgent", "started", reasoning="Chunking and embedding document text")
    combined_text = f"{state['ocr_text']}\n\n{state.get('understanding_summary', '')}"
    chunk_count = await run_rag_agent(document_id, combined_text)
    await _log_and_broadcast(document_id, "RAGAgent", "completed", decision=f"{chunk_count}_chunks_indexed")
    await db.update_document_status(document_id, "completed")
    await _log_and_broadcast(document_id, "SupervisorAgent", "pipeline_completed")
    return {"document_id": document_id}


def _build_graph() -> Any:
    graph = StateGraph(PipelineState)
    graph.add_node("dip", _node_dip)
    graph.add_node("ocr", _node_ocr)
    graph.add_node("understanding", _node_understanding)
    graph.add_node("knowledge_graph", _node_knowledge_graph)
    graph.add_node("rag_indexing", _node_rag_indexing)

    graph.set_entry_point("dip")
    graph.add_edge("dip", "ocr")
    graph.add_edge("ocr", "understanding")
    graph.add_edge("understanding", "knowledge_graph")
    graph.add_edge("knowledge_graph", "rag_indexing")
    graph.add_edge("rag_indexing", END)

    return graph.compile()


_compiled_graph = None


def get_compiled_graph() -> Any:
    """Return the compiled LangGraph pipeline, building it once and caching it."""
    global _compiled_graph
    if _compiled_graph is None:
        _compiled_graph = _build_graph()
    return _compiled_graph


async def run_pipeline(document_id: str, page_jobs: list[PageJob]) -> None:
    """Run the full agentic pipeline for a document.

    `page_jobs` lists the pages to (re-)run through Tier 0; OCR, understanding, graph extraction
    and indexing always cover every page of the document.
    """
    logger.info(f"[supervisor] Starting pipeline for document {document_id} ({len(page_jobs)} page job(s))")
    graph = get_compiled_graph()
    try:
        await graph.ainvoke({"document_id": document_id, "page_jobs": page_jobs})
        logger.info(f"[supervisor] Pipeline completed for document {document_id}")
    except Exception as exc:
        logger.exception(f"[supervisor] Pipeline failed for document {document_id}: {exc}")
        await db.update_document_status(document_id, "failed", error_message=str(exc))
        await _log_and_broadcast(document_id, "SupervisorAgent", "pipeline_failed", reasoning=str(exc))
