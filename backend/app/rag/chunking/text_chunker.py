import re

def chunk_text(text: str, chunk_size: int = 3500) -> list[str]:
    """
    Splits text into chunks at natural boundaries (paragraphs),
    preventing mid-sentence cuts that destroy question context.
    """
    # Normalize excessive whitespace but preserve structural newlines
    text = re.sub(r"\n{3,}", "\n\n", text).strip()
    if not text:
        return []

    # Split on double newlines to keep questions/options together
    paragraphs = text.split("\n\n")
    
    chunks = []
    current_chunk = ""

    for para in paragraphs:
        if len(current_chunk) + len(para) <= chunk_size:
            current_chunk += para + "\n\n"
        else:
            if current_chunk.strip():
                chunks.append(current_chunk.strip())
            current_chunk = para + "\n\n"

    if current_chunk.strip():
        chunks.append(current_chunk.strip())

    return chunks