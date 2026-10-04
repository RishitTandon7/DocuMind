"""
Verification Agent.

Generates the final answer to a user's question from the retrieved hybrid
sources using the configured LLM, then asks the model a second, separate
question — whether the answer is actually supported by the given sources —
to produce a calibrated confidence score. This catches ungrounded
hallucination that a single generation pass would not self-report.
"""

from dataclasses import dataclass

from agents.hybrid_retrieval import RetrievedSource
from agents.llm_client import LLMError, generate
from utils.logger import logger

_ANSWER_PROMPT = """Answer the question using ONLY the context below. If the context does not contain \
the answer, say so explicitly rather than guessing.

Context:
---
{context}
---

Question: {question}

Answer concisely and directly.
"""

_VERIFY_PROMPT = """Given the context and the proposed answer below, rate how well the context supports \
the answer on a scale from 0.0 (not supported at all) to 1.0 (fully supported). Respond with ONLY a \
number between 0.0 and 1.0.

Context:
---
{context}
---

Proposed answer: {answer}
"""


@dataclass
class VerifiedAnswer:
    """A generated answer together with its source-grounded confidence score."""

    answer: str
    confidence: float


def _build_context(sources: list[RetrievedSource]) -> str:
    return "\n\n".join(f"[{source.source_type}] {source.content}" for source in sources)


def generate_and_verify_answer(question: str, sources: list[RetrievedSource]) -> VerifiedAnswer:
    """Generate an answer grounded in retrieved sources and verify its confidence."""
    context = _build_context(sources)

    if not context.strip():
        return VerifiedAnswer(
            answer="I could not find any relevant information in the document to answer this question.",
            confidence=0.0,
        )

    try:
        answer = generate(
            _ANSWER_PROMPT.format(context=context, question=question), temperature=0.1
        ).strip()
    except LLMError as exc:
        logger.error(f"Answer generation failed: {exc}")
        return VerifiedAnswer(answer="Answer generation failed due to an internal error.", confidence=0.0)

    try:
        raw_score = generate(
            _VERIFY_PROMPT.format(context=context, answer=answer), temperature=0.0
        ).strip()
        confidence = max(0.0, min(1.0, float(raw_score)))
    except (LLMError, ValueError) as exc:
        logger.warning(f"Verification scoring failed, defaulting confidence to 0.5: {exc}")
        confidence = 0.5

    logger.info(f"Generated answer with verified confidence={confidence:.2f}")
    return VerifiedAnswer(answer=answer, confidence=confidence)
