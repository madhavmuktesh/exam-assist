from datetime import datetime, timezone
from typing import Literal, Optional, TypedDict


QuestionType = Literal["objective", "descriptive"]
DifficultyLevel = Literal["easy", "medium", "hard"]


class QuestionOption(TypedDict):
    id: str
    text: str


def question_document(
    exam_id: str,
    user_id: str,
    question_type: QuestionType,
    question_text: str,
    question_order: int,
    marks: float = 1.0,
    options: Optional[list[QuestionOption]] = None,
    correct_option_ids: Optional[list[str]] = None,
    correct_answer_text: Optional[str] = None,
    explanation: Optional[str] = None,
    section_name: Optional[str] = None,
    difficulty: Optional[DifficultyLevel] = None,
    source_chunk_ids: Optional[list[str]] = None,
    time_limit_seconds: Optional[int] = None,
) -> dict:
    now = datetime.now(timezone.utc)

    cleaned_question_text = question_text.strip()
    cleaned_correct_answer_text = (
        correct_answer_text.strip() if correct_answer_text else None
    )
    cleaned_explanation = explanation.strip() if explanation else None
    cleaned_section_name = section_name.strip() if section_name else None

    if not cleaned_question_text:
        raise ValueError("question_text cannot be empty")

    if question_order < 1:
        raise ValueError("question_order must be at least 1")

    if marks <= 0:
        raise ValueError("marks must be greater than 0")

    if question_type == "objective" and not options:
        raise ValueError("Objective questions must include options")

    if question_type == "objective" and not (correct_option_ids or []):
        raise ValueError("Objective questions must include correct_option_ids")

    if question_type == "descriptive" and options:
        raise ValueError("Descriptive questions cannot include options")

    return {
        "exam_id": exam_id,
        "user_id": user_id,
        "question_type": question_type,
        "question_text": cleaned_question_text,
        "question_order": question_order,
        "marks": marks,
        "options": options or [],
        "correct_option_ids": correct_option_ids or [],
        "correct_answer_text": cleaned_correct_answer_text,
        "explanation": cleaned_explanation,
        "section_name": cleaned_section_name,
        "difficulty": difficulty,
        "source_chunk_ids": source_chunk_ids or [],
        "time_limit_seconds": time_limit_seconds,
        "is_active": True,
        "created_at": now,
        "updated_at": now,
    }