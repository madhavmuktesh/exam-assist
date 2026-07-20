from bson import ObjectId


def insert_responses(db, response_docs: list[dict]) -> None:
    if response_docs:
        db.responses.insert_many(response_docs)


def find_responses_by_exam(db, exam_id: str, user_id: str) -> list[dict]:
    return list(
        db.responses.find({
            "exam_id": exam_id,
            "user_id": user_id,
            "is_active": True,
        }).sort("created_at", 1)
    )


def delete_responses_by_exam(db, exam_id: str, user_id: str) -> None:
    db.responses.delete_many({"exam_id": exam_id, "user_id": user_id})


def delete_all_user_responses(db, user_id: str) -> None:
    db.responses.delete_many({"user_id": user_id})