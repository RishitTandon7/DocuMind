"""
Edge detection operators.

- Sobel: approximates the image gradient in x and y directions using two
  3x3 separable kernels, highlighting intensity discontinuities. The
  gradient magnitude sqrt(Gx^2 + Gy^2) responds to edges but is sensitive
  to noise and produces thick, unthinned edges.
- Canny: a multi-stage detector (Gaussian smoothing, Sobel gradients,
  non-maximum suppression to thin edges down to one-pixel width, then
  double-thresholding with hysteresis to link weak edges to strong ones).
  Produces cleaner, thinner edge maps than raw Sobel and is what the
  deskew/perspective steps rely on internally.

Both are exposed here as standalone diagnostic/visualization operations so
the frontend can show the user exactly what structure the pipeline is
detecting in a document.
"""

from typing import Any

import cv2
import numpy as np

from dip.result import DIPResult, build_result
from utils.image_utils import to_bgr, to_grayscale
from utils.logger import logger


def apply_canny(
    image: np.ndarray,
    reference_image: np.ndarray | None = None,
    low_threshold: int = 50,
    high_threshold: int = 150,
) -> DIPResult:
    """Detect edges using the Canny multi-stage edge detector."""
    reference_image = reference_image if reference_image is not None else image
    gray = to_grayscale(image)
    edges = cv2.Canny(gray, low_threshold, high_threshold)
    processed = to_bgr(edges) if image.ndim == 3 else edges
    logger.debug(f"Applied Canny edge detection low={low_threshold} high={high_threshold}")
    params: dict[str, Any] = {"low_threshold": low_threshold, "high_threshold": high_threshold}
    return build_result(reference_image, image, processed, "canny_edge_detection", params)


def apply_sobel(
    image: np.ndarray,
    reference_image: np.ndarray | None = None,
    kernel_size: int = 3,
) -> DIPResult:
    """Detect edges using the Sobel gradient magnitude operator."""
    reference_image = reference_image if reference_image is not None else image
    gray = to_grayscale(image)
    grad_x = cv2.Sobel(gray, cv2.CV_64F, 1, 0, ksize=kernel_size)
    grad_y = cv2.Sobel(gray, cv2.CV_64F, 0, 1, ksize=kernel_size)
    magnitude = np.sqrt(grad_x**2 + grad_y**2)
    magnitude = np.clip(magnitude / (magnitude.max() + 1e-8) * 255, 0, 255).astype(np.uint8)
    processed = to_bgr(magnitude) if image.ndim == 3 else magnitude
    logger.debug(f"Applied Sobel edge detection kernel_size={kernel_size}")
    params: dict[str, Any] = {"kernel_size": kernel_size}
    return build_result(reference_image, image, processed, "sobel_edge_detection", params)
