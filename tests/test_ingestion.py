"""
Tests for Document Ingestion per Format:
- PDF format ingestion
- Image formats (.png, .jpg, .tiff, .bmp) ingestion
- Plain text (.txt) format ingestion (Mandatory Requirement)
"""

import os
import sys
import unittest
from pathlib import Path

# Add backend to path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "backend")))

from config import get_settings
from utils.file_utils import UnsupportedFileTypeError, validate_upload_extension
from utils.image_utils import load_image, pdf_page_count, pdf_page_to_image


class TestDocumentIngestion(unittest.TestCase):
    def setUp(self):
        self.settings = get_settings()
        self.sample_dir = Path(__file__).resolve().parent.parent / "sample_docs"

    def test_pdf_format_ingestion(self):
        """Verify that PDF documents are recognized and renderable to page images."""
        pdf_path = self.sample_dir / "company_policy_2024.pdf"
        self.assertTrue(pdf_path.exists(), "Sample PDF must exist")
        
        # Extension validation
        ext = validate_upload_extension(pdf_path.name)
        self.assertEqual(ext, ".pdf")
        
        # Multi-page / single-page count and rendering
        count = pdf_page_count(pdf_path)
        self.assertGreaterEqual(count, 1)
        image = pdf_page_to_image(pdf_path, page_number=0)
        self.assertIsNotNone(image)
        self.assertGreater(image.shape[0], 0)
        self.assertGreater(image.shape[1], 0)

    def test_image_format_ingestion(self):
        """Verify that image documents (.png, .jpg, etc.) are validated and loadable."""
        img_path = self.sample_dir / "quarterly_invoice.png"
        self.assertTrue(img_path.exists(), "Sample image must exist")

        # Extension validation
        ext = validate_upload_extension(img_path.name)
        self.assertEqual(ext, ".png")

        # Image loading
        img = load_image(img_path)
        self.assertIsNotNone(img)
        self.assertGreater(img.shape[0], 0)
        self.assertGreater(img.shape[1], 0)

    def test_text_format_ingestion(self):
        """
        [MANDATORY REQUIREMENT] Multiple document formats (PDF, images, text).
        Verify that plain text (.txt) files can be validated for ingestion.
        
        KNOWN APP GAP: Currently, settings.allowed_upload_extensions excludes '.txt'
        and the upload pipeline only handles image-based inputs.
        """
        txt_path = self.sample_dir / "travel_update_memo_2025.txt"
        self.assertTrue(txt_path.exists(), "Sample text file must exist")
        
        try:
            ext = validate_upload_extension(txt_path.name)
            self.assertEqual(ext, ".txt")
        except UnsupportedFileTypeError:
            self.fail(
                "KNOWN FAILURE (GAP): Plain text (.txt) ingestion is rejected by validate_upload_extension. "
                "Allowed extensions: " + str(self.settings.allowed_upload_extensions_list)
            )


if __name__ == "__main__":
    unittest.main()
