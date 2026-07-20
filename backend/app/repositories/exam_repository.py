from bson import ObjectId
from datetime import datetime, timezone


def insert_exam(db, exam_doc: dict) -> dict:
    result = db.exams.insert_one(exam_doc)
    return db.exams.find_one({"_id": result.inserted_id})


def find_exam_by_id(db, exam_id: str, user_id: str) -> dict | None:
    if not ObjectId.is_valid(exam_id):
        return None
    return db.exams.find_one(
        {"_id": ObjectId(exam_id), "user_id": user_id, "is_active": True}
    )


def list_exams(db, user_id: str, skip: int, limit: int) -> list[dict]:
    return list(
        db.exams.find({"user_id": user_id, "is_active": True})
        .sort("updated_at", -1)
        .skip(skip)
        .limit(limit)
    )


def count_exams(db, user_id: str) -> int:
    return db.exams.count_documents({"user_id": user_id, "is_active": True})


def update_exam(db, exam_id: ObjectId, update_data: dict) -> dict:
    update_data["updated_at"] = datetime.now(timezone.utc)
    db.exams.update_one({"_id": exam_id}, {"$set": update_data})
    return db.exams.find_one({"_id": exam_id})


def soft_delete_exam(db, exam_id: ObjectId) -> None:
    db.exams.update_one(
        {"_id": exam_id},
        {"$set": {"is_active": False, "updated_at": datetime.now(timezone.utc)}},
    )


def delete_all_user_exams(db, user_id: str) -> None:
    db.exams.delete_many({"user_id": user_id})