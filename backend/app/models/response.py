from datetime import datetime, timezone
from typing import Any


def response_document(
    exam_id: str,
    question_id: str,
    user_id: str,
    question_type: str,
    selected_option_ids: list[str] | None = None,
    descriptive_answer: str | None = None,
    time_taken_seconds: int | None = None,
    is_flagged_for_review: bool = False,
) -> dict[str, Any]:
    now = datetime.now(timezone.utc)

    return {
        "exam_id": exam_id,
        "question_id": question_id,
        "user_id": user_id,
        "question_type": question_type,
        "selected_option_ids": selected_option_ids or [],
        "descriptive_answer": descriptive_answer,
        "time_taken_seconds": time_taken_seconds,
        "is_flagged_for_review": is_flagged_for_review,
        "submitted_at": now,
        "created_at": now,
        "updated_at": now,
        "is_active": True,
    }