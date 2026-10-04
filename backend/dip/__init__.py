"""
Digital Image Processing (DIP) module.

Implements the adaptive image restoration primitives used by DocuMind to
transform messy, scanned, low-quality document images into clean inputs for
OCR: noise filters, contrast enhancement, geometric correction, morphology,
edge detection, and objective quality metrics. Every operation returns a
typed `DIPResult` carrying the processed image alongside before/after
quality measurements so the pipeline and frontend can show exactly what
each step did and why.
"""

from dip.result import DIPResult

__all__ = ["DIPResult"]
