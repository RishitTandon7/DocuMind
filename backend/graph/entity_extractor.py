"""
LLM-driven entity and relationship extraction.

Prompts the configured LLM (Gemini or a local Ollama model) to read a
document's OCR text and return a structured list of entities (people,
organizations, dates, amounts, locations, etc.) and the relationships
between them, which the `kg_agent` then persists into Neo4j.
"""

import json
from dataclasses import dataclass

from agents.llm_client import LLMError, generate
from utils.logger import logger

_EXTRACTION_PROMPT = """You are an information extraction engine. Read the document text below and \
extract the key entities and the relationships between them.

Return ONLY valid JSON matching this exact schema, with no markdown fences and no commentary:
{{
  "entities": [{{"id": "e1", "label": "human readable name", "type": "PERSON|ORGANIZATION|DATE|LOCATION|AMOUNT|DOCUMENT|OTHER"}}],
  "relationships": [{{"source": "e1", "target": "e2", "relation": "SHORT_VERB_PHRASE"}}]
}}

Document text:
---
{document_text}
---
"""


@dataclass
class ExtractedEntity:
    id: str
    label: str
    type: str


@dataclass
class ExtractedRelationship:
    source: str
    target: str
    relation: str


@dataclass
class ExtractionResult:
    entities: list[ExtractedEntity]
    relationships: list[ExtractedRelationship]


class EntityExtractionError(Exception):
    """Raised when the LLM fails to produce a parseable entity/relationship extraction."""


def extract_entities_and_relationships(document_text: str) -> ExtractionResult:
    """Call the configured LLM to extract entities and relationships from OCR'd document text."""
    if not document_text.strip():
        return ExtractionResult(entities=[], relationships=[])

    prompt = _EXTRACTION_PROMPT.format(document_text=document_text[:12000])

    try:
        raw_response = generate(prompt, temperature=0.1, json_mode=True)
        payload = json.loads(raw_response)
    except (LLMError, json.JSONDecodeError) as exc:
        logger.error(f"Entity extraction failed: {exc}")
        raise EntityExtractionError(f"Failed to extract entities: {exc}") from exc

    entities = [
        ExtractedEntity(id=e["id"], label=e["label"], type=e.get("type", "OTHER"))
        for e in payload.get("entities", [])
    ]
    relationships = [
        ExtractedRelationship(
            source=r["source"], target=r["target"], relation=r.get("relation", "RELATED_TO")
        )
        for r in payload.get("relationships", [])
    ]
    logger.info(f"Extracted {len(entities)} entities and {len(relationships)} relationships")
    return ExtractionResult(entities=entities, relationships=relationships)
