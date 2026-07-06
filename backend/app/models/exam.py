from datetime import datetime, timezone
from typing import Any


def exam_document(
    user_id: str,
    title: str,
    source_type: str,
    input_mode: str,
    difficulty: str,
    objective_count: int,
    descriptive_count: int,
    options_count: int,
    timer_mode: str,
    total_duration_minutes: int | None,
    section_timers: list[dict[str, Any]],
    question_time_seconds: int | None,
    pdf_filename: str | None = None,
    topic_name: str | None = None,
    instructions: str | None = None,
) -> dict[str, Any]:
    now = datetime.now(timezone.utc)

    total_questions = objective_count + descriptive_count

    return {
        "user_id": user_id,
        "title": title.strip(),
        "source_type": source_type,
        "input_mode": input_mode,
        "pdf_filename": pdf_filename,
        "topic_name": topic_name,
        "instructions": instructions,
        "difficulty": difficulty,
        "objective_count": objective_count,
        "descriptive_count": descriptive_count,
        "total_questions": total_questions,
        "options_count": options_count,
        "timer_mode": timer_mode,
        "total_duration_minutes": total_duration_minutes,
        "section_timers": section_timers,
        "question_time_seconds": question_time_seconds,
        "status": "draft",
        "generation_status": "pending",
        "is_active": True,
        "created_at": now,
        "updated_at": now,
        "prepared_at": None,
        "started_at": None,
        "submitted_at": None,
    }