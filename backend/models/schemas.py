"""
Pydantic v2 request/response schemas for the DocuMind API.

Every FastAPI route declares one of these models as its `response_model` so
API responses are validated and documented consistently.
"""

from datetime import datetime
from enum import Enum
from typing import Any

from pydantic import BaseModel, ConfigDict, Field


class DocumentStatus(str, Enum):
    """Lifecycle states a document moves through during processing."""

    UPLOADED = "uploaded"
    PROCESSING_DIP = "processing_dip"
    PROCESSING_OCR = "processing_ocr"
    PROCESSING_UNDERSTANDING = "processing_understanding"
    PROCESSING_GRAPH = "processing_graph"
    PROCESSING_EMBEDDINGS = "processing_embeddings"
    COMPLETED = "completed"
    FAILED = "failed"


class UploadResponse(BaseModel):
    """Response returned immediately after a document upload starts the pipeline."""

    model_config = ConfigDict(from_attributes=True)

    document_id: str
    filename: str
    status: DocumentStatus
    upload_time: datetime
    page_count: int = 1


class DocumentStatusResponse(BaseModel):
    """Response describing a document's current processing status."""

    model_config = ConfigDict(from_attributes=True)

    document_id: str
    filename: str
    status: DocumentStatus
    error_message: str | None = None
    upload_time: datetime
    completed_time: datetime | None = None


class DocumentSummary(BaseModel):
    """A single row in the recent-documents list."""

    document_id: str
    filename: str
    status: DocumentStatus
    upload_time: datetime
    thumbnail_url: str | None = None


class DocumentListResponse(BaseModel):
    """Recent documents, newest first."""

    documents: list[DocumentSummary]


class DocumentLibraryItem(BaseModel):
    """A single row in the full document library, with richer metadata than DocumentSummary."""

    document_id: str
    filename: str
    status: DocumentStatus
    upload_time: datetime
    completed_time: datetime | None = None
    thumbnail_url: str | None = None
    word_count: int | None = None
    error_message: str | None = None


class PaginationMeta(BaseModel):
    """Pagination metadata for list endpoints."""

    page: int
    per_page: int
    total_count: int
    total_pages: int


class DocumentLibraryResponse(BaseModel):
    """Paginated document library listing."""

    documents: list[DocumentLibraryItem]
    pagination: PaginationMeta


class RecropRequest(BaseModel):
    """User-supplied replacement corners for a manual re-crop, in original image pixel coordinates."""

    corners: list[list[float]] = Field(min_length=4, max_length=4)
    page: int = Field(default=0, ge=0)


class RotateRequest(BaseModel):
    """Rotate one page clockwise by a multiple of 90 degrees and re-process it."""

    page: int = Field(default=0, ge=0)
    degrees: int = 90


class RenameRequest(BaseModel):
    """New display name for a document."""

    filename: str = Field(min_length=1, max_length=200)


class DetectCornersResponse(BaseModel):
    """Result of running the document-edge detector on a single photo (corners in image pixels)."""

    found: bool
    method: str
    corners: list[list[float]]
    width: int
    height: int


class PageInfo(BaseModel):
    """One page of a document with every image URL the viewer, strip and PDF export need."""

    page_number: int
    original_url: str
    color_url: str
    grayscale_url: str
    bw_url: str
    detection_status: str


class PagesResponse(BaseModel):
    """All pages of a document, in order."""

    document_id: str
    filename: str
    pages: list[PageInfo]
    page: int = Field(default=0, ge=0)


class RotateRequest(BaseModel):
    """Rotate one page clockwise by a multiple of 90 degrees and re-process it."""

    page: int = Field(default=0, ge=0)
    degrees: int = 90


class RenameRequest(BaseModel):
    """New display name for a document."""

    filename: str = Field(min_length=1, max_length=200)


class DetectCornersResponse(BaseModel):
    """Result of running the document-edge detector on a single photo (corners in image pixels)."""

    found: bool
    method: str
    corners: list[list[float]]
    width: int
    height: int


class PageInfo(BaseModel):
    """One page of a document with every image URL the viewer, strip and PDF export need."""

    page_number: int
    original_url: str
    color_url: str
    grayscale_url: str
    bw_url: str
    detection_status: str


class PagesResponse(BaseModel):
    """All pages of a document, in order."""

    document_id: str
    filename: str
    pages: list[PageInfo]


class DIPOperationResponse(BaseModel):
    """A single DIP pipeline step result exposed to the API/frontend."""

    model_config = ConfigDict(from_attributes=True)

    id: str
    operation_name: str
    params: dict[str, Any]
    psnr_before: float
    psnr_after: float
    ssim_before: float
    ssim_after: float
    image_before_url: str
    image_after_url: str
    step_order: int
    timestamp: datetime


class DIPOperationsResponse(BaseModel):
    """All DIP operations executed for a document, plus the three final output-mode images."""

    document_id: str
    original_image_url: str
    original_width: int
    original_height: int
    detected_corners: list[list[float]]
    detection_method: str
    detection_status: str
    page_number: int = 0
    page_count: int = 1
    color_image_url: str
    grayscale_image_url: str
    bw_image_url: str
    operations: list[DIPOperationResponse]


class OCRWordResponse(BaseModel):
    """A single OCR-recognized word/line with bounding box and confidence."""

    text: str
    confidence: float
    bounding_box: list[list[float]]


class OCRResponse(BaseModel):
    """Full OCR extraction result for a document."""

    document_id: str
    raw_text: str
    confidence: float
    word_count: int
    timestamp: datetime


class GraphNode(BaseModel):
    """A single Knowledge Graph node."""

    id: str
    label: str
    type: str
    properties: dict[str, Any] = Field(default_factory=dict)


class GraphEdge(BaseModel):
    """A single Knowledge Graph relationship."""

    source: str
    target: str
    relation: str
    properties: dict[str, Any] = Field(default_factory=dict)


class GraphResponse(BaseModel):
    """Knowledge Graph nodes and edges for a document."""

    document_id: str
    nodes: list[GraphNode]
    edges: list[GraphEdge]


class AgentLogEntry(BaseModel):
    """A single agent decision/action log entry."""

    model_config = ConfigDict(from_attributes=True)

    id: str
    agent_name: str
    action: str
    decision: str | None = None
    reasoning: str | None = None
    timestamp: datetime


class AgentLogResponse(BaseModel):
    """Full agent decision log for a document."""

    document_id: str
    logs: list[AgentLogEntry]


class QueryRequest(BaseModel):
    """A user question, optionally scoped to a specific document."""

    question: str = Field(min_length=1, max_length=2000)
    document_id: str | None = None


class QuerySource(BaseModel):
    """A single retrieved source backing an answer."""

    content: str
    score: float
    source_type: str
    metadata: dict[str, Any] = Field(default_factory=dict)


class QueryResponse(BaseModel):
    """Answer produced by the hybrid graph + vector RAG pipeline."""

    question: str
    answer: str
    sources: list[QuerySource]
    retrieval_strategy: str
    confidence: float
    timestamp: datetime


class ErrorResponse(BaseModel):
    """Standard error envelope returned for all handled exceptions."""

    detail: str
    error_type: str
