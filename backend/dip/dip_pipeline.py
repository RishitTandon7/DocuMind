"""
CamScanner-style adaptive DIP pipeline.

Stage 1 (always runs first): detect and crop the physical document
boundary out of a raw photo, which may include background such as a desk
or bedsheet, then straighten it via perspective transform
(`dip.document_detection`). Every later stage operates only on this crop —
background texture never reaches enhancement or OCR again.

Stage 2: adaptively enhance the cropped document. Each candidate operation
(denoise, contrast, sharpen) is only attempted if a no-reference quality
metric indicates it is needed, and is only kept if it measurably improves
that metric; an operation that makes things worse is reverted to the
previous image and logged, so a degraded step is never shipped.

Stage 3: three output modes are produced from the enhanced crop — Color
(the enhanced crop itself, natural colors, the default), Grayscale (crop +
CLAHE, used for OCR), and a B&W "scan look" (Sauvola local thresholding).
Thresholding is an output mode only: it is never fed into OCR and never
PSNR/SSIM-scored, since binarization is an intentional drastic transform
that fidelity metrics would always flag as "worse".
"""

from dataclasses import dataclass, field

import numpy as np

from dip.document_detection import detect_and_crop_document, warp_document
from dip.enhancement import apply_clahe, apply_clahe_color, apply_unsharp_mask
from dip.filters import apply_bilateral_filter, apply_median_filter
from dip.geometry import binarize_scan
from dip.quality_metrics import compute_blur_score, compute_contrast_score, compute_noise_score
from dip.result import DIPResult, build_result
from utils.image_utils import to_bgr, to_grayscale
from utils.logger import logger

NOISE_LIGHT_THRESHOLD = 6.0
NOISE_SEVERE_THRESHOLD = 15.0
CONTRAST_LOW_THRESHOLD = 45.0
BLUR_MODERATE_THRESHOLD = 150.0


@dataclass
class DIPPipelineOutput:
    """Full output of the DIP pipeline: every persisted step plus the three final output-mode images."""

    steps: list[DIPResult] = field(default_factory=list)
    color_image: np.ndarray | None = None
    grayscale_image: np.ndarray | None = None
    bw_image: np.ndarray | None = None
    corners: list[list[float]] = field(default_factory=list)
    detection_method: str = "contour"
    detection_found: bool = True


def _gate(
    candidate: DIPResult,
    current_image: np.ndarray,
    metric_before: float,
    metric_after: float,
    higher_is_better: bool,
) -> tuple[DIPResult, np.ndarray]:
    """Keep a candidate step only if it improves its no-reference quality metric; otherwise revert it."""
    improved = metric_after > metric_before if higher_is_better else metric_after < metric_before
    if improved:
        return candidate, candidate.processed_image

    logger.warning(
        f"{candidate.operation_name} reverted — degraded quality "
        f"(metric before={metric_before:.3f}, after={metric_after:.3f})"
    )
    reverted_params = dict(candidate.params_used)
    reverted_params.update({"reverted": True, "reason": "degraded quality metric; kept previous image"})
    reverted = DIPResult(
        processed_image=current_image,
        operation_name=candidate.operation_name,
        params_used=reverted_params,
        psnr_before=candidate.psnr_before,
        psnr_after=candidate.psnr_before,
        ssim_before=candidate.ssim_before,
        ssim_after=candidate.ssim_before,
    )
    return reverted, current_image


def _run_from_crop(
    raw_image: np.ndarray, crop: np.ndarray, corners: list[list[float]], method: str, found: bool
) -> DIPPipelineOutput:
    """Shared core: given an already-cropped document, run adaptive enhancement and the output modes."""
    detection_step = build_result(
        raw_image,
        raw_image,
        crop,
        "document_detection",
        {"method": method, "found": found, "corners": corners},
    )

    steps: list[DIPResult] = [detection_step]
    current = crop

    # --- Stage 2: adaptive enhancement, each step gated on real improvement ---

    noise_before = compute_noise_score(current)
    if noise_before >= NOISE_LIGHT_THRESHOLD:
        if noise_before >= NOISE_SEVERE_THRESHOLD:
            candidate = apply_median_filter(current, reference_image=crop, kernel_size=5)
        else:
            candidate = apply_bilateral_filter(
                current, reference_image=crop, diameter=9, sigma_color=60.0, sigma_space=60.0
            )
        noise_after = compute_noise_score(candidate.processed_image)
        result, current = _gate(candidate, current, noise_before, noise_after, higher_is_better=False)
        steps.append(result)

    contrast_before = compute_contrast_score(current)
    if contrast_before < CONTRAST_LOW_THRESHOLD:
        candidate = apply_clahe_color(current, reference_image=crop, clip_limit=2.0, tile_grid_size=8)
        contrast_after = compute_contrast_score(candidate.processed_image)
        result, current = _gate(candidate, current, contrast_before, contrast_after, higher_is_better=True)
        steps.append(result)

    blur_before = compute_blur_score(current)
    if blur_before < BLUR_MODERATE_THRESHOLD:
        candidate = apply_unsharp_mask(current, reference_image=crop, amount=0.5, sigma=3.0)
        blur_after = compute_blur_score(candidate.processed_image)
        result, current = _gate(candidate, current, blur_before, blur_after, higher_is_better=True)
        steps.append(result)

    color_image = current

    # --- Stage 3: output modes ---

    gray_reference = to_bgr(to_grayscale(crop))
    grayscale_result = apply_clahe(
        to_bgr(to_grayscale(color_image)), reference_image=gray_reference, clip_limit=2.0, tile_grid_size=8
    )
    grayscale_result.operation_name = "output_grayscale"
    grayscale_result.params_used["output_mode"] = True
    steps.append(grayscale_result)
    grayscale_image = grayscale_result.processed_image

    bw_array = binarize_scan(grayscale_image, window_size=51, k=0.2)
    bw_image = to_bgr(bw_array)
    steps.append(
        DIPResult(
            processed_image=bw_image,
            operation_name="output_bw",
            params_used={
                "output_mode": True,
                "method": "sauvola",
                "window_size": 51,
                "k": 0.2,
                "scored": False,
                "reason": "Output mode only — never fed into OCR or PSNR/SSIM-scored",
            },
            psnr_before=0.0,
            psnr_after=0.0,
            ssim_before=0.0,
            ssim_after=0.0,
        )
    )

    logger.info(f"DIP pipeline complete: {len(steps)} steps, detection method={method}, found={found}")
    return DIPPipelineOutput(
        steps=steps,
        color_image=color_image,
        grayscale_image=grayscale_image,
        bw_image=bw_image,
        corners=corners,
        detection_method=method,
        detection_found=found,
    )


def run_dip_pipeline(raw_image: np.ndarray) -> DIPPipelineOutput:
    """Run the full pipeline: auto-detect+crop, adaptively enhance, then produce the three output modes."""
    logger.info("Starting DIP pipeline")
    detection = detect_and_crop_document(raw_image)
    return _run_from_crop(raw_image, detection.cropped_image, detection.corners, detection.method, detection.found)


def run_dip_pipeline_manual(raw_image: np.ndarray, corners: list[list[float]]) -> DIPPipelineOutput:
    """Run the pipeline using user-supplied corners instead of auto-detection (manual re-crop)."""
    logger.info(f"Starting DIP pipeline with manual corners: {corners}")
    crop = warp_document(raw_image, corners)
    return _run_from_crop(raw_image, crop, corners, "manual", True)
