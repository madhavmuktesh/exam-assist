import fitz  # PyMuPDF
import re
import logging
from typing import Any

logger = logging.getLogger(__name__)


def extract_text_from_pdf(pdf_path: str) -> dict:
    """
    Column-aware PDF text extraction using PyMuPDF blocks.
    Handles 2-column exam paper layouts by detecting left/right columns
    and reading each column top-to-bottom before combining.
    """
    doc = fitz.open(pdf_path)
    page_texts = []
    total_chars = 0

    for page in doc:
        page_width = page.rect.width
        mid = page_width / 2

        blocks = page.get_text("blocks", sort=True)

        left_blocks = []
        right_blocks = []

        for block in blocks:
            if block[6] != 0:  # skip image blocks
                continue
            text = block[4].strip()
            if not text:
                continue
            x_center = (block[0] + block[2]) / 2
            y0 = block[1]
            if x_center < mid:
                left_blocks.append((y0, text))
            else:
                right_blocks.append((y0, text))

        left_blocks.sort(key=lambda b: b[0])
        right_blocks.sort(key=lambda b: b[0])

        left_text = "\n".join(t for _, t in left_blocks)
        right_text = "\n".join(t for _, t in right_blocks)
        column_text = (left_text + "\n\n" + right_text).strip()

        page_texts.append({
            "page_number": page.number + 1,
            "text": column_text,
            "char_count": len(column_text),
        })
        total_chars += len(column_text)

    full_text = "\n\n".join(p["text"] for p in page_texts if p["text"])
    needs_ocr = total_chars < 100

    return {
        "page_count": len(doc),
        "page_texts": page_texts,
        "full_text": full_text,
        "char_count": total_chars,
        "extraction_mode": "blocks_column_aware",
        "needs_ocr": needs_ocr,
    }
