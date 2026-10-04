"""
Frequency-domain processing using the Discrete Fourier Transform (DFT) and
Discrete Cosine Transform (DCT).

- DFT low-pass filtering: transforms the image into the frequency domain,
  where document noise and fine sensor grain live in the high-frequency
  components far from the spectrum's center. Masking those out with a
  circular low-pass filter and inverting the transform suppresses
  high-frequency noise while preserving the low-frequency structure
  (overall shapes, large strokes) of the document.
- DCT denoising: the DCT concentrates most of an image's energy into a
  small number of low-frequency coefficients (the same principle JPEG
  compression exploits). Zeroing out coefficients below an energy
  threshold discards low-energy high-frequency content — typically noise —
  while reconstructing an image close to the original from the retained
  coefficients.
"""

from typing import Any

import cv2
import numpy as np

from dip.result import DIPResult, build_result
from utils.image_utils import ensure_uint8, to_bgr, to_grayscale
from utils.logger import logger


def apply_dft_lowpass(
    image: np.ndarray,
    reference_image: np.ndarray | None = None,
    cutoff_ratio: float = 0.5,
) -> DIPResult:
    """Suppress high-frequency noise via a circular low-pass mask in the DFT domain."""
    reference_image = reference_image if reference_image is not None else image
    gray = to_grayscale(image).astype(np.float32)

    dft = cv2.dft(gray, flags=cv2.DFT_COMPLEX_OUTPUT)
    dft_shifted = np.fft.fftshift(dft)

    rows, cols = gray.shape
    center_row, center_col = rows // 2, cols // 2
    radius = int(min(center_row, center_col) * cutoff_ratio)

    mask = np.zeros((rows, cols, 2), np.uint8)
    y_grid, x_grid = np.ogrid[:rows, :cols]
    distance = (y_grid - center_row) ** 2 + (x_grid - center_col) ** 2
    mask[distance <= radius**2] = 1

    filtered = dft_shifted * mask
    unshifted = np.fft.ifftshift(filtered)
    reconstructed = cv2.idft(unshifted)
    magnitude = cv2.magnitude(reconstructed[:, :, 0], reconstructed[:, :, 1])
    normalized = cv2.normalize(magnitude, None, 0, 255, cv2.NORM_MINMAX)
    processed = ensure_uint8(normalized)
    processed = to_bgr(processed) if image.ndim == 3 else processed

    logger.debug(f"Applied DFT low-pass filter cutoff_ratio={cutoff_ratio}")
    params: dict[str, Any] = {"cutoff_ratio": cutoff_ratio}
    return build_result(reference_image, image, processed, "dft_lowpass", params)


def apply_dct_denoise(
    image: np.ndarray,
    reference_image: np.ndarray | None = None,
    keep_ratio: float = 0.5,
) -> DIPResult:
    """Denoise by zeroing low-energy high-frequency DCT coefficients, then reconstructing."""
    reference_image = reference_image if reference_image is not None else image
    gray = to_grayscale(image).astype(np.float32)

    # DCT requires even dimensions; pad if necessary and crop back afterward.
    rows, cols = gray.shape
    pad_rows = rows % 2
    pad_cols = cols % 2
    padded = np.pad(gray, ((0, pad_rows), (0, pad_cols)), mode="edge")

    dct_coeffs = cv2.dct(padded)

    keep_rows = max(1, int(dct_coeffs.shape[0] * keep_ratio))
    keep_cols = max(1, int(dct_coeffs.shape[1] * keep_ratio))
    mask = np.zeros_like(dct_coeffs)
    mask[:keep_rows, :keep_cols] = 1.0
    filtered_coeffs = dct_coeffs * mask

    reconstructed = cv2.idct(filtered_coeffs)
    reconstructed = reconstructed[:rows, :cols]
    normalized = cv2.normalize(reconstructed, None, 0, 255, cv2.NORM_MINMAX)
    processed = ensure_uint8(normalized)
    processed = to_bgr(processed) if image.ndim == 3 else processed

    logger.debug(f"Applied DCT denoise keep_ratio={keep_ratio}")
    params: dict[str, Any] = {"keep_ratio": keep_ratio}
    return build_result(reference_image, image, processed, "dct_denoise", params)
