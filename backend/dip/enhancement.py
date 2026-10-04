"""
Contrast and illumination enhancement.

- Histogram equalization: redistributes pixel intensities so the cumulative
  distribution function is approximately linear, spreading out the most
  frequent intensity values. This globally maximizes contrast but can
  over-amplify noise and wash out local detail because it applies one
  transform to the whole image.
- CLAHE (Contrast Limited Adaptive Histogram Equalization): divides the
  image into small tiles and equalizes each tile's histogram independently,
  which adapts to local lighting variation common in scanned/photographed
  documents (shadows, uneven illumination). The "contrast limited" clip
  prevents the noise over-amplification that plain adaptive histogram
  equalization would cause in near-uniform regions.
- Color-preserving CLAHE: applies the same local contrast boost only to the
  L (lightness) channel of the LAB color space, leaving the A/B chroma
  channels untouched, so contrast improves without desaturating or
  discoloring the document — used for the "Color" output mode, where plain
  grayscale CLAHE would destroy natural color.
- Unsharp masking: subtracts a heavily blurred copy of the image from
  itself (scaled by `amount`) and adds the result back on top, amplifying
  high-frequency edge detail that a Gaussian blur removed. This is the
  classic photographic sharpening technique — it does not add new detail,
  it just increases local contrast at edges to make existing detail read
  as sharper.
"""

from typing import Any

import cv2
import numpy as np

from dip.result import DIPResult, build_result
from utils.image_utils import ensure_uint8, to_grayscale
from utils.logger import logger


def apply_histogram_equalization(
    image: np.ndarray,
    reference_image: np.ndarray | None = None,
) -> DIPResult:
    """Apply global histogram equalization to maximize overall contrast."""
    reference_image = reference_image if reference_image is not None else image
    gray = to_grayscale(image)
    processed = cv2.equalizeHist(gray)
    if image.ndim == 3:
        processed = cv2.cvtColor(processed, cv2.COLOR_GRAY2BGR)
    logger.debug("Applied global histogram equalization")
    return build_result(reference_image, image, processed, "histogram_equalization", {})


def apply_clahe(
    image: np.ndarray,
    reference_image: np.ndarray | None = None,
    clip_limit: float = 2.0,
    tile_grid_size: int = 8,
) -> DIPResult:
    """Apply Contrast Limited Adaptive Histogram Equalization for local, illumination-robust contrast."""
    reference_image = reference_image if reference_image is not None else image
    gray = to_grayscale(image)
    clahe = cv2.createCLAHE(clipLimit=clip_limit, tileGridSize=(tile_grid_size, tile_grid_size))
    processed = clahe.apply(gray)
    if image.ndim == 3:
        processed = cv2.cvtColor(processed, cv2.COLOR_GRAY2BGR)
    logger.debug(f"Applied CLAHE clip_limit={clip_limit} tile_grid_size={tile_grid_size}")
    params: dict[str, Any] = {"clip_limit": clip_limit, "tile_grid_size": tile_grid_size}
    return build_result(reference_image, image, processed, "clahe", params)


def apply_clahe_color(
    image: np.ndarray,
    reference_image: np.ndarray | None = None,
    clip_limit: float = 2.0,
    tile_grid_size: int = 8,
) -> DIPResult:
    """Apply CLAHE to the LAB lightness channel only, boosting contrast while preserving natural color."""
    reference_image = reference_image if reference_image is not None else image
    lab = cv2.cvtColor(image, cv2.COLOR_BGR2LAB)
    l_channel, a_channel, b_channel = cv2.split(lab)
    clahe = cv2.createCLAHE(clipLimit=clip_limit, tileGridSize=(tile_grid_size, tile_grid_size))
    l_enhanced = clahe.apply(l_channel)
    processed = cv2.cvtColor(cv2.merge((l_enhanced, a_channel, b_channel)), cv2.COLOR_LAB2BGR)
    logger.debug(f"Applied color-preserving CLAHE clip_limit={clip_limit} tile_grid_size={tile_grid_size}")
    params: dict[str, Any] = {"clip_limit": clip_limit, "tile_grid_size": tile_grid_size}
    return build_result(reference_image, image, processed, "clahe_color", params)


def apply_unsharp_mask(
    image: np.ndarray,
    reference_image: np.ndarray | None = None,
    amount: float = 0.5,
    sigma: float = 3.0,
) -> DIPResult:
    """Sharpen the image via unsharp masking: amplify the high-frequency residual against a blurred copy."""
    reference_image = reference_image if reference_image is not None else image
    blurred = cv2.GaussianBlur(image, (0, 0), sigmaX=sigma)
    sharpened = cv2.addWeighted(image, 1.0 + amount, blurred, -amount, 0)
    processed = ensure_uint8(sharpened)
    logger.debug(f"Applied unsharp mask amount={amount} sigma={sigma}")
    params: dict[str, Any] = {"amount": amount, "sigma": sigma}
    return build_result(reference_image, image, processed, "unsharp_mask", params)
