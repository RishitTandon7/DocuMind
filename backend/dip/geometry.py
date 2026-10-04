"""
Geometric correction: deskewing and perspective/threshold normalization.

- Deskew via Hough transform: Canny edge detection finds strong gradients
  (text line boundaries), then the probabilistic Hough transform fits
  straight lines through those edge points. The median angle of
  near-horizontal detected lines approximates the document's skew, which we
  then correct with an affine rotation — critical because OCR engines
  assume roughly horizontal text lines.
- Perspective correction: detects the largest quadrilateral contour (the
  document boundary against its background) and applies a perspective
  warp that maps its four corners to a rectangle, undoing the "keystone"
  distortion typical of phone-photographed documents.
- Adaptive thresholding: computes a local binarization threshold per
  neighborhood (Gaussian-weighted mean of the neighborhood minus a
  constant) rather than one global threshold, which is necessary for
  documents with uneven lighting where a single global threshold would
  blow out or crush different regions of the same page.
"""

from typing import Any

import cv2
import numpy as np

from dip.result import DIPResult, build_result
from utils.image_utils import to_bgr, to_grayscale
from utils.logger import logger


def _estimate_skew_angle(gray: np.ndarray) -> float:
    """Estimate the dominant skew angle (degrees) of text lines using Canny + Hough."""
    edges = cv2.Canny(gray, 50, 150, apertureSize=3)
    lines = cv2.HoughLinesP(
        edges, 1, np.pi / 180, threshold=200, minLineLength=gray.shape[1] // 4, maxLineGap=20
    )
    if lines is None:
        return 0.0

    angles = []
    for line in lines:
        x1, y1, x2, y2 = line[0]
        if x2 == x1:
            continue
        angle = np.degrees(np.arctan2(y2 - y1, x2 - x1))
        if -45 < angle < 45:
            angles.append(angle)

    if not angles:
        return 0.0
    return float(np.median(angles))


def deskew_image(
    image: np.ndarray,
    reference_image: np.ndarray | None = None,
    max_angle_correction: float = 15.0,
) -> DIPResult:
    """Detect and correct document skew using a Canny + probabilistic Hough transform."""
    reference_image = reference_image if reference_image is not None else image
    gray = to_grayscale(image)
    angle = _estimate_skew_angle(gray)
    angle = float(np.clip(angle, -max_angle_correction, max_angle_correction))

    height, width = gray.shape[:2]
    center = (width // 2, height // 2)
    rotation_matrix = cv2.getRotationMatrix2D(center, angle, 1.0)
    processed = cv2.warpAffine(
        image,
        rotation_matrix,
        (width, height),
        flags=cv2.INTER_CUBIC,
        borderMode=cv2.BORDER_REPLICATE,
    )
    logger.debug(f"Deskewed image by {angle:.3f} degrees")
    params: dict[str, Any] = {"detected_angle_degrees": angle}
    return build_result(reference_image, image, processed, "deskew", params)


def correct_perspective(
    image: np.ndarray,
    reference_image: np.ndarray | None = None,
) -> DIPResult:
    """Detect the document's quadrilateral boundary and warp it to a fronto-parallel rectangle."""
    reference_image = reference_image if reference_image is not None else image
    gray = to_grayscale(image)
    blurred = cv2.GaussianBlur(gray, (5, 5), 0)
    edges = cv2.Canny(blurred, 50, 150)
    edges = cv2.dilate(edges, np.ones((3, 3), np.uint8), iterations=1)

    contours, _ = cv2.findContours(edges, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    height, width = gray.shape[:2]
    image_area = height * width

    document_contour = None
    if contours:
        largest = max(contours, key=cv2.contourArea)
        if cv2.contourArea(largest) > 0.2 * image_area:
            perimeter = cv2.arcLength(largest, True)
            approx = cv2.approxPolyDP(largest, 0.02 * perimeter, True)
            if len(approx) == 4:
                document_contour = approx.reshape(4, 2).astype(np.float32)

    if document_contour is None:
        logger.debug("No reliable document quadrilateral found; skipping perspective correction")
        return build_result(reference_image, image, image.copy(), "perspective_correction", {"applied": False})

    sum_pts = document_contour.sum(axis=1)
    diff_pts = np.diff(document_contour, axis=1).flatten()
    ordered = np.zeros((4, 2), dtype=np.float32)
    ordered[0] = document_contour[np.argmin(sum_pts)]  # top-left
    ordered[2] = document_contour[np.argmax(sum_pts)]  # bottom-right
    ordered[1] = document_contour[np.argmin(diff_pts)]  # top-right
    ordered[3] = document_contour[np.argmax(diff_pts)]  # bottom-left

    (tl, tr, br, bl) = ordered
    width_a = np.linalg.norm(br - bl)
    width_b = np.linalg.norm(tr - tl)
    max_width = max(int(width_a), int(width_b))

    height_a = np.linalg.norm(tr - br)
    height_b = np.linalg.norm(tl - bl)
    max_height = max(int(height_a), int(height_b))

    destination = np.array(
        [[0, 0], [max_width - 1, 0], [max_width - 1, max_height - 1], [0, max_height - 1]],
        dtype=np.float32,
    )
    transform_matrix = cv2.getPerspectiveTransform(ordered, destination)
    processed = cv2.warpPerspective(image, transform_matrix, (max_width, max_height))
    logger.debug(f"Applied perspective correction, output size=({max_width}x{max_height})")
    params = {"applied": True, "output_width": max_width, "output_height": max_height}
    return build_result(reference_image, image, processed, "perspective_correction", params)


def adaptive_threshold(
    image: np.ndarray,
    reference_image: np.ndarray | None = None,
    block_size: int = 51,
    c_constant: float = 10.0,
) -> DIPResult:
    """Binarize the image using Gaussian-weighted adaptive thresholding to handle uneven illumination."""
    reference_image = reference_image if reference_image is not None else image
    gray = to_grayscale(image)
    if block_size % 2 == 0:
        block_size += 1
    binary = cv2.adaptiveThreshold(
        gray,
        255,
        cv2.ADAPTIVE_THRESH_GAUSSIAN_C,
        cv2.THRESH_BINARY,
        block_size,
        c_constant,
    )
    processed = to_bgr(binary) if image.ndim == 3 else binary
    logger.debug(f"Applied adaptive threshold block_size={block_size} c={c_constant}")
    params: dict[str, Any] = {"block_size": block_size, "c_constant": c_constant}
    return build_result(reference_image, image, processed, "adaptive_threshold", params)


def binarize_scan(image: np.ndarray, window_size: int = 51, k: float = 0.2) -> np.ndarray:
    """
    Binarize a document into a clean "scan look" using Sauvola local thresholding.

    Sauvola thresholding computes a local threshold per pixel from the mean
    and standard deviation of its neighborhood, weighted by `k`, which
    handles uneven document lighting far better than a single global
    threshold. This is deliberately an OUTPUT MODE, not a scored pipeline
    step: it is never fed into OCR and never PSNR/SSIM-scored, because
    binarization is an intentional, drastic transform that such fidelity
    metrics would always report as "worse" even when the result looks
    correct as a scan.
    """
    from skimage.filters import threshold_sauvola

    gray = to_grayscale(image)
    if window_size % 2 == 0:
        window_size += 1

    try:
        local_thresh = threshold_sauvola(gray, window_size=window_size, k=k)
        binary = ((gray > local_thresh).astype(np.uint8)) * 255
    except Exception as exc:
        logger.warning(f"Sauvola thresholding failed ({exc}); falling back to adaptive Gaussian threshold")
        binary = cv2.adaptiveThreshold(
            gray, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C, cv2.THRESH_BINARY, 51, 10
        )

    logger.debug(f"Applied Sauvola binarization window_size={window_size} k={k}")
    return binary
