# DocuMind Test Suite & Validation Report

This report documents the automated test suite executed for **DocuMind** (PS ID: `ALG-AI-02`, Intelligent Document Investigator).

---

## Executive Summary

| Category | Total | Passed | Known Gaps (App Failures) | Status |
|---|---|---|---|---|
| Ingestion & Formats | 3 | 2 | 1 | Partial Support |
| Citations & References | 2 | 1 | 1 | Partial Support |
| Conflict Detection | 1 | 0 | 1 | Gap (Missing) |
| Uncertainty & Refusal | 2 | 2 | 0 | Fully Passing |
| Edge Cases & Robustness | 5 | 5 | 0 | Fully Passing |
| **Total** | **13** | **10** | **3** | **76.9% Pass Rate** |

---

## Detailed Test Breakdown

### 1. Ingestion per Format (`tests/test_ingestion.py`)
- `test_pdf_format_ingestion`: **PASSED**. Multi-page and single-page PDF rendering via PyMuPDF (`fitz`) renders cleanly to high-resolution BGR images for OCR and DIP.
- `test_image_format_ingestion`: **PASSED**. Image formats (`.png`, `.jpg`, `.jpeg`, `.tiff`, `.bmp`) validate against the extension allow-list and decode via OpenCV.
- `test_text_format_ingestion`: **FAILED (KNOWN GAP)**. Plain text (`.txt`, `.md`) uploads are currently rejected with `UnsupportedFileTypeError` because the pipeline exclusively expects visual/image input for the DIP + OCR tiers.

### 2. Source & Section References (`tests/test_source_references.py`)
- `test_chunker_generates_chunk_index`: **PASSED**. The chunker splits text into overlapping windows and tags each chunk with an integer index and ID.
- `test_mandatory_source_metadata_fields`: **FAILED (KNOWN GAP)**. Mandatory requirement calls for doc name, page number, and chunk reference. The current ChromaDB client (`backend/rag/chroma_client.py:45`) only stores `{"document_id": document_id, "text": text}`. Document filename, page number, and chunk index are not preserved in the chunk metadata or exposed on `QuerySource`.

### 3. Cross-Document Conflict Detection (`tests/test_conflict_detection.py`)
- `test_conflict_detection_on_sample_contradiction`: **FAILED (KNOWN GAP)**. When tested against conflicting facts (e.g., $75/day meal allowance in `company_policy_2024.pdf` vs. $120/day in `travel_update_memo_2025.txt`), the system lacks a conflict-detection engine and `QueryResponse` does not define conflict fields to highlight both conflicting sources.

### 4. Uncertainty Handling (`tests/test_uncertainty.py`)
- `test_empty_context_uncertainty_handling`: **PASSED**. When no relevant context is found in the index, `generate_and_verify_answer` returns an explicit disclaimer: *"I could not find any relevant information in the document to answer this question."* with `confidence=0.0`.
- `test_prompt_includes_hallucination_guardrails`: **PASSED**. Prompt templates explicitly instruct the LLM: *"If the context does not contain the answer, say so explicitly rather than guessing"* and use a calibrated second-pass prompt scoring 0.0 to 1.0.

### 5. Edge Cases & Robustness (`tests/test_edge_cases.py`)
- `test_unsupported_formats`: **PASSED**. Executables (`.exe`), archives (`.zip`), scripts (`.sh`), and binaries (`.bin`) are rejected immediately with `UnsupportedFileTypeError`.
- `test_very_large_file_rejection`: **PASSED**. Streaming uploads exceeding `MAX_UPLOAD_SIZE_MB` (25MB) are stopped mid-stream, deleted from disk, and raise `FileTooLargeError` (mapped to HTTP 413).
- `test_corrupted_pdf_handling`: **PASSED**. Malformed or truncated PDF byte streams raise `fitz.FileDataError`, preventing corrupted ingestion.
- `test_empty_file_handling`: **PASSED**. Zero-byte uploads raise an error during image decoding, preventing downstream crashes.
- `test_duplicate_upload_id_generation`: **PASSED**. Uploading the same file multiple times assigns distinct UUIDs (`generate_document_id()`), isolating document records without collision.

---

## How to Run the Tests

From the repository root using the Python environment:

```bash
# Using backend venv
backend\.venv\Scripts\python.exe tests/run_tests.py

# Or with system Python (if dependencies installed)
python tests/run_tests.py
```
