"""
Tests for Source & Section References on Answers:
- [MANDATORY REQUIREMENT] Source/section references on every answer (doc name, page, chunk).
"""

import os
import sys
import unittest

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "backend")))

from models.schemas import QuerySource
from rag.chunker import chunk_text


class TestSourceReferences(unittest.TestCase):
    def test_chunker_generates_chunk_index(self):
        """Verify chunker produces chunk objects with chunk_index and chunk_id."""
        sample_text = "This is a test document text to verify chunking logic across windows. " * 30
        chunks = chunk_text("doc_test_123", sample_text)
        self.assertGreater(len(chunks), 0)
        first_chunk = chunks[0]
        self.assertTrue(hasattr(first_chunk, "chunk_index"))
        self.assertTrue(hasattr(first_chunk, "chunk_id"))
        self.assertEqual(first_chunk.chunk_index, 0)

    def test_mandatory_source_metadata_fields(self):
        """
        [MANDATORY REQUIREMENT] Every retrieved source reference MUST include:
        1. Document name (doc name / filename)
        2. Page number (page)
        3. Chunk reference (chunk index or chunk id)

        KNOWN APP GAP: In the current backend implementation:
        - ChromaClient (backend/rag/chroma_client.py:45) only stores:
          {"document_id": document_id, "text": text}
        - Filename is not propagated from Postgres into Chroma metadata.
        - Page number is lost during text aggregation in supervisor.py.
        - Chunk index is embedded in Chroma chunk_id but omitted from QuerySource metadata.
        """
        # Simulating current source metadata returned by backend/rag/chroma_client.py
        current_retrieved_metadata = {
            "document_id": "8b51d1e4-f3c5-4a64-9b22-8d76c6c74d32",
            "text": "The maximum daily meal allowance for domestic business travel is $75 per day.",
        }

        source = QuerySource(
            content=current_retrieved_metadata["text"],
            score=0.92,
            source_type="vector",
            metadata=current_retrieved_metadata,
        )

        missing_fields = []
        if not ("filename" in source.metadata or "doc_name" in source.metadata):
            missing_fields.append("doc name / filename")
        if not ("page" in source.metadata or "page_number" in source.metadata):
            missing_fields.append("page number")
        if not ("chunk" in source.metadata or "chunk_index" in source.metadata or "chunk_id" in source.metadata):
            missing_fields.append("chunk reference")

        if missing_fields:
            self.fail(
                f"KNOWN FAILURE (GAP): QuerySource metadata is missing mandatory citation fields: "
                f"{', '.join(missing_fields)}. Current metadata: {source.metadata}"
            )


if __name__ == "__main__":
    unittest.main()
