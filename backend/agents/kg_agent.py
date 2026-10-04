"""
Knowledge Graph Agent.

Extracts entities and relationships from the document's OCR text (augmented
with the document understanding summary) via `graph.entity_extractor`, then
persists them into Neo4j via `graph.neo4j_client`.
"""

import asyncio

from graph import neo4j_client
from graph.entity_extractor import ExtractionResult, extract_entities_and_relationships
from utils.logger import logger


async def run_kg_agent(document_id: str, document_text: str) -> ExtractionResult:
    """Extract entities/relationships from document text and write them into Neo4j."""
    logger.info(f"[kg_agent] Extracting knowledge graph for document {document_id}")
    extraction = await asyncio.to_thread(extract_entities_and_relationships, document_text)
    await neo4j_client.write_extraction(document_id, extraction)
    logger.info(
        f"[kg_agent] Persisted {len(extraction.entities)} entities and "
        f"{len(extraction.relationships)} relationships for document {document_id}"
    )
    return extraction
