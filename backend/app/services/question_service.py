from pathlib import Path
from typing import Literal
import logging
import random

from app.core.database import get_database
from app.models.question import question_document
from app.services.pdf_service import extract_text_from_pdf
from app.services.question_generation_service import (
    generate_questions_from_content,
    extract_existing_questions,
    extract_questions_with_llm,
)

logger = logging.getLogger(__name__)

QuestionPreparationMode = Literal[
    "generate_from_content",
    "extract_existing_questions",
]


def _generate_raw_questions(
    *,
    text: str,
    objective_count: int,
    descriptive_count: int,
    options_count: int,
    difficulty: str,
    input_mode: QuestionPreparationMode,
) -> list[dict]:
    if input_mode == "generate_from_content":
        raw_questions = generate_questions_from_content(
            text=text,
            objective_count=objective_count,
            descriptive_count=descriptive_count,
            options_count=options_count,
            difficulty=difficulty,
        )
    elif input_mode == "extract_existing_questions":
        raw_questions = extract_existing_questions(
            text=text,
            options_count=options_count,
            difficulty=difficulty,
        )

        if not raw_questions:
            logger.warning("Regex extraction failed. Falling back to LLM extraction.")
            raw_questions = extract_questions_with_llm(
                text=text,
                options_count=options_count,
                difficulty=difficulty,
            )
    else:
        raise ValueError(
            f"Unsupported input_mode: {input_mode}. "
            f"Expected 'generate_from_content' or 'extract_existing_questions'."
        )

    if not raw_questions:
        raise ValueError("No questions were generated or extracted")

    return raw_questions


def _enforce_requested_counts(
    raw_questions: list[dict],
    objective_count: int,
    descriptive_count: int,
) -> list[dict]:
    objective_qs = [q for q in raw_questions if q.get("question_type") == "objective"]
    descriptive_qs = [q for q in raw_questions if q.get("question_type") == "descriptive"]

    objective_qs = objective_qs[:objective_count] if objective_count > 0 else []
    descriptive_qs = descriptive_qs[:descriptive_count] if descriptive_count > 0 else []

    final_questions = objective_qs + descriptive_qs
    final_questions.sort(key=lambda q: q.get("question_order", 0))
    return final_questions


def _normalize_question_docs(
    *,
    exam_id: str,
    user_id: str,
    raw_questions: list[dict],
    difficulty: str,
) -> list[dict]:
    question_docs = []

    for index, q in enumerate(raw_questions, start=1):
        question_type = q.get("question_type")
        question_text = (q.get("question_text") or "").strip()

        if not question_text:
            logger.warning("Skipping question with empty question_text: %s", q)
            continue

        marks = float(q.get("marks", 1))
        options = q.get("options", []) or []
        correct_option_ids = q.get("correct_option_ids", []) or []

        if question_type == "objective":
            if len(options) < 2:
                logger.warning(
                    "Objective question had fewer than 2 options. Converting to descriptive. question_text=%s",
                    question_text,
                )
                question_type = "descriptive"
                options = []
                correct_option_ids = []
            else:
                random.shuffle(options)
                option_ids = {opt.get("id") for opt in options if opt.get("id")}
                correct_option_ids = [
                    option_id for option_id in correct_option_ids if option_id in option_ids
                ]

                if not correct_option_ids:
                    logger.warning(
                        "Objective question lost valid correct_option_ids after normalization. Converting to descriptive. question_text=%s",
                        question_text,
                    )
                    question_type = "descriptive"
                    options = []
                    correct_option_ids = []

        question_doc = question_document(
            exam_id=str(exam_id),
            user_id=str(user_id),
            question_type=question_type,
            question_text=question_text,
            question_order=q.get("question_order", index),
            marks=marks,
            options=options,
            correct_option_ids=correct_option_ids,
            correct_answer_text=q.get("correct_answer_text"),
            explanation=q.get("explanation"),
            section_name=q.get("section_name"),
            difficulty=q.get("difficulty", difficulty),
            source_chunk_ids=q.get("source_chunk_ids", []),
            time_limit_seconds=q.get("time_limit_seconds"),
        )
        question_docs.append(question_doc)

    if not question_docs:
        raise ValueError("No valid questions remained after normalization")

    return question_docs


def prepare_questions_for_exam_from_pdf(
    *,
    exam_id: str,
    user_id: str,
    pdf_path: Path,
    objective_count: int,
    descriptive_count: int,
    options_count: int,
    difficulty: str,
    input_mode: QuestionPreparationMode,
) -> int:
    if not pdf_path.exists():
        raise ValueError(f"PDF file not found at path: {pdf_path}")

    extraction = extract_text_from_pdf(pdf_path)

    text = extraction["full_text"]
    if not text.strip():
        raise ValueError("No text could be extracted from the uploaded PDF")

    raw_questions = _generate_raw_questions(
        text=text,
        objective_count=objective_count,
        descriptive_count=descriptive_count,
        options_count=options_count,
        difficulty=difficulty,
        input_mode=input_mode,
    )

    raw_questions = _enforce_requested_counts(
        raw_questions=raw_questions,
        objective_count=objective_count,
        descriptive_count=descriptive_count,
    )

    question_docs = _normalize_question_docs(
        exam_id=exam_id,
        user_id=user_id,
        raw_questions=raw_questions,
        difficulty=difficulty,
    )

    db = get_database()
    db.questions.insert_many(question_docs)

    return len(question_docs)