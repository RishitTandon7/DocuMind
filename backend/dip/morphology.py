"""
Morphological operations on binarized document images.

- Erosion: slides a structuring element over the image and keeps a
  foreground pixel only if the element fits entirely within the
  foreground, shrinking bright regions — removes small white noise
  speckles left over after thresholding.
- Dilation: the dual of erosion; a pixel becomes foreground if the
  structuring element touches any foreground pixel, growing bright
  regions — useful for reconnecting broken character strokes.
- Opening (erosion then dilation): removes small isolated noise blobs
  while approximately preserving the size/shape of larger foreground
  structures like text glyphs.
- Closing (dilation then erosion): fills small holes and gaps inside
  foreground regions (e.g. broken strokes in degraded scans) without
  significantly growing the overall structure.
"""

from typing import Any

import cv2
import numpy as np

from dip.result import DIPResult, build_result
from utils.logger import logger


def _get_kernel(kernel_size: int) -> np.ndarray:
    return cv2.getStructuringElement(cv2.MORPH_RECT, (kernel_size, kernel_size))


def apply_erosion(
    image: np.ndarray,
    reference_image: np.ndarray | None = None,
    kernel_size: int = 2,
    iterations: int = 1,
) -> DIPResult:
    """Erode bright regions to remove small white noise speckles."""
    reference_image = reference_image if reference_image is not None else image
    kernel = _get_kernel(kernel_size)
    processed = cv2.erode(image, kernel, iterations=iterations)
    logger.debug(f"Applied erosion kernel_size={kernel_size} iterations={iterations}")
    params: dict[str, Any] = {"kernel_size": kernel_size, "iterations": iterations}
    return build_result(reference_image, image, processed, "erosion", params)


def apply_dilation(
    image: np.ndarray,
    reference_image: np.ndarray | None = None,
    kernel_size: int = 2,
    iterations: int = 1,
) -> DIPResult:
    """Dilate bright regions to reconnect broken character strokes."""
    reference_image = reference_image if reference_image is not None else image
    kernel = _get_kernel(kernel_size)
    processed = cv2.dilate(image, kernel, iterations=iterations)
    logger.debug(f"Applied dilation kernel_size={kernel_size} iterations={iterations}")
    params: dict[str, Any] = {"kernel_size": kernel_size, "iterations": iterations}
    return build_result(reference_image, image, processed, "dilation", params)


def apply_opening(
    image: np.ndarray,
    reference_image: np.ndarray | None = None,
    kernel_size: int = 2,
) -> DIPResult:
    """Apply morphological opening (erosion then dilation) to remove small noise blobs."""
    reference_image = reference_image if reference_image is not None else image
    kernel = _get_kernel(kernel_size)
    processed = cv2.morphologyEx(image, cv2.MORPH_OPEN, kernel)
    logger.debug(f"Applied opening kernel_size={kernel_size}")
    params: dict[str, Any] = {"kernel_size": kernel_size}
    return build_result(reference_image, image, processed, "opening", params)


def apply_closing(
    image: np.ndarray,
    reference_image: np.ndarray | None = None,
    kernel_size: int = 2,
) -> DIPResult:
    """Apply morphological closing (dilation then erosion) to fill small gaps in strokes."""
    reference_image = reference_image if reference_image is not None else image
    kernel = _get_kernel(kernel_size)
    processed = cv2.morphologyEx(image, cv2.MORPH_CLOSE, kernel)
    logger.debug(f"Applied closing kernel_size={kernel_size}")
    params: dict[str, Any] = {"kernel_size": kernel_size}
    return build_result(reference_image, image, processed, "closing", params)
