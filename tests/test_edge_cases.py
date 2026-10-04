"""
Tests for Document Processing Edge Cases:
- Unsupported format (.exe, .zip, etc.)
- Very large file exceeding MAX_UPLOAD_SIZE_MB
- Empty file (0 bytes)
- Corrupted PDF file
- Duplicate upload handling
"""

import asyncio
import io
import os
import sys
import tempfile
import unittest
from pathlib import Path

import fitz
from fastapi import UploadFile

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "backend")))

from config import get_settings
from utils.file_utils import (
    FileTooLargeError,
    UnsupportedFileTypeError,
    generate_document_id,
    persist_upload,
    validate_upload_extension,
)
from utils.image_utils import load_image, pdf_page_count


class TestEdgeCases(unittest.TestCase):
    def setUp(self):
        self.settings = get_settings()

    def test_unsupported_formats(self):
        """Verify that executable, archive, and unknown extensions are rejected with UnsupportedFileTypeError."""
        unsupported = ["malware.exe", "bundle.zip", "script.sh", "data.bin", "document.docx"]
        for filename in unsupported:
            with self.assertRaises(UnsupportedFileTypeError, msg=f"Should reject {filename}"):
                validate_upload_extension(filename)

    def test_very_large_file_rejection(self):
        """Verify that files exceeding MAX_UPLOAD_SIZE_MB raise FileTooLargeError during persist_upload."""
        limit_bytes = self.settings.max_upload_size_mb * 1024 * 1024
        oversized_data = b"0" * (1024 * 1024)

        class MockLargeUpload:
            def __init__(self):
                self.filename = "large_scan.png"
                self.bytes_read = 0

            async def read(self, chunk_size):
                if self.bytes_read < limit_bytes + 1024:
                    self.bytes_read += len(oversized_data)
                    return oversized_data
                return b""

            async def close(self):
                pass

        async def run_test():
            mock_file = MockLargeUpload()
            test_doc_id = generate_document_id()
            with self.assertRaises(FileTooLargeError):
                await persist_upload(mock_file, test_doc_id)

        asyncio.run(run_test())

    def test_corrupted_pdf_handling(self):
        """Verify that a corrupted / truncated PDF raises an error when opening."""
        with tempfile.NamedTemporaryFile(suffix=".pdf", delete=False) as tf:
            tf.write(b"%PDF-1.4 corrupted incomplete stream byte garbage")
            temp_path = Path(tf.name)

        try:
            with self.assertRaises(fitz.FileDataError):
                pdf_page_count(temp_path)
        finally:
            temp_path.unlink(missing_ok=True)

    def test_empty_file_handling(self):
        """Verify that an empty (0 byte) file raises an error when attempting to decode as an image."""
        with tempfile.NamedTemporaryFile(suffix=".png", delete=False) as tf:
            temp_path = Path(tf.name)

        try:
            with self.assertRaises((FileNotFoundError, ValueError)):
                load_image(temp_path)
        finally:
            temp_path.unlink(missing_ok=True)

    def test_duplicate_upload_id_generation(self):
        """Verify that duplicate uploads of the same file produce distinct, isolated document IDs."""
        id_1 = generate_document_id()
        id_2 = generate_document_id()
        self.assertNotEqual(id_1, id_2)
        self.assertEqual(len(id_1), 36)
        self.assertEqual(len(id_2), 36)


if __name__ == "__main__":
    unittest.main()
