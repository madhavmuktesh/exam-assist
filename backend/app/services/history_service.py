def serialize_history_item(exam_item: dict, result_item: dict | None) -> dict:
    return {
        "exam_id": str(exam_item["_id"]),
        "exam_title": exam_item.get("title", "Untitled Exam"),
        "final_score": result_item.get("final_score") if result_item else None,
        "max_marks": result_item.get("max_marks") if result_item else None,
        "percentage": result_item.get("percentage") if result_item else None,
        "status": exam_item.get("status", "draft"),
        "created_at": exam_item["created_at"],
        "updated_at": exam_item["updated_at"],
    }


def get_exam_history(db, user_id: str) -> list[dict]:
    exams = list(
        db.exams.find({
            "user_id": user_id,
            "is_active": True,
            "status": {"$in": ["paused", "cancelled", "submitted", "evaluated"]},
        }).sort("updated_at", -1)
    )

    if not exams:
        return []

    exam_id_strings = [str(exam["_id"]) for exam in exams]
    results = list(db.results.find({
        "user_id": user_id,
        "exam_id": {"$in": exam_id_strings},
    }))

    result_map = {result["exam_id"]: result for result in results}

    return [
        serialize_history_item(exam, result_map.get(str(exam["_id"])))
        for exam in exams
    ]