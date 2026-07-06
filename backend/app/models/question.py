from datetime import datetime, timezone
from typing import Any


def question_document(
    exam_id: str,
    user_id: str,
    question_type: str,
    question_text: str,
    question_order: int,
    marks: float,
    options: list[dict[str, Any]] | None = None,
    correct_option_ids: list[str] | None = None,
    correct_answer_text: str | None = None,
    explanation: str | None = None,
    section_name: str | None = None,
    difficulty: str | None = None,
    source_chunk_ids: list[str] | None = None,
    time_limit_seconds: int | None = None,
) -> dict[str, Any]:
    now = datetime.now(timezone.utc)

    return {
        "exam_id": exam_id,
        "user_id": user_id,
        "question_type": question_type,
        "question_text": question_text.strip(),
        "question_order": question_order,
        "marks": marks,
        "options": options or [],
        "correct_option_ids": correct_option_ids or [],
        "correct_answer_text": correct_answer_text,
        "explanation": explanation,
        "section_name": section_name,
        "difficulty": difficulty,
        "source_chunk_ids": source_chunk_ids or [],
        "time_limit_seconds": time_limit_seconds,
        "is_active": True,
        "created_at": now,
        "updated_at": now,
    }