from datetime import datetime, timezone
from pathlib import Path

from bson import ObjectId
from fastapi import HTTPException, status

from app.models.exam import exam_document
from app.rag.pipelines.prepare_exam_pipeline import prepare_questions_for_exam_from_pdf


def utc_now():
    return datetime.now(timezone.utc)


def ensure_utc_aware(dt: datetime | None) -> datetime | None:
    if dt is None:
        return None
    if dt.tzinfo is None:
        return dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(timezone.utc)


def serialize_exam(exam: dict) -> dict:
    return {
        "id": str(exam["_id"]),
        "user_id": str(exam["user_id"]),
        "title": exam["title"],
        "source_type": exam["source_type"],
        "input_mode": exam["input_mode"],
        "pdf_filename": exam.get("pdf_filename"),
        "topic_name": exam.get("topic_name"),
        "instructions": exam.get("instructions"),
        "difficulty": exam["difficulty"],
        "objective_count": exam["objective_count"],
        "descriptive_count": exam["descriptive_count"],
        "total_questions": exam.get("total_questions", 0),
        "options_count": exam["options_count"],
        "timer_mode": exam["timer_mode"],
        "total_duration_minutes": exam.get("total_duration_minutes"),
        "section_timers": exam.get("section_timers", []),
        "question_time_seconds": exam.get("question_time_seconds"),
        "status": exam["status"],
        "generation_status": exam["generation_status"],
        "is_active": exam.get("is_active", True),
        "created_at": exam["created_at"],
        "updated_at": exam["updated_at"],
        "prepared_at": exam.get("prepared_at"),
        "started_at": exam.get("started_at"),
        "submitted_at": exam.get("submitted_at"),
        "paused_at": exam.get("paused_at"),
        "resumed_at": exam.get("resumed_at"),
        "cancelled_at": exam.get("cancelled_at"),
    }


def serialize_student_question(question: dict) -> dict:
    return {
        "id": str(question["_id"]),
        "question_text": question["question_text"],
        "question_type": question["question_type"],
        "marks": question.get("marks", 1.0),
        "options": [
            {"id": str(opt["id"]), "text": opt["text"]}
            for opt in question.get("options", [])
        ],
    }


def get_exam_or_404(db, exam_id: str, user_id: str) -> dict:
    if not ObjectId.is_valid(exam_id):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid exam id",
        )
    exam = db.exams.find_one(
        {"_id": ObjectId(exam_id), "user_id": user_id, "is_active": True}
    )
    if not exam:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Exam not found",
        )
    return exam


def build_resume_payload(exam: dict) -> dict:
    now = datetime.now(timezone.utc)
    snapshot = exam.get("attempt_snapshot", {})
    remaining_seconds = snapshot.get("remaining_seconds", 0)

    if exam.get("status") == "in_progress":
        last_active_at = ensure_utc_aware(
            exam.get("resumed_at") or exam.get("started_at") or exam.get("updated_at")
        )
        if last_active_at is not None:
            elapsed_seconds = max(0, int((now - last_active_at).total_seconds()))
            remaining_seconds = max(0, remaining_seconds - elapsed_seconds)

    return {
        "remaining_seconds": remaining_seconds,
        "current_index": snapshot.get("current_index", 0),
        "answers": snapshot.get("answers", {}),
        "flagged": snapshot.get("flagged", {}),
    }


def create_exam_with_questions(db, user_id: str, payload) -> dict:
    new_exam = exam_document(
        user_id=user_id,
        title=payload.title,
        source_type=payload.source_type,
        input_mode=payload.input_mode,
        difficulty=payload.difficulty,
        objective_count=payload.objective_count,
        descriptive_count=payload.descriptive_count,
        options_count=payload.options_count,
        timer_mode=payload.timer_mode,
        total_duration_minutes=payload.total_duration_minutes,
        section_timers=[s.model_dump() for s in payload.section_timers],
        question_time_seconds=payload.question_time_seconds,
        pdf_filename=payload.pdf_filename,
        topic_name=payload.topic_name,
        instructions=payload.instructions,
    )

    insert_result = db.exams.insert_one(new_exam)
    exam = db.exams.find_one({"_id": insert_result.inserted_id})

    if not exam:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to create exam.",
        )

    total_questions = 0
    prepared_at = None

    if exam["source_type"] != "pdf":
        generation_status = "not_applicable"
    else:
        generation_status = "failed"
        try:
            if exam.get("pdf_filename"):
                pdf_path = Path("uploads") / exam["pdf_filename"]
                if not pdf_path.exists():
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail=f"Uploaded PDF not found at {pdf_path}",
                    )
                num_questions = prepare_questions_for_exam_from_pdf(
                    exam_id=str(exam["_id"]),
                    user_id=user_id,
                    pdf_path=pdf_path,
                    objective_count=exam["objective_count"],
                    descriptive_count=exam["descriptive_count"],
                    options_count=exam["options_count"],
                    difficulty=exam["difficulty"],
                    input_mode=exam["input_mode"],
                )
                total_questions = num_questions
                generation_status = "completed"
                prepared_at = utc_now()
        except HTTPException:
            raise
        except Exception as e:
            db.exams.update_one(
                {"_id": exam["_id"]},
                {"$set": {"generation_status": "failed", "updated_at": utc_now()}},
            )
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Question generation failed: {str(e)}",
            )

    status_value = "ready" if generation_status in {"completed", "not_applicable"} else "draft"

    db.exams.update_one(
        {"_id": exam["_id"]},
        {"$set": {
            "total_questions": total_questions,
            "generation_status": generation_status,
            "prepared_at": prepared_at,
            "status": status_value,
            "updated_at": utc_now(),
        }},
    )

    return db.exams.find_one({"_id": exam["_id"]})