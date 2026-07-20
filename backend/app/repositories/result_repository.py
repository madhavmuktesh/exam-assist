from bson import ObjectId


def insert_result(db, result_doc: dict) -> dict:
    result = db.results.insert_one(result_doc)
    return db.results.find_one({"_id": result.inserted_id})


def find_result_by_exam(db, exam_id: str, user_id: str) -> dict | None:
    return db.results.find_one({"exam_id": exam_id, "user_id": user_id})


def delete_result_by_exam(db, exam_id: str, user_id: str) -> int:
    result = db.results.delete_one({"exam_id": exam_id, "user_id": user_id})
    return result.deleted_count


def delete_all_user_results(db, user_id: str) -> None:
    db.results.delete_many({"user_id": user_id})


def find_results_by_exam_ids(db, user_id: str, exam_ids: list[str]) -> list[dict]:
    return list(db.results.find({
        "user_id": user_id,
        "exam_id": {"$in": exam_ids},
    }))