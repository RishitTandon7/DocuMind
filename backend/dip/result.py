"""
Shared typed result contract for every DIP operation.

Every function in the `dip` package returns a `DIPResult` so that callers
(the fixed pipeline, the API layer, and the frontend) always receive the
processed image alongside the operation's name, the parameters used, and
objective before/after quality measurements — never a bare image array.
"""

from dataclasses import dataclass, field
from typing import Any

import numpy as np

from dip.quality_metrics import compute_psnr, compute_ssim


@dataclass
class DIPResult:
    """Result of a single Digital Image Processing operation."""

    processed_image: np.ndarray
    operation_name: str
    params_used: dict[str, Any] = field(default_factory=dict)
    psnr_before: float = 0.0
    psnr_after: float = 0.0
    ssim_before: float = 0.0
    ssim_after: float = 0.0

    class Config:
        arbitrary_types_allowed = True


def build_result(
    reference_image: np.ndarray,
    input_image: np.ndarray,
    processed_image: np.ndarray,
    operation_name: str,
    params_used: dict[str, Any],
) -> DIPResult:
    """
    Construct a DIPResult, computing PSNR/SSIM of the input and output images
    against a fixed reference (typically the original raw scan) so the
    pipeline can show whether an operation improved fidelity.
    """
    return DIPResult(
        processed_image=processed_image,
        operation_name=operation_name,
        params_used=params_used,
        psnr_before=compute_psnr(reference_image, input_image),
        psnr_after=compute_psnr(reference_image, processed_image),
        ssim_before=compute_ssim(reference_image, input_image),
        ssim_after=compute_ssim(reference_image, processed_image),
    )
