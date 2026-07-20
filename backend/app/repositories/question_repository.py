from bson import ObjectId


def insert_questions(db, question_docs: list[dict]) -> int:
    if not question_docs:
        return 0
    result = db.questions.insert_many(question_docs)
    return len(result.inserted_ids)


def find_questions_by_exam(db, exam_id: str, user_id: str) -> list[dict]:
    return list(
        db.questions.find({
            "exam_id": exam_id,
            "user_id": user_id,
            "is_active": True,
        }).sort("question_order", 1)
    )


def delete_questions_by_exam(db, exam_id: str) -> None:
    db.questions.delete_many({"exam_id": exam_id})


def delete_all_user_questions(db, user_id: str) -> None:
    db.questions.delete_many({"user_id": user_id})