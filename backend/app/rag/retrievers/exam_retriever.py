import logging
from app.rag.embeddings.embedding_service import get_embedding

logger = logging.getLogger(__name__)


def retrieve_relevant_chunks(
    db,
    exam_id: str,
    query: str,
    top_k: int = 5,
) -> list[dict]:
    """
    Retrieves the most relevant chunks for a query using vector similarity.
    Falls back to keyword-based retrieval if embeddings are unavailable.
    """
    try:
        query_embedding = get_embedding(query)

        if not query_embedding:
            raise ValueError("Empty embedding returned")

        # MongoDB vector search (requires Atlas Vector Search index)
        pipeline = [
            {
                "$vectorSearch": {
                    "index": "exam_chunks_vector_index",
                    "path": "embedding",
                    "queryVector": query_embedding,
                    "numCandidates": top_k * 10,
                    "limit": top_k,
                    "filter": {"exam_id": exam_id},
                }
            },
            {
                "$project": {
                    "text": 1,
                    "exam_id": 1,
                    "chunk_index": 1,
                    "score": {"$meta": "vectorSearchScore"},
                }
            },
        ]

        return list(db.chunks.aggregate(pipeline))

    except Exception as e:
        logger.warning("Vector retrieval failed (%s). Falling back to keyword search.", e)

        # Keyword fallback
        chunks = list(
            db.chunks.find(
                {"exam_id": exam_id, "text": {"$regex": query[:50], "$options": "i"}}
            ).limit(top_k)
        )
        return chunks