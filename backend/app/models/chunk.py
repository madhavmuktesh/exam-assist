from datetime import datetime, timezone


def chunk_document(
    exam_id: str,
    user_id: str,
    chunk_index: int,
    text: str,
    embedding: list[float] | None = None,
) -> dict:
    now = datetime.now(timezone.utc)
    return {
        "exam_id": exam_id,
        "user_id": user_id,
        "chunk_index": chunk_index,
        "text": text,
        "embedding": embedding or [],
        "is_active": True,
        "created_at": now,
        "updated_at": now,
    }