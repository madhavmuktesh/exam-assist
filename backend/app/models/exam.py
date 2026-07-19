from datetime import datetime, timezone
from typing import Literal, Optional


SourceType = Literal["pdf", "topic", "questions_pdf"]
Difficulty = Literal["easy", "medium", "hard"]
TimerMode = Literal["full_exam", "per_section", "per_question"]
QuestionPreparationMode = Literal[
    "generate_from_content",
    "extract_existing_questions",
]
ExamStatus = Literal[
    "draft",
    "ready",
    "in_progress",
    "paused",
    "cancelled",
    "submitted",
    "evaluated",
    "reviewed",
    "pending_review",
]
GenerationStatus = Literal[
    "pending",
    "processing",
    "completed",
    "failed",
    "not_applicable",
]


def exam_document(
    user_id: str,
    title: str,
    source_type: SourceType,
    input_mode: QuestionPreparationMode,
    difficulty: Difficulty,
    objective_count: int,
    descriptive_count: int,
    options_count: int,
    timer_mode: TimerMode,
    total_duration_minutes: Optional[int] = None,
    section_timers: Optional[list[dict]] = None,
    question_time_seconds: Optional[int] = None,
    pdf_filename: Optional[str] = None,
    topic_name: Optional[str] = None,
    instructions: Optional[str] = None,
) -> dict:
    now = datetime.now(timezone.utc)

    total_questions = objective_count + descriptive_count

    if source_type == "pdf":
        generation_status: GenerationStatus = "pending"
    else:
        generation_status = "not_applicable"

    status: ExamStatus = "draft"

    return {
        "user_id": user_id,
        "title": title,
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
        "section_timers": section_timers or [],
        "question_time_seconds": question_time_seconds,
        "status": status,
        "generation_status": generation_status,
        "is_active": True,
        "created_at": now,
        "updated_at": now,
        "prepared_at": None,
        "started_at": None,
        "submitted_at": None,
        "paused_at": None,
        "resumed_at": None,
        "cancelled_at": None,
        "attempt_snapshot": {
            "remaining_seconds": 0,
            "current_index": 0,
            "answers": {},
            "flagged": {},
        },
    }