"""
Noise-reduction filters.

- Gaussian filter: convolves the image with a 2D Gaussian kernel, which is a
  low-pass filter that attenuates high-frequency noise by weighted local
  averaging. Effective against Gaussian (sensor) noise but blurs edges
  because it treats edges as high-frequency content too.
- Median filter: replaces each pixel with the median of its neighborhood.
  Nonlinear, so it removes impulsive/salt-and-pepper noise (common in poor
  scans) without the strong edge-smoothing side effect of a linear filter.
- Bilateral filter: a Gaussian filter in the spatial domain combined with a
  second Gaussian in the intensity domain, so it only averages pixels that
  are both spatially close AND photometrically similar. This achieves
  edge-preserving smoothing — noise in flat regions is removed while text
  edges stay sharp, which is exactly what OCR pipelines need.
"""

from typing import Any

import cv2
import numpy as np

from dip.result import DIPResult, build_result
from utils.logger import logger


def apply_gaussian_filter(
    image: np.ndarray,
    reference_image: np.ndarray | None = None,
    kernel_size: int = 5,
    sigma_x: float = 1.0,
) -> DIPResult:
    """Apply a Gaussian blur to suppress high-frequency sensor noise."""
    reference_image = reference_image if reference_image is not None else image
    if kernel_size % 2 == 0:
        kernel_size += 1
    processed = cv2.GaussianBlur(image, (kernel_size, kernel_size), sigmaX=sigma_x)
    logger.debug(f"Applied Gaussian filter kernel={kernel_size} sigma_x={sigma_x}")
    params: dict[str, Any] = {"kernel_size": kernel_size, "sigma_x": sigma_x}
    return build_result(reference_image, image, processed, "gaussian_filter", params)


def apply_median_filter(
    image: np.ndarray,
    reference_image: np.ndarray | None = None,
    kernel_size: int = 5,
) -> DIPResult:
    """Apply a median filter to remove salt-and-pepper / impulsive noise."""
    reference_image = reference_image if reference_image is not None else image
    if kernel_size % 2 == 0:
        kernel_size += 1
    processed = cv2.medianBlur(image, kernel_size)
    logger.debug(f"Applied median filter kernel={kernel_size}")
    params = {"kernel_size": kernel_size}
    return build_result(reference_image, image, processed, "median_filter", params)


def apply_bilateral_filter(
    image: np.ndarray,
    reference_image: np.ndarray | None = None,
    diameter: int = 9,
    sigma_color: float = 75.0,
    sigma_space: float = 75.0,
) -> DIPResult:
    """Apply an edge-preserving bilateral filter to denoise flat regions while keeping text edges sharp."""
    reference_image = reference_image if reference_image is not None else image
    processed = cv2.bilateralFilter(image, diameter, sigma_color, sigma_space)
    logger.debug(
        f"Applied bilateral filter diameter={diameter} sigma_color={sigma_color} sigma_space={sigma_space}"
    )
    params = {"diameter": diameter, "sigma_color": sigma_color, "sigma_space": sigma_space}
    return build_result(reference_image, image, processed, "bilateral_filter", params)
