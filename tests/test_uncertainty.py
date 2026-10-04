"""
Tests for Uncertainty Handling and Calibrated Confidence Scoring:
- [MANDATORY REQUIREMENT] Uncertainty handling (low-evidence answers say so, with a confidence signal).
"""

import os
import sys
import unittest

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "backend")))

from agents.verification import _ANSWER_PROMPT, _VERIFY_PROMPT, generate_and_verify_answer


class TestUncertaintyHandling(unittest.TestCase):
    def test_empty_context_uncertainty_handling(self):
        """
        Verify that when zero relevant sources are retrieved for an unanswerable question,
        the system explicitly reports lack of evidence and outputs confidence=0.0.
        """
        question = "What is the reimbursement policy for international relocation visa fees and parental leave duration?"
        verified = generate_and_verify_answer(question, sources=[])

        # Must explicitly acknowledge absence of information
        self.assertIn("could not find any relevant information", verified.answer.lower())
        # Confidence signal must reflect lack of evidence
        self.assertEqual(verified.confidence, 0.0)

    def test_prompt_includes_hallucination_guardrails(self):
        """Verify prompt templates instruct the LLM to admit lack of knowledge rather than guessing."""
        self.assertIn("say so explicitly rather than guessing", _ANSWER_PROMPT)
        self.assertIn("0.0 (not supported at all) to 1.0 (fully supported)", _VERIFY_PROMPT)


if __name__ == "__main__":
    unittest.main()
