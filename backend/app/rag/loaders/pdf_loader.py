import fitz  # PyMuPDF


def extract_text_from_pdf(pdf_path: str) -> dict:
    doc = fitz.open(pdf_path)
    page_texts = []
    total_chars = 0

    for page in doc:
        # Use "blocks" mode to detect columns and preserve reading order
        blocks = page.get_text("blocks", sort=True)  # returns (x0,y0,x1,y1, text, block_no, type)
        
        page_width = page.rect.width
        left_blocks = []
        right_blocks = []

        for block in blocks:
            if block[6] != 0:  # skip image blocks
                continue
            x_center = (block[0] + block[2]) / 2
            text = block[4].strip()
            if not text:
                continue
            if x_center < page_width / 2:
                left_blocks.append((block[1], text))  # (y0, text)
            else:
                right_blocks.append((block[1], text))

        # Sort each column by vertical position
        left_blocks.sort(key=lambda b: b[0])
        right_blocks.sort(key=lambda b: b[0])

        # Combine: left column first, then right column
        column_text = "\n".join(t for _, t in left_blocks)
        if right_blocks:
            column_text += "\n\n" + "\n".join(t for _, t in right_blocks)

        cleaned = column_text.strip()
        page_texts.append({
            "page_number": page.number + 1,
            "text": cleaned,
            "char_count": len(cleaned),
        })
        total_chars += len(cleaned)

    full_text = "\n\n".join(page["text"] for page in page_texts if page["text"])
    needs_ocr = total_chars < 100

    return {
        "page_count": len(doc),
        "page_texts": page_texts,
        "full_text": full_text,
        "char_count": total_chars,
        "extraction_mode": "blocks",
        "needs_ocr": needs_ocr,
    }