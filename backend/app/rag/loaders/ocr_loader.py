import logging
from pathlib import Path

logger = logging.getLogger(__name__)


def extract_text_with_ocr(pdf_path: str | Path) -> dict:
    """
    OCR-based text extraction for scanned PDFs.
    Requires: pytesseract + pdf2image + poppler installed.
    Falls back gracefully if dependencies are missing.
    """
    try:
        import pytesseract
        from pdf2image import convert_from_path
        from PIL import Image

        pages = convert_from_path(str(pdf_path), dpi=300)
        page_texts = []
        total_chars = 0

        for i, page_image in enumerate(pages):
            text = pytesseract.image_to_string(page_image, lang="eng")
            cleaned = text.strip()
            page_texts.append({
                "page_number": i + 1,
                "text": cleaned,
                "char_count": len(cleaned),
            })
            total_chars += len(cleaned)

        full_text = "\n\n".join(p["text"] for p in page_texts if p["text"])

        return {
            "page_count": len(pages),
            "page_texts": page_texts,
            "full_text": full_text,
            "char_count": total_chars,
            "extraction_mode": "ocr",
            "needs_ocr": False,
        }

    except ImportError:
        logger.warning("OCR dependencies not installed (pytesseract/pdf2image). Returning empty.")
        return {
            "page_count": 0,
            "page_texts": [],
            "full_text": "",
            "char_count": 0,
            "extraction_mode": "ocr_unavailable",
            "needs_ocr": True,
        }
    except Exception as e:
        logger.error("OCR extraction failed: %s", e)
        return {
            "page_count": 0,
            "page_texts": [],
            "full_text": "",
            "char_count": 0,
            "extraction_mode": "ocr_failed",
            "needs_ocr": True,
        }