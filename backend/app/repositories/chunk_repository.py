from bson import ObjectId


def insert_chunks(db, chunk_docs: list[dict]) -> int:
    if not chunk_docs:
        return 0
    result = db.chunks.insert_many(chunk_docs)
    return len(result.inserted_ids)


def find_chunks_by_exam(db, exam_id: str) -> list[dict]:
    return list(db.chunks.find({"exam_id": exam_id}))


def delete_chunks_by_exam(db, exam_id: str) -> None:
    db.chunks.delete_many({"exam_id": exam_id})