# backend/app/services/question_service.py
from typing import Literal

from bson import ObjectId
import random
from app.core.database import get_database
from app.models.question import question_document
from app.services.pdf_service import (
    save_uploaded_pdf,
    extract_text_from_pdf,
)
from app.services.question_generation_service import (
    generate_questions_from_content,
    extract_existing_questions,
    extract_questions_with_llm,
)

QuestionPreparationMode = Literal[
    "generate_from_content",
    "extract_existing_questions",
]


def prepare_questions_for_exam_from_pdf(
    *,
    exam_id: str,
    user_id: str,
    file_name: str,
    file_bytes: bytes,
    objective_count: int,
    descriptive_count: int,
    options_count: int,
    difficulty: str,
    input_mode: QuestionPreparationMode,
) -> int:
    """
    - Saves PDF.
    - Extracts text.
    - Generates or extracts questions.
    - Enforces requested counts (objective + descriptive).
    - Stores questions in Mongo.
    """

    # 1) Save PDF and extract text
    pdf_path = save_uploaded_pdf(file_name=file_name, file_bytes=file_bytes)
    extraction = extract_text_from_pdf(pdf_path)

    text = extraction["full_text"]
    if not text.strip():
        raise ValueError("No text could be extracted from the uploaded PDF")

# 2) Generate or extract questions
    if input_mode == "generate_from_content":
        raw_questions = generate_questions_from_content(
            text=text,
            objective_count=objective_count,
            descriptive_count=descriptive_count,
            options_count=options_count,
            difficulty=difficulty,
        )
    elif input_mode == "extract_existing_questions":
        # Try Regex first (fast and free)
        raw_questions = extract_existing_questions(
            text=text,
            options_count=options_count,
            difficulty=difficulty,
        )
        
        # --- NEW: LLM Fallback ---
        if not raw_questions:
            print("⚠️ Regex extraction failed. Falling back to LLM extraction...")
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
        raise ValueError("No questions were generated or extracted from the PDF")

    # 3) Enforce requested counts (so you don't end up with 109 when you asked for 25)
    objective_qs = [q for q in raw_questions if q["question_type"] == "objective"]
    descriptive_qs = [q for q in raw_questions if q["question_type"] == "descriptive"]

    if objective_count > 0:
        objective_qs = objective_qs[:objective_count]
    else:
        objective_qs = []

    if descriptive_count > 0:
        descriptive_qs = descriptive_qs[:descriptive_count]
    else:
        descriptive_qs = []

    raw_questions = objective_qs + descriptive_qs
    raw_questions.sort(key=lambda q: q.get("question_order", 0))

    # 4) Normalize and insert into MongoDB
    db = get_database()
    question_docs = []

    for q in raw_questions:
        question_type = q["question_type"]
        question_text = q["question_text"]
        question_order = q["question_order"]
        marks = q["marks"]
        options = q.get("options", [])
        correct_option_ids = q.get("correct_option_ids", [])
        if options:
            random.shuffle(options)
        correct_answer_text = q.get("correct_answer_text")
        explanation = q.get("explanation")
        section_name = q.get("section_name")
        difficulty_value = q.get("difficulty", difficulty)
        source_chunk_ids = q.get("source_chunk_ids", [])
        time_limit_seconds = q.get("time_limit_seconds")

        # Fallback: if objective but no options, treat as descriptive
        if question_type == "objective" and not options:
            print(f"⚠️ WARNING: No options found for Q: '{question_text}'. Converting to descriptive.")
            question_type = "descriptive"

        doc = question_document(
            exam_id=str(exam_id),
            user_id=str(user_id),
            question_type=question_type,
            question_text=question_text,
            question_order=question_order,
            marks=marks,
            options=options,
            correct_option_ids=correct_option_ids,
            correct_answer_text=correct_answer_text,
            explanation=explanation,
            section_name=section_name,
            difficulty=difficulty_value,
            source_chunk_ids=source_chunk_ids,
            time_limit_seconds=time_limit_seconds,
        )
        question_docs.append(doc)

    if question_docs:
        db.questions.insert_many(question_docs)

    return len(question_docs)


def prepare_questions_for_exam_from_text(
    *,
    exam_id: str,
    user_id: str,
    source_text: str,
    objective_count: int,
    descriptive_count: int,
    options_count: int,
    difficulty: str,
    input_mode: QuestionPreparationMode,
) -> int:
    """
    Same idea as PDF, but for raw text (e.g. topic-based).
    """

    text = source_text.strip()
    if not text:
        raise ValueError("Source text is empty; cannot prepare questions")

# 2) Generate or extract questions
    if input_mode == "generate_from_content":
        raw_questions = generate_questions_from_content(
            text=text,
            objective_count=objective_count,
            descriptive_count=descriptive_count,
            options_count=options_count,
            difficulty=difficulty,
        )
    elif input_mode == "extract_existing_questions":
        # Try Regex first (fast and free)
        raw_questions = extract_existing_questions(
            text=text,
            options_count=options_count,
            difficulty=difficulty,
        )
        
        # --- NEW: LLM Fallback ---
        if not raw_questions:
            print("⚠️ Regex extraction failed. Falling back to LLM extraction...")
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
        raise ValueError("No questions were generated or extracted from the text")

    # Enforce counts here as well (optional but consistent)
    objective_qs = [q for q in raw_questions if q["question_type"] == "objective"]
    descriptive_qs = [q for q in raw_questions if q["question_type"] == "descriptive"]

    if objective_count > 0:
        objective_qs = objective_qs[:objective_count]
    else:
        objective_qs = []

    if descriptive_count > 0:
        descriptive_qs = descriptive_qs[:descriptive_count]
    else:
        descriptive_qs = []

    raw_questions = objective_qs + descriptive_qs
    raw_questions.sort(key=lambda q: q.get("question_order", 0))

    db = get_database()
    question_docs = []

    for q in raw_questions:
        question_type = q["question_type"]
        options = q.get("options", [])

        if question_type == "objective" and not options:
            question_type = "descriptive"

        doc = question_document(
            exam_id=str(exam_id),
            user_id=str(user_id),
            question_type=question_type,
            question_text=q["question_text"],
            question_order=q["question_order"],
            marks=q["marks"],
            options=options,
            correct_option_ids=q.get("correct_option_ids", []),
            correct_answer_text=q.get("correct_answer_text"),
            explanation=q.get("explanation"),
            section_name=q.get("section_name"),
            difficulty=q.get("difficulty", difficulty),
            source_chunk_ids=q.get("source_chunk_ids", []),
            time_limit_seconds=q.get("time_limit_seconds"),
        )
        question_docs.append(doc)

    if question_docs:
        db.questions.insert_many(question_docs)

    return len(question_docs)