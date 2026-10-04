"""
Objective image quality metrics used to quantify what each DIP operation
actually accomplished.

- PSNR (Peak Signal-to-Noise Ratio): measures pixel-level fidelity between
  two images in decibels. Higher is closer/less distorted. Used here to
  compare a processing step's output against the original raw scan, so we
  can show whether an operation moved the image closer to (or further from)
  a clean reference.
- SSIM (Structural Similarity Index): measures perceptual/structural
  similarity (luminance, contrast, structure) between two images, in
  [-1, 1] where 1 is identical. More aligned with human perception than
  PSNR because it is sensitive to structural distortions, not just raw
  pixel differences.
- Blur score: variance of the Laplacian. A sharp, in-focus image has many
  high-frequency edges, producing high variance after a second-derivative
  (Laplacian) filter; a blurry image is dominated by low frequencies and
  yields low variance. Low score => blurry image.
- Noise estimate: uses the median absolute deviation of the high-frequency
  wavelet-like residual (image minus a heavily blurred version of itself)
  as a robust estimator of additive Gaussian noise sigma.
- Contrast score: standard deviation of grayscale pixel intensities. A flat,
  washed-out or low-light document has pixel values clustered near a single
  level (low std dev); a well-lit, high-contrast one spreads across the
  range (high std dev).
"""

from dataclasses import dataclass

import cv2
import numpy as np
from skimage.metrics import peak_signal_noise_ratio, structural_similarity

from utils.image_utils import to_grayscale


@dataclass(frozen=True)
class QualityMetrics:
    """Bundle of objective quality scores computed for a single image."""

    blur_score: float
    noise_score: float


def compute_psnr(reference: np.ndarray, target: np.ndarray) -> float:
    """Compute PSNR (dB) between a reference image and a target image."""
    ref_gray = to_grayscale(reference)
    tgt_gray = to_grayscale(target)
    if ref_gray.shape != tgt_gray.shape:
        tgt_gray = cv2.resize(tgt_gray, (ref_gray.shape[1], ref_gray.shape[0]))
    if np.array_equal(ref_gray, tgt_gray):
        return 100.0
    return float(peak_signal_noise_ratio(ref_gray, tgt_gray, data_range=255))


def compute_ssim(reference: np.ndarray, target: np.ndarray) -> float:
    """Compute SSIM between a reference image and a target image."""
    ref_gray = to_grayscale(reference)
    tgt_gray = to_grayscale(target)
    if ref_gray.shape != tgt_gray.shape:
        tgt_gray = cv2.resize(tgt_gray, (ref_gray.shape[1], ref_gray.shape[0]))
    return float(structural_similarity(ref_gray, tgt_gray, data_range=255))


def compute_blur_score(image: np.ndarray) -> float:
    """Estimate sharpness via the variance of the Laplacian (higher = sharper)."""
    gray = to_grayscale(image)
    laplacian = cv2.Laplacian(gray, cv2.CV_64F)
    return float(laplacian.var())


def compute_noise_score(image: np.ndarray) -> float:
    """Estimate additive noise sigma via median absolute deviation of a high-pass residual."""
    gray = to_grayscale(image).astype(np.float64)
    blurred = cv2.GaussianBlur(gray, (7, 7), sigmaX=1.5)
    residual = gray - blurred
    mad = np.median(np.abs(residual - np.median(residual)))
    sigma = mad / 0.6745
    return float(sigma)


def compute_contrast_score(image: np.ndarray) -> float:
    """Estimate contrast via the standard deviation of grayscale pixel intensities (higher = more contrast)."""
    gray = to_grayscale(image)
    return float(gray.std())


def compute_quality_metrics(image: np.ndarray) -> QualityMetrics:
    """Compute the full set of standalone (no-reference) quality metrics for an image."""
    return QualityMetrics(
        blur_score=compute_blur_score(image),
        noise_score=compute_noise_score(image),
    )
