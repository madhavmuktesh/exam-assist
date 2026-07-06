from datetime import datetime, timezone
from typing import Any


def result_document(
    exam_id: str,
    user_id: str,
    total_questions: int,
    attempted_questions: int,
    objective_total: int,
    objective_attempted: int,
    objective_correct: int,
    objective_wrong: int,
    descriptive_total: int,
    descriptive_attempted: int,
    max_marks: float,
    objective_score: float,
    descriptive_score: float,
    final_score: float,
    percentage: float,
    status: str = "evaluated",
    review_required: bool = True,
    answer_breakdown: list[dict[str, Any]] | None = None,
) -> dict[str, Any]:
    now = datetime.now(timezone.utc)

    return {
        "exam_id": exam_id,
        "user_id": user_id,
        "total_questions": total_questions,
        "attempted_questions": attempted_questions,
        "objective_total": objective_total,
        "objective_attempted": objective_attempted,
        "objective_correct": objective_correct,
        "objective_wrong": objective_wrong,
        "descriptive_total": descriptive_total,
        "descriptive_attempted": descriptive_attempted,
        "max_marks": max_marks,
        "objective_score": objective_score,
        "descriptive_score": descriptive_score,
        "final_score": final_score,
        "percentage": percentage,
        "status": status,
        "review_required": review_required,
        "answer_breakdown": answer_breakdown or [],
        "created_at": now,
        "updated_at": now,
    }