"""
Document routes: upload (single or multi-page), status, per-page and per-stage
result retrieval (DIP, OCR, Knowledge Graph, agent decision log), corner
detection, re-crop, rotate, rename and delete.
"""

import json
import math
import shutil
from pathlib import Path

import cv2
import numpy as np
from fastapi import APIRouter, BackgroundTasks, Form, UploadFile, status
from fastapi.concurrency import run_in_threadpool
from fastapi.exceptions import HTTPException

from agents.supervisor import PageJob, run_pipeline
from config import get_settings
from db import postgres as db
from dip.document_detection import detect_and_crop_document
from graph.neo4j_client import delete_document_graph, get_graph
from models.schemas import (
    AgentLogEntry,
    AgentLogResponse,
    DetectCornersResponse,
    DIPOperationResponse,
    DIPOperationsResponse,
    DocumentLibraryItem,
    DocumentLibraryResponse,
    DocumentListResponse,
    DocumentStatusResponse,
    DocumentSummary,
    GraphEdge,
    GraphNode,
    GraphResponse,
    OCRResponse,
    PageInfo,
    PagesResponse,
    PaginationMeta,
    RecropRequest,
    RenameRequest,
    RotateRequest,
    UploadResponse,
)
from rag.chroma_client import delete_document_chunks
from utils.file_utils import (
    FileTooLargeError,
    UnsupportedFileTypeError,
    generate_document_id,
    page_upload_path,
    persist_upload,
)
from utils.image_utils import load_image, pdf_page_count, pdf_page_to_image, save_image
from utils.logger import logger

OUTPUT_MODE_OPERATIONS = {"output_grayscale", "output_bw"}
IMAGE_SUFFIXES = {".png", ".jpg", ".jpeg", ".bmp", ".tif", ".tiff", ".webp"}

router = APIRouter(prefix="/documents", tags=["documents"])
settings = get_settings()


# ---------------------------------------------------------------------------
#  Helpers
# ---------------------------------------------------------------------------


def _image_url(path: str | None) -> str:
    if not path:
        return ""
    return f"/static/{Path(path).relative_to(settings.storage_root).as_posix()}"


def _thumbnail_url(row: dict) -> str | None:
    """Thumbnail for a list row: the enhanced color output once Tier 0 has run, else the raw upload
    (if it is an image) so a document that was just uploaded already has a preview."""
    if row.get("thumbnail_path"):
        return _image_url(row["thumbnail_path"]) or None
    file_path = row.get("file_path")
    if file_path and Path(file_path).suffix.lower() in IMAGE_SUFFIXES:
        return _image_url(file_path) or None
    return None


def _load_raw_image(file_path: str) -> np.ndarray:
    """Load a stored upload (PDF or image) as a BGR array."""
    path = Path(file_path)
    if path.suffix.lower() == ".pdf":
        return pdf_page_to_image(path, page_number=0)
    return load_image(path)


def _valid_corners(value: object) -> list[list[float]] | None:
    """Return `value` as 4 [x, y] float pairs if it is one, else None."""
    if not isinstance(value, list) or len(value) != 4:
        return None
    try:
        corners = [[float(point[0]), float(point[1])] for point in value]
    except (TypeError, ValueError, IndexError):
        return None
    return corners


def _rotate_image(image: np.ndarray, degrees: int) -> np.ndarray:
    """Rotate an image clockwise by a multiple of 90 degrees."""
    steps = (degrees // 90) % 4
    codes = {1: cv2.ROTATE_90_CLOCKWISE, 2: cv2.ROTATE_180, 3: cv2.ROTATE_90_COUNTERCLOCKWISE}
    return image if steps == 0 else cv2.rotate(image, codes[steps])


def _page_outputs(operations: list[dict]) -> dict[str, str]:
    """Image URLs (original / color / grayscale / bw) for one page's DIP operations."""
    if not operations:
        return {"original": "", "color": "", "grayscale": "", "bw": ""}
    color_op = next(
        (op for op in reversed(operations) if op["operation_name"] not in OUTPUT_MODE_OPERATIONS),
        operations[0],
    )
    grayscale_op = next((op for op in operations if op["operation_name"] == "output_grayscale"), None)
    bw_op = next((op for op in operations if op["operation_name"] == "output_bw"), None)
    return {
        "original": _image_url(operations[0]["image_before_path"]),
        "color": _image_url(color_op["image_after_path"]),
        "grayscale": _image_url(grayscale_op["image_after_path"]) if grayscale_op else "",
        "bw": _image_url(bw_op["image_after_path"]) if bw_op else "",
    }


def _parse_params(op: dict) -> dict:
    return json.loads(op["params"]) if isinstance(op["params"], str) else op["params"]


async def _require_document(document_id: str) -> dict:
    document = await db.get_document(document_id)
    if document is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Document not found")
    return document


def _status_response(document: dict) -> DocumentStatusResponse:
    return DocumentStatusResponse(
        document_id=str(document["id"]),
        filename=document["filename"],
        status=document["status"],
        error_message=document["error_message"],
        upload_time=document["upload_time"],
        completed_time=document["completed_time"],
    )


# ---------------------------------------------------------------------------
#  Upload
# ---------------------------------------------------------------------------


@router.post("/upload-pages", response_model=UploadResponse, status_code=status.HTTP_201_CREATED)
async def upload_pages(
    background_tasks: BackgroundTasks,
    files: list[UploadFile],
    corners: str | None = Form(default=None),
    name: str | None = Form(default=None),
) -> UploadResponse:
    """Create one (possibly multi-page) document from several images/PDFs and start the pipeline.

    Each image is a page; each PDF page becomes a page. `corners` is an optional JSON list aligned with
    `files` holding the user-adjusted document corners (image pixels) or null for auto-detection.
    """
    if not files:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="No files provided")

    corner_hints: list[object] = []
    if corners:
        try:
            parsed = json.loads(corners)
            corner_hints = parsed if isinstance(parsed, list) else []
        except json.JSONDecodeError:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid corners JSON")

    document_id = generate_document_id()
    page_paths: list[str] = []
    page_corners: list[list[list[float]] | None] = []

    try:
        for index, upload in enumerate(files):
            stored = await persist_upload(upload, document_id, tag=f"src{index}")
            if stored.suffix.lower() == ".pdf":
                for pdf_page in range(pdf_page_count(stored)):
                    rendered = page_upload_path(document_id, len(page_paths))
                    save_image(pdf_page_to_image(stored, pdf_page), rendered)
                    page_paths.append(str(rendered))
                    page_corners.append(None)
            else:
                page_paths.append(str(stored))
                hint = corner_hints[index] if index < len(corner_hints) else None
                page_corners.append(_valid_corners(hint))
    except UnsupportedFileTypeError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))
    except FileTooLargeError as exc:
        raise HTTPException(status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE, detail=str(exc))

    first_name = files[0].filename or "unknown"
    display_name = (name or "").strip() or (
        first_name if len(files) == 1 else f"{first_name} (+{len(files) - 1})"
    )

    document = await db.create_document(document_id, display_name, page_paths[0])
    await db.insert_pages(document_id, page_paths)
    logger.info(f"Document {document_id} uploaded: {display_name} ({len(page_paths)} page(s))")

    page_jobs = [
        PageJob(page_number=index, raw_image=load_image(path), corners=page_corners[index])
        for index, path in enumerate(page_paths)
    ]
    background_tasks.add_task(run_pipeline, document_id, page_jobs)

    return UploadResponse(
        document_id=str(document["id"]),
        filename=document["filename"],
        status=document["status"],
        upload_time=document["upload_time"],
        page_count=len(page_paths),
    )


@router.post("/upload", response_model=UploadResponse, status_code=status.HTTP_201_CREATED)
async def upload_document(file: UploadFile, background_tasks: BackgroundTasks) -> UploadResponse:
    """Upload a single document (kept for simple clients); equivalent to a one-file `upload-pages`."""
    return await upload_pages(background_tasks, [file], None, None)


@router.post("/detect-corners", response_model=DetectCornersResponse)
async def detect_corners(file: UploadFile) -> DetectCornersResponse:
    """Run the document-edge detector on one photo and return the corners (image pixels)."""
    data = await file.read()
    image = cv2.imdecode(np.frombuffer(data, np.uint8), cv2.IMREAD_COLOR)
    if image is None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Could not decode image")

    result = await run_in_threadpool(detect_and_crop_document, image)
    height, width = image.shape[:2]
    return DetectCornersResponse(
        found=result.found,
        method=result.method,
        corners=result.corners if result.found else [],
        width=width,
        height=height,
    )


# ---------------------------------------------------------------------------
#  Listing
# ---------------------------------------------------------------------------


@router.get("", response_model=DocumentListResponse)
async def list_documents(limit: int = 8) -> DocumentListResponse:
    """Fetch the most recently uploaded documents, each with a thumbnail if one is available."""
    rows = await db.list_recent_documents(limit=limit)
    return DocumentListResponse(
        documents=[
            DocumentSummary(
                document_id=str(row["id"]),
                filename=row["filename"],
                status=row["status"],
                upload_time=row["upload_time"],
                thumbnail_url=_thumbnail_url(row),
            )
            for row in rows
        ]
    )


@router.get("/all", response_model=DocumentLibraryResponse)
async def list_all_documents(
    page: int = 1, per_page: int = 20, search: str | None = None, status: str | None = None
) -> DocumentLibraryResponse:
    """Fetch a paginated list of all documents with optional search and status filter."""
    offset = (max(1, page) - 1) * per_page
    total_count = await db.count_documents(search=search, status_filter=status)
    rows = await db.list_all_documents(
        offset=offset, limit=per_page, search=search, status_filter=status
    )
    total_pages = max(1, math.ceil(total_count / per_page))

    return DocumentLibraryResponse(
        documents=[
            DocumentLibraryItem(
                document_id=str(row["id"]),
                filename=row["filename"],
                status=row["status"],
                upload_time=row["upload_time"],
                completed_time=row.get("completed_time"),
                thumbnail_url=_thumbnail_url(row),
                word_count=row.get("word_count"),
                error_message=row.get("error_message"),
            )
            for row in rows
        ],
        pagination=PaginationMeta(
            page=max(1, page),
            per_page=per_page,
            total_count=total_count,
            total_pages=total_pages,
        ),
    )


# ---------------------------------------------------------------------------
#  Per-document reads
# ---------------------------------------------------------------------------


@router.get("/{document_id}/status", response_model=DocumentStatusResponse)
async def get_document_status(document_id: str) -> DocumentStatusResponse:
    """Fetch a document's current processing status."""
    return _status_response(await _require_document(document_id))


@router.get("/{document_id}/pages", response_model=PagesResponse)
async def get_document_pages(document_id: str) -> PagesResponse:
    """Fetch every page of a document with its original/color/grayscale/bw image URLs."""
    document = await _require_document(document_id)
    pages = await db.get_pages(document_id)
    all_operations = await db.get_dip_operations(document_id, None)

    result: list[PageInfo] = []
    for page in pages:
        operations = [op for op in all_operations if op["page_number"] == page["page_number"]]
        urls = _page_outputs(operations)
        if not urls["original"] and Path(page["file_path"]).suffix.lower() in IMAGE_SUFFIXES:
            urls["original"] = _image_url(page["file_path"])
        detection_status = ""
        if operations:
            detection_status = "success" if _parse_params(operations[0]).get("found", False) else "fallback"
        result.append(
            PageInfo(
                page_number=page["page_number"],
                original_url=urls["original"],
                color_url=urls["color"],
                grayscale_url=urls["grayscale"],
                bw_url=urls["bw"],
                detection_status=detection_status,
            )
        )
    return PagesResponse(document_id=document_id, filename=document["filename"], pages=result)


@router.get("/{document_id}/dip", response_model=DIPOperationsResponse)
async def get_document_dip(document_id: str, page: int = 0) -> DIPOperationsResponse:
    """Fetch every DIP operation executed for one page of a document, with before/after image URLs and metrics."""
    await _require_document(document_id)
    page_count = len(await db.get_pages(document_id))

    operations = await db.get_dip_operations(document_id, page)
    if not operations:
        return DIPOperationsResponse(
            document_id=document_id,
            original_image_url="",
            original_width=0,
            original_height=0,
            detected_corners=[],
            detection_method="",
            detection_status="",
            page_number=page,
            page_count=page_count,
            color_image_url="",
            grayscale_image_url="",
            bw_image_url="",
            operations=[],
        )

    parsed_params = [_parse_params(op) for op in operations]

    operation_responses = [
        DIPOperationResponse(
            id=str(op["id"]),
            operation_name=op["operation_name"],
            params=params,
            psnr_before=op["psnr_before"],
            psnr_after=op["psnr_after"],
            ssim_before=op["ssim_before"],
            ssim_after=op["ssim_after"],
            image_before_url=_image_url(op["image_before_path"]),
            image_after_url=_image_url(op["image_after_path"]),
            step_order=op["step_order"],
            timestamp=op["timestamp"],
        )
        for op, params in zip(operations, parsed_params)
    ]

    detection_op = operations[0]
    detection_params = parsed_params[0]
    urls = _page_outputs(operations)

    raw_image = load_image(detection_op["image_before_path"])
    original_height, original_width = raw_image.shape[:2]

    detection_found = bool(detection_params.get("found", False))
    # A failed detection has no reliable boundary — report no corners rather than the
    # synthetic full-frame rectangle, so the frontend never draws a false "success" outline.
    detected_corners = detection_params.get("corners", []) if detection_found else []

    return DIPOperationsResponse(
        document_id=document_id,
        original_image_url=urls["original"],
        original_width=original_width,
        original_height=original_height,
        detected_corners=detected_corners,
        detection_method=detection_params.get("method", ""),
        detection_status="success" if detection_found else "fallback",
        page_number=page,
        page_count=page_count,
        color_image_url=urls["color"],
        grayscale_image_url=urls["grayscale"],
        bw_image_url=urls["bw"],
        operations=operation_responses,
    )


# ---------------------------------------------------------------------------
#  Page edits: re-crop, rotate
# ---------------------------------------------------------------------------


async def _get_page(document_id: str, page_number: int) -> dict:
    pages = await db.get_pages(document_id)
    if page_number >= len(pages):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Page not found")
    return pages[page_number]


@router.post("/{document_id}/recrop", response_model=DocumentStatusResponse)
async def recrop_document(
    document_id: str, request: RecropRequest, background_tasks: BackgroundTasks
) -> DocumentStatusResponse:
    """Re-run Tier 0 for one page using user-supplied corners, replacing its previous crop and results."""
    await _require_document(document_id)
    page = await _get_page(document_id, request.page)

    raw_image = _load_raw_image(page["file_path"])
    await db.update_document_status(document_id, "processing_dip")
    background_tasks.add_task(
        run_pipeline, document_id, [PageJob(request.page, raw_image, request.corners)]
    )

    logger.info(f"Manual re-crop requested for document {document_id} page {request.page}: corners={request.corners}")
    return _status_response(await db.get_document(document_id))


@router.post("/{document_id}/rotate", response_model=DocumentStatusResponse)
async def rotate_page(
    document_id: str, request: RotateRequest, background_tasks: BackgroundTasks
) -> DocumentStatusResponse:
    """Rotate one page's source photo clockwise by a multiple of 90° and re-run Tier 0 for it.

    A previously found/adjusted crop is carried through the rotation so the user's corners survive.
    """
    if request.degrees % 90 != 0:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Rotation must be a multiple of 90°")
    await _require_document(document_id)
    page = await _get_page(document_id, request.page)
    page_path = Path(page["file_path"])
    if page_path.suffix.lower() == ".pdf":
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="This page can't be rotated")

    raw_image = load_image(page_path)
    height, width = raw_image.shape[:2]

    previous_corners: list[list[float]] | None = None
    operations = await db.get_dip_operations(document_id, request.page)
    if operations:
        params = _parse_params(operations[0])
        if params.get("found"):
            previous_corners = _valid_corners(params.get("corners"))

    rotated = _rotate_image(raw_image, request.degrees)
    save_image(rotated, page_path)

    new_corners = None
    if previous_corners is not None:
        current_height, current_width = height, width
        new_corners = previous_corners
        for _ in range((request.degrees // 90) % 4):
            new_corners = [[current_height - 1 - y, x] for x, y in new_corners]
            current_height, current_width = current_width, current_height

    await db.update_document_status(document_id, "processing_dip")
    background_tasks.add_task(run_pipeline, document_id, [PageJob(request.page, rotated, new_corners)])
    logger.info(f"Rotate {request.degrees}° requested for document {document_id} page {request.page}")
    return _status_response(await db.get_document(document_id))


# ---------------------------------------------------------------------------
#  Rename / delete
# ---------------------------------------------------------------------------


@router.patch("/{document_id}", response_model=DocumentStatusResponse)
async def rename_document(document_id: str, request: RenameRequest) -> DocumentStatusResponse:
    """Rename a document."""
    updated = await db.update_document_filename(document_id, request.filename.strip())
    if updated is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Document not found")
    return _status_response(updated)


@router.delete("/{document_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_document(document_id: str) -> None:
    """Delete a document and everything derived from it (rows, files, vector chunks, graph)."""
    document = await _require_document(document_id)
    pages = await db.get_pages(document_id)

    await db.delete_document(document_id)

    # Index/graph cleanup must never block deleting the document itself.
    try:
        await run_in_threadpool(delete_document_chunks, document_id)
    except Exception as exc:
        logger.warning(f"Vector cleanup failed for document {document_id}: {exc}")
    try:
        await delete_document_graph(document_id)
    except Exception as exc:
        logger.warning(f"Graph cleanup failed for document {document_id}: {exc}")

    for path in {document["file_path"], *(page["file_path"] for page in pages)}:
        Path(path).unlink(missing_ok=True)
    for source in Path(settings.upload_dir).glob(f"{document_id}_src*"):
        source.unlink(missing_ok=True)
    shutil.rmtree(Path(settings.processed_dir) / document_id, ignore_errors=True)
    logger.info(f"Document {document_id} deleted")


# ---------------------------------------------------------------------------
#  Stage results
# ---------------------------------------------------------------------------


@router.get("/{document_id}/ocr", response_model=OCRResponse)
async def get_document_ocr(document_id: str) -> OCRResponse:
    """Fetch the OCR extraction result for a document."""
    await _require_document(document_id)

    ocr_result = await db.get_ocr_result(document_id)
    if ocr_result is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="OCR result not yet available")

    return OCRResponse(
        document_id=document_id,
        raw_text=ocr_result["raw_text"],
        confidence=ocr_result["confidence"],
        word_count=ocr_result["word_count"],
        timestamp=ocr_result["timestamp"],
    )


@router.get("/{document_id}/graph", response_model=GraphResponse)
async def get_document_graph(document_id: str) -> GraphResponse:
    """Fetch the Knowledge Graph nodes and edges extracted for a document."""
    await _require_document(document_id)

    nodes, edges = await get_graph(document_id)
    return GraphResponse(
        document_id=document_id,
        nodes=[GraphNode(id=n["id"], label=n["label"], type=n["type"]) for n in nodes],
        edges=[GraphEdge(source=e["source"], target=e["target"], relation=e["relation"]) for e in edges],
    )


@router.get("/{document_id}/agents-log", response_model=AgentLogResponse)
async def get_document_agents_log(document_id: str) -> AgentLogResponse:
    """Fetch the full agent decision log for a document."""
    await _require_document(document_id)

    logs = await db.get_agent_logs(document_id)
    return AgentLogResponse(
        document_id=document_id,
        logs=[
            AgentLogEntry(
                id=str(log["id"]),
                agent_name=log["agent_name"],
                action=log["action"],
                decision=log["decision"],
                reasoning=log["reasoning"],
                timestamp=log["timestamp"],
            )
            for log in logs
        ],
    )
