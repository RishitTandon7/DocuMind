"""
DIP Agent.

Runs the CamScanner-style DIP pipeline (document detection & cropping,
adaptive enhancement, and the three output modes) over the raw uploaded
photo, persists every step's before/after images and metrics, and returns
the color and grayscale outputs for downstream agents. Accepts optional
user-supplied corners for a manual re-crop, replacing any previous DIP
results for the document.
"""

import asyncio
from dataclasses import dataclass

import numpy as np

from api.routes.websocket import broadcast_agent_event
from db import postgres as db
from dip.dip_pipeline import run_dip_pipeline, run_dip_pipeline_manual
from utils.file_utils import processed_image_path
from utils.image_utils import save_image
from utils.logger import logger


@dataclass
class DIPAgentOutput:
    """The two final DIP output images downstream agents need, plus the detected document outline."""

    color_image: np.ndarray
    grayscale_image: np.ndarray
    corners: list[list[float]]


async def run_dip_agent(
    document_id: str,
    raw_image: np.ndarray,
    manual_corners: list[list[float]] | None = None,
    page_number: int = 0,
    page_count: int = 1,
) -> DIPAgentOutput:
    """Execute the DIP pipeline for one page, persist every step's images and metrics, and return the outputs.

    Any previous results for the page are replaced, so re-crops and rotations never accumulate stale rows.
    """
    logger.info(
        f"[dip_agent] Running DIP pipeline for document {document_id} page {page_number} "
        f"(manual={manual_corners is not None})"
    )
    await db.delete_dip_operations(document_id, page_number)

    if manual_corners is not None:
        pipeline_output = await asyncio.to_thread(run_dip_pipeline_manual, raw_image, manual_corners)
    else:
        pipeline_output = await asyncio.to_thread(run_dip_pipeline, raw_image)

    previous_image = raw_image
    for step_order, step in enumerate(pipeline_output.steps):
        before_path = processed_image_path(document_id, f"p{page_number}_{step_order}_{step.operation_name}_before")
        after_path = processed_image_path(document_id, f"p{page_number}_{step_order}_{step.operation_name}_after")
        save_image(previous_image, before_path)
        save_image(step.processed_image, after_path)

        await db.insert_dip_operation(
            document_id=document_id,
            operation_name=step.operation_name,
            params=step.params_used,
            psnr_before=step.psnr_before,
            psnr_after=step.psnr_after,
            ssim_before=step.ssim_before,
            ssim_after=step.ssim_after,
            image_before_path=str(before_path),
            image_after_path=str(after_path),
            step_order=step_order,
            page_number=page_number,
        )
        previous_image = step.processed_image

    if pipeline_output.detection_method == "manual":
        detection_reasoning = "document cropped using the corners you adjusted"
    elif pipeline_output.detection_found:
        detection_reasoning = (
            f"document located via {pipeline_output.detection_method}, cropped, perspective corrected"
        )
    else:
        detection_reasoning = "Could not find document edges — using full image"
    if page_count > 1:
        detection_reasoning = f"Page {page_number + 1} of {page_count}: {detection_reasoning}"

    await db.insert_agent_log(
        document_id, "DocumentDetectionAgent", "completed", pipeline_output.detection_method, detection_reasoning
    )
    await broadcast_agent_event(
        document_id,
        "DocumentDetectionAgent",
        "completed",
        decision=pipeline_output.detection_method,
        reasoning=detection_reasoning,
    )

    logger.info(
        f"[dip_agent] Completed {len(pipeline_output.steps)} DIP steps for document {document_id} "
        f"(detection method={pipeline_output.detection_method})"
    )
    return DIPAgentOutput(
        color_image=pipeline_output.color_image,
        grayscale_image=pipeline_output.grayscale_image,
        corners=pipeline_output.corners,
    )
