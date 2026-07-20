import logging
from datetime import datetime, timezone

logger = logging.getLogger(__name__)


def store_chunks_with_embeddings(
    db,
    exam_id: str,
    user_id: str,
    chunks: list[str],
) -> int:
    """
    Generates embeddings for each chunk and stores them in MongoDB.
    Returns count of stored chunks.
    """
    from app.rag.embeddings.embedding_service import get_embedding

    docs = []
    for i, chunk_text in enumerate(chunks):
        embedding = get_embedding(chunk_text)
        docs.append({
            "exam_id": exam_id,
            "user_id": user_id,
            "chunk_index": i,
            "text": chunk_text,
            "embedding": embedding,
            "created_at": datetime.now(timezone.utc),
        })

    if docs:
        db.chunks.insert_many(docs)
        logger.info("Stored %d chunks for exam %s", len(docs), exam_id)

    return len(docs)


def delete_exam_chunks(db, exam_id: str) -> None:
    db.chunks.delete_many({"exam_id": exam_id})
    logger.info("Deleted chunks for exam %s", exam_id)