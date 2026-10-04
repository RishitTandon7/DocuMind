"""
Document Detection & Cropping — Stage 1 of the DIP pipeline.

Locates the physical document boundary within a raw photo (which may
include background such as a desk, bedsheet, or table) using classical
edge- and contour-based computer vision, then warps it to a flat,
straightened, cropped image — the same approach mobile scanner apps
(CamScanner, Adobe Scan) use. Every later DIP stage operates only on this
crop, never on the raw photo's background, so background texture can no
longer corrupt enhancement or OCR.

Detection strategy (precision-ordered cascade):
1. Multi-scale Canny (blur kernels 5, 7, 11) on grayscale luminance united with
   HSV saturation, morphological closing, then convex 4-point contour search
   scored by rectangularity, area ratio and edge strength.
2. GrabCut seeded from the frame border (definite background) — learns the
   background's colours from the border, so it separates a document from a
   striped or textured surface even when the document's edges are too weak
   for Canny (e.g. a white card on pale fabric).
3. Adaptive thresholding.
4. CIELAB colour-distance segmentation against the border median.
5. Full-image fallback, reported honestly as failed detection.
"""

from dataclasses import dataclass

import cv2
import numpy as np

from utils.image_utils import to_grayscale
from utils.logger import logger

MAX_DETECTION_DIM = 1000
MIN_DOCUMENT_AREA_RATIO = 0.05
MAX_DOCUMENT_AREA_RATIO = 0.95
CONTOUR_CANDIDATES = 12

# Epsilon multipliers for approxPolyDP, tried in order (tight → loose). Densely spaced: a coarser
# ladder (previously just [0.02, 0.035, 0.05]) can jump straight over the one epsilon that would
# collapse a contour to a clean quad — e.g. a contour going 10 points at 0.02 straight to 3 points
# at 0.035, skipping the 4-8 point range entirely and reporting no candidate at all even though the
# document's own contour was correctly isolated.
EPSILON_MULTIPLIERS = [0.01, 0.015, 0.02, 0.022, 0.025, 0.028, 0.03, 0.032, 0.035, 0.04, 0.05]

# Blur kernel sizes for multi-scale Canny passes.
BLUR_KERNELS = [5, 7, 11]


@dataclass
class DocumentDetectionResult:
    """Result of locating and cropping the document boundary within a raw photo."""

    cropped_image: np.ndarray
    corners: list[list[float]]
    """4 [x, y] points in ORIGINAL image coordinates, ordered top-left, top-right, bottom-right, bottom-left."""
    method: str
    """'contour' | 'grabcut' | 'adaptive_fallback' | 'lab_color_fallback' | 'full_image_fallback'"""
    found: bool


# ---------------------------------------------------------------------------
#  Geometry helpers
# ---------------------------------------------------------------------------


def _order_corners(points: np.ndarray) -> np.ndarray:
    """Order 4 arbitrary points as top-left, top-right, bottom-right, bottom-left."""
    points = points.reshape(4, 2).astype(np.float32)
    sum_pts = points.sum(axis=1)
    diff_pts = np.diff(points, axis=1).flatten()
    ordered = np.zeros((4, 2), dtype=np.float32)
    ordered[0] = points[np.argmin(sum_pts)]
    ordered[2] = points[np.argmax(sum_pts)]
    ordered[1] = points[np.argmin(diff_pts)]
    ordered[3] = points[np.argmax(diff_pts)]
    return ordered


def _quad_rectangularity(quad: np.ndarray) -> float:
    """Score how close a quad's angles are to 90°. Returns 0–1 (1 = perfect rectangle)."""
    pts = quad.reshape(4, 2).astype(np.float64)
    angles = []
    for i in range(4):
        v1 = pts[(i - 1) % 4] - pts[i]
        v2 = pts[(i + 1) % 4] - pts[i]
        cos_angle = np.dot(v1, v2) / (np.linalg.norm(v1) * np.linalg.norm(v2) + 1e-8)
        cos_angle = np.clip(cos_angle, -1.0, 1.0)
        angle = np.degrees(np.arccos(cos_angle))
        angles.append(abs(angle - 90.0))
    # Mean deviation from 90°, inverted and normalized to 0–1.
    mean_deviation = np.mean(angles)
    return max(0.0, 1.0 - mean_deviation / 45.0)


def _edge_strength_along_quad(edge_map: np.ndarray, quad: np.ndarray) -> float:
    """Average Canny edge magnitude sampled along the 4 sides of a quad."""
    h, w = edge_map.shape[:2]
    pts = quad.reshape(4, 2).astype(np.int32)
    total_samples = 0
    total_strength = 0.0
    for i in range(4):
        p1 = pts[i]
        p2 = pts[(i + 1) % 4]
        num_points = max(int(np.linalg.norm(p2 - p1) / 3), 10)
        for t in np.linspace(0, 1, num_points):
            x = int(np.clip(p1[0] + t * (p2[0] - p1[0]), 0, w - 1))
            y = int(np.clip(p1[1] + t * (p2[1] - p1[1]), 0, h - 1))
            total_strength += float(edge_map[y, x])
            total_samples += 1
    return total_strength / max(total_samples, 1)


def _score_quad(quad: np.ndarray, frame_area: float, edge_map: np.ndarray) -> float:
    """Score a candidate quad: higher is better. Combines rectangularity, area preference, and edge strength."""
    area = cv2.contourArea(quad.reshape(4, 1, 2).astype(np.int32))
    area_ratio = area / frame_area

    # Prefer area ratios in the 15–60% range (typical document size in frame).
    if area_ratio < MIN_DOCUMENT_AREA_RATIO or area_ratio > MAX_DOCUMENT_AREA_RATIO:
        return -1.0

    rect = cv2.minAreaRect(quad.reshape(4, 2).astype(np.float32))
    w, h = rect[1]
    if w == 0 or h == 0:
        return -1.0
    aspect_ratio = max(w, h) / min(w, h)
    
    # Reject extreme aspect ratios (like long fabric strips > 3.0)
    if aspect_ratio > 3.0:
        return -1.0

    # Area score: bell curve centered at 0.35.
    area_score = max(0.0, 1.0 - abs(area_ratio - 0.35) / 0.35)

    rectangularity = _quad_rectangularity(quad)
    edge_strength = _edge_strength_along_quad(edge_map, quad) / 255.0

    return 0.4 * rectangularity + 0.25 * area_score + 0.35 * edge_strength


# ---------------------------------------------------------------------------
#  Canny & edge helpers
# ---------------------------------------------------------------------------


def _auto_canny(channel: np.ndarray) -> np.ndarray:
    """Canny edge detection with thresholds derived from the channel's median intensity."""
    median = float(np.median(channel))
    lower = int(max(0, 0.66 * median))
    upper = int(min(255, 1.33 * median))
    return cv2.Canny(channel, lower, upper)


def _combined_edges(small: np.ndarray, blur_kernel: int = 7) -> np.ndarray:
    """Union of Canny edges on grayscale luminance and HSV saturation, so a saturated document
    against a desaturated background (or vice versa) is caught either way."""
    gray = to_grayscale(small)
    ksize = (blur_kernel, blur_kernel)
    gray_blurred = cv2.GaussianBlur(gray, ksize, 0)
    gray_edges = _auto_canny(gray_blurred)

    hsv = cv2.cvtColor(small, cv2.COLOR_BGR2HSV)
    saturation = hsv[:, :, 1]
    sat_blurred = cv2.GaussianBlur(saturation, ksize, 0)
    sat_edges = _auto_canny(sat_blurred)

    return cv2.bitwise_or(gray_edges, sat_edges)


def _close_and_dilate(edge_map: np.ndarray) -> np.ndarray:
    """Morphological closing (bridges small gaps at rounded corners) then dilation."""
    # Close with a larger kernel to bridge corner gaps.
    close_kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (7, 7))
    closed = cv2.morphologyEx(edge_map, cv2.MORPH_CLOSE, close_kernel, iterations=2)
    # Then dilate to thicken edges for robust contour detection.
    dilate_kernel = np.ones((3, 3), np.uint8)
    return cv2.dilate(closed, dilate_kernel, iterations=2)


# ---------------------------------------------------------------------------
#  Quad-finding with relaxed polygon approximation
# ---------------------------------------------------------------------------


def _simplify_to_quad(contour: np.ndarray) -> np.ndarray | None:
    """Try to reduce a contour to exactly 4 points via progressive epsilon relaxation.
    If the contour simplifies to 4–8 convex vertices, compute the minimum-area
    rotated rect of the hull as a quad approximation (handles rounded corners)."""
    perimeter = cv2.arcLength(contour, True)

    # Try each epsilon multiplier: tight first, then looser.
    for eps_mult in EPSILON_MULTIPLIERS:
        approx = cv2.approxPolyDP(contour, eps_mult * perimeter, True)
        n_pts = len(approx)
        if n_pts == 4 and cv2.isContourConvex(approx):
            return approx.reshape(4, 2).astype(np.float32)

    # If we get 4–8 vertices with any epsilon, the contour has rounded corners.
    # Use the convex hull's min-area rect as the quad.
    for eps_mult in EPSILON_MULTIPLIERS:
        approx = cv2.approxPolyDP(contour, eps_mult * perimeter, True)
        n_pts = len(approx)
        if 4 <= n_pts <= 8:
            hull = cv2.convexHull(approx)
            if len(hull) >= 4:
                rect = cv2.minAreaRect(hull)
                box = cv2.boxPoints(rect).astype(np.float32)
                return box

    return None


def _find_quads(
    binary_map: np.ndarray, frame_area: float, edge_map: np.ndarray
) -> list[tuple[np.ndarray, float]]:
    """Search contours in a binary/edge map for document-sized quads. Returns
    a list of (quad, score) tuples sorted by score descending."""
    # Use RETR_EXTERNAL to ignore inner contours (photo, text boxes).
    contours, _ = cv2.findContours(binary_map, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    contours = sorted(contours, key=cv2.contourArea, reverse=True)[:CONTOUR_CANDIDATES]

    candidates: list[tuple[np.ndarray, float]] = []
    for contour in contours:
        area = cv2.contourArea(contour)
        area_ratio = area / frame_area
        if area_ratio < MIN_DOCUMENT_AREA_RATIO or area_ratio > MAX_DOCUMENT_AREA_RATIO:
            continue

        quad = _simplify_to_quad(contour)
        if quad is not None:
            score = _score_quad(quad, frame_area, edge_map)
            if score > 0:
                candidates.append((quad, score))

    candidates.sort(key=lambda c: c[1], reverse=True)
    return candidates


def _best_quad_from(
    binary_map: np.ndarray, frame_area: float, edge_map: np.ndarray, min_score: float = 0.65
) -> np.ndarray | None:
    """Return the highest-scoring quad from a binary map if its score >= min_score, else None."""
    candidates = _find_quads(binary_map, frame_area, edge_map)
    if candidates and candidates[0][1] >= min_score:
        return candidates[0][0]
    return None


# ---------------------------------------------------------------------------
#  LAB color-distance segmentation
# ---------------------------------------------------------------------------


def _lab_color_mask(small: np.ndarray) -> np.ndarray:
    """Create a binary mask where the document (foreground) is white, by computing
    CIELAB ΔE between each pixel and the estimated background color (border median)."""
    h, w = small.shape[:2]
    lab = cv2.cvtColor(small, cv2.COLOR_BGR2LAB).astype(np.float32)

    # Sample border pixels (10-pixel-deep frame) as background reference.
    border_thickness = max(10, min(h, w) // 20)
    border_mask = np.zeros((h, w), dtype=np.uint8)
    border_mask[:border_thickness, :] = 255
    border_mask[-border_thickness:, :] = 255
    border_mask[:, :border_thickness] = 255
    border_mask[:, -border_thickness:] = 255

    border_pixels = lab[border_mask == 255]
    bg_lab = np.median(border_pixels, axis=0).reshape(1, 1, 3)

    # ΔE (Euclidean distance in LAB space).
    delta_e = np.sqrt(np.sum((lab - bg_lab) ** 2, axis=2))

    # Adaptive threshold: Otsu on the ΔE map.
    delta_e_norm = np.clip(delta_e / (delta_e.max() + 1e-8) * 255, 0, 255).astype(np.uint8)
    _, mask = cv2.threshold(delta_e_norm, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)

    # Clean up the mask.
    kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (5, 5))
    mask = cv2.morphologyEx(mask, cv2.MORPH_CLOSE, kernel, iterations=3)
    mask = cv2.morphologyEx(mask, cv2.MORPH_OPEN, kernel, iterations=1)

    return mask


# ---------------------------------------------------------------------------
#  GrabCut segmentation (textured / low-contrast backgrounds)
# ---------------------------------------------------------------------------

GRABCUT_MAX_DIM = 480
GRABCUT_BORDER_FRACTION = 0.06
GRABCUT_ITERATIONS = 5
GRABCUT_SEEDS = (0, 1, 2)
# A clean single-object segmentation fills ~90%+ of its own quad's hull; a blob that merged with an
# adjacent object (e.g. a laptop or bag near the frame edge) fills noticeably less of an inflated
# quad even after picking the best of several seeds. Below this, the result is confidently wrong
# rather than merely imprecise, so it's rejected and the cascade falls through to the next stage.
GRABCUT_MIN_FILL = 0.8


def _mask_to_quad(mask: np.ndarray, frame_area: float) -> tuple[np.ndarray, float] | None:
    """Turn a foreground mask into a document quad: largest blob → convex hull → 4-point polygon
    (falling back to the hull's min-area rectangle when the outline is rounded). Also returns how fully the
    blob fills that quad (1.0 = a clean rectangle; lower when the mask leaked into the background)."""
    mask = cv2.morphologyEx(mask, cv2.MORPH_CLOSE, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (9, 9)), iterations=2)
    mask = cv2.morphologyEx(mask, cv2.MORPH_OPEN, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (9, 9)))
    contours, _ = cv2.findContours(mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    if not contours:
        return None
    largest = max(contours, key=cv2.contourArea)
    area_ratio = cv2.contourArea(largest) / frame_area
    if area_ratio < MIN_DOCUMENT_AREA_RATIO or area_ratio > MAX_DOCUMENT_AREA_RATIO:
        return None

    hull = cv2.convexHull(largest)
    perimeter = cv2.arcLength(hull, True)
    for eps_mult in EPSILON_MULTIPLIERS:
        approx = cv2.approxPolyDP(hull, eps_mult * perimeter, True)
        if len(approx) == 4:
            quad = approx.reshape(4, 2).astype(np.float32)
            break
    else:
        quad = cv2.boxPoints(cv2.minAreaRect(hull)).astype(np.float32)
    quad_area = cv2.contourArea(quad.reshape(4, 1, 2))
    fill = min(cv2.contourArea(largest) / quad_area, 1.0) if quad_area > 0 else 0.0
    return quad, fill


def _grabcut_quad(small: np.ndarray) -> tuple[np.ndarray, float, float] | None:
    """Segment the document with GrabCut seeded from the frame border (definite background) and
    everything inside it (probable foreground). Colour models of the background — however textured or
    striped — are learned from the border, so a document that differs in colour is separated cleanly even
    when its edges are too weak for Canny. Returns (quad in `small` coordinates, area_ratio, fill)."""
    height, width = small.shape[:2]
    scale = min(1.0, GRABCUT_MAX_DIM / max(height, width))
    work = cv2.resize(small, (int(width * scale), int(height * scale))) if scale < 1.0 else small
    work_h, work_w = work.shape[:2]

    seed_mask = np.full((work_h, work_w), cv2.GC_PR_FGD, np.uint8)
    border = max(4, int(min(work_h, work_w) * GRABCUT_BORDER_FRACTION))
    seed_mask[:border, :] = cv2.GC_BGD
    seed_mask[-border:, :] = cv2.GC_BGD
    seed_mask[:, :border] = cv2.GC_BGD
    seed_mask[:, -border:] = cv2.GC_BGD

    # GrabCut's GMM initialisation is randomised (and OpenCV's RNG is process-global), so a single run can
    # occasionally absorb a similarly-coloured background stripe. Run a few fixed seeds and keep the
    # segmentation whose blob fills its quad most cleanly.
    best: tuple[np.ndarray, float] | None = None
    for seed in GRABCUT_SEEDS:
        cv2.setRNGSeed(seed)
        mask = seed_mask.copy()
        try:
            cv2.grabCut(
                work, mask, None, np.zeros((1, 65), np.float64), np.zeros((1, 65), np.float64),
                GRABCUT_ITERATIONS, cv2.GC_INIT_WITH_MASK,
            )
        except cv2.error:
            continue
        foreground = np.where((mask == cv2.GC_FGD) | (mask == cv2.GC_PR_FGD), 255, 0).astype(np.uint8)
        result = _mask_to_quad(foreground, float(work_h * work_w))
        if result is not None and (best is None or result[1] > best[1]):
            best = result

    if best is None:
        return None
    quad, fill = best
    area_ratio = cv2.contourArea(quad.reshape(4, 1, 2).astype(np.int32)) / float(work_h * work_w)
    return quad / scale, area_ratio, fill


# ---------------------------------------------------------------------------
#  Perspective warp
# ---------------------------------------------------------------------------


def warp_document(image: np.ndarray, corners: list[list[float]] | np.ndarray) -> np.ndarray:
    """Perspective-warp the region bounded by 4 corners (any order) to a flat, full-resolution rectangle."""
    corners_array = np.array(corners, dtype=np.float32)
    ordered = _order_corners(corners_array)
    top_left, top_right, bottom_right, bottom_left = ordered

    width_a = np.linalg.norm(bottom_right - bottom_left)
    width_b = np.linalg.norm(top_right - top_left)
    max_width = max(int(max(width_a, width_b)), 1)

    height_a = np.linalg.norm(top_right - bottom_right)
    height_b = np.linalg.norm(top_left - bottom_left)
    max_height = max(int(max(height_a, height_b)), 1)

    destination = np.array(
        [[0, 0], [max_width - 1, 0], [max_width - 1, max_height - 1], [0, max_height - 1]],
        dtype=np.float32,
    )
    transform_matrix = cv2.getPerspectiveTransform(ordered, destination)
    return cv2.warpPerspective(image, transform_matrix, (max_width, max_height))


# ---------------------------------------------------------------------------
#  Main detection pipeline
# ---------------------------------------------------------------------------


def detect_and_crop_document(raw_image: np.ndarray) -> DocumentDetectionResult:
    """Locate the document boundary in a raw photo and return a flat, cropped, straightened image.

    Runs a precision-ordered cascade of detection strategies, scoring and
    selecting the best quad across all attempts.
    """
    height, width = raw_image.shape[:2]
    scale = min(1.0, MAX_DETECTION_DIM / max(height, width))
    small = (
        cv2.resize(raw_image, (int(width * scale), int(height * scale)))
        if scale < 1.0
        else raw_image.copy()
    )
    small_area = float(small.shape[0] * small.shape[1])

    # ---- Stage 1: Multi-scale Canny with morphological closing ----
    best_quad: np.ndarray | None = None
    best_score = -1.0
    best_edge_map: np.ndarray | None = None

    for blur_kernel in BLUR_KERNELS:
        edges = _combined_edges(small, blur_kernel=blur_kernel)
        processed_edges = _close_and_dilate(edges)

        candidates = _find_quads(processed_edges, small_area, edges)
        for quad, score in candidates:
            if score > best_score:
                best_score = score
                best_quad = quad
                best_edge_map = edges

    if best_quad is not None and best_score >= 0.65:
        method = "contour"
        quad = best_quad
        logger.info(
            f"Document detected via multi-scale Canny: score={best_score:.3f}"
        )
    else:
        quad = None
        method = ""

    # ---- Stage 2: GrabCut segmentation (textured / low-contrast backgrounds) ----
    if quad is None:
        grabcut_result = _grabcut_quad(small)
        if grabcut_result is not None:
            grabcut_quad, grabcut_ratio, grabcut_fill = grabcut_result
            if grabcut_fill >= GRABCUT_MIN_FILL:
                quad = grabcut_quad
                method = "grabcut"
                logger.info(f"Document detected via GrabCut segmentation: area_ratio={grabcut_ratio:.3f}, fill={grabcut_fill:.3f}")
            else:
                logger.info(
                    f"GrabCut result rejected (fill={grabcut_fill:.3f} < {GRABCUT_MIN_FILL}), "
                    "likely merged with an adjacent object — falling through to next stage"
                )

    # ---- Stage 3: Adaptive thresholding fallback ----
    if quad is None:
        # Use the edges from the middle kernel for scoring.
        ref_edges = _combined_edges(small, blur_kernel=7)
        ref_edges_processed = _close_and_dilate(ref_edges)

        gray_blurred = cv2.GaussianBlur(to_grayscale(small), (7, 7), 0)
        adaptive = cv2.adaptiveThreshold(
            gray_blurred, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C, cv2.THRESH_BINARY_INV, 25, 10
        )
        adaptive = _close_and_dilate(adaptive)
        quad = _best_quad_from(adaptive, small_area, ref_edges, min_score=0.65)
        if quad is not None:
            method = "adaptive_fallback"
            logger.info("Document detected via adaptive thresholding fallback")

    # ---- Stage 4: LAB color-distance segmentation ----
    if quad is None:
        ref_edges = _combined_edges(small, blur_kernel=7)
        lab_mask = _lab_color_mask(small)
        quad = _best_quad_from(lab_mask, small_area, ref_edges, min_score=0.65)
        if quad is not None:
            method = "lab_color_fallback"
            logger.info("Document detected via LAB color-distance segmentation")

    # ---- Stage 5: Full-image fallback ----
    if quad is None:
        logger.warning("Document detection: no document boundary found, using full frame as fallback")
        full_corners = _order_corners(
            np.array(
                [[0, 0], [width - 1, 0], [width - 1, height - 1], [0, height - 1]], dtype=np.float32
            )
        )
        return DocumentDetectionResult(
            cropped_image=raw_image.copy(),
            corners=full_corners.tolist(),
            method="full_image_fallback",
            found=False,
        )

    original_scale_corners = quad / scale
    cropped = warp_document(raw_image, original_scale_corners)
    ordered = _order_corners(original_scale_corners)

    area_ratio = cv2.contourArea(quad.reshape(4, 1, 2).astype(np.int32)) / small_area
    logger.info(
        f"Document detected via {method}: area_ratio={area_ratio:.3f}, corners={ordered.tolist()}"
    )
    return DocumentDetectionResult(
        cropped_image=cropped,
        corners=ordered.tolist(),
        method=method,
        found=True,
    )
