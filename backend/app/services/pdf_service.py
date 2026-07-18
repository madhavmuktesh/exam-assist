import uuid
from pathlib import Path
import fitz  # PyMuPDF

UPLOAD_DIR = Path("uploads")
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)


def save_uploaded_pdf(file_name: str, file_bytes: bytes) -> str:
    """
    Saves PDF with a UUID prefix to prevent filename collisions
    and path traversal attacks.
    """
    # Strip any path components, keep only the base filename
    safe_name = Path(file_name).name.replace(" ", "_")
    unique_name = f"{uuid.uuid4().hex}_{safe_name}"
    target_path = UPLOAD_DIR / unique_name
    target_path.write_bytes(file_bytes)
    return unique_name  # return just the filename, not the full path


def extract_text_from_pdf(pdf_path: str) -> dict:
    doc = fitz.open(pdf_path)

    page_texts = []
    total_chars = 0

    for page in doc:
        text = page.get_text("text", sort=True)
        cleaned = text.strip()
        page_texts.append(
            {
                "page_number": page.number + 1,
                "text": cleaned,
                "char_count": len(cleaned),
            }
        )
        total_chars += len(cleaned)

    full_text = "\n\n".join(page["text"] for page in page_texts if page["text"])

    extraction_mode = "text"
    needs_ocr = total_chars < 30

    return {
        "page_count": len(doc),
        "page_texts": page_texts,
        "full_text": full_text,
        "char_count": total_chars,
        "extraction_mode": extraction_mode,
        "needs_ocr": needs_ocr,
    }