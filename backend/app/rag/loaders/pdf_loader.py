import fitz  # PyMuPDF


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