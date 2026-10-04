"""
Tests for Conflict Detection Across Documents:
- [MANDATORY REQUIREMENT] Conflict detection across documents (show both conflicting sources).
"""

import os
import sys
import unittest

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "backend")))

from agents.hybrid_retrieval import RetrievedSource
from models.schemas import QueryResponse


class TestConflictDetection(unittest.TestCase):
    def test_conflict_detection_on_sample_contradiction(self):
        """
        [MANDATORY REQUIREMENT] Conflict detection across documents (show both conflicting sources).
        
        When two documents contain conflicting factual statements (e.g. 2024 policy stating $75/day
        meal allowance vs 2025 update memo stating $120/day meal allowance), the system must:
        1. Detect the factual conflict/contradiction between the sources.
        2. Identify and return BOTH conflicting sources so the user can see the contradiction.
        
        KNOWN APP GAP: The current system does not implement conflict detection logic.
        QueryResponse has no conflict schema (e.g. `conflicts` or `has_conflict`),
        and the verification agent only passes all text to a standard QA prompt.
        """
        source_a = RetrievedSource(
            content="The maximum daily meal allowance for domestic business travel is $75 per day.",
            score=0.88,
            source_type="vector",
            metadata={"document_id": "doc_2024_policy", "filename": "company_policy_2024.pdf"},
        )
        source_b = RetrievedSource(
            content="Effective January 1, 2025, the maximum daily meal allowance has been increased to $120 per day.",
            score=0.91,
            source_type="vector",
            metadata={"document_id": "doc_2025_memo", "filename": "travel_update_memo_2025.txt"},
        )

        # Inspect QueryResponse schema to verify if conflict detection fields exist
        response_fields = QueryResponse.model_fields.keys()
        
        has_conflict_field = any(field in response_fields for field in ["conflicts", "has_conflict", "contradictions"])
        
        if not has_conflict_field:
            self.fail(
                "KNOWN FAILURE (GAP): No conflict detection capability exists in the backend. "
                "QueryResponse schema does not define any conflict/contradiction fields to report conflicting sources."
            )


if __name__ == "__main__":
    unittest.main()
