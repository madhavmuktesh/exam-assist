from datetime import datetime, timezone
from pathlib import Path

from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException, Query, status

from app.api.deps import get_current_user
from app.core.database import get_database
from app.models.exam import exam_document
from app.schemas.exam import (
    ExamCancelResponse,
    ExamCreateRequest,
    ExamPauseRequest,
    ExamPauseResponse,
    ExamResponse,
    ExamUpdateRequest,
    PaginatedExamListResponse,
    StartExamResponse,
)
from app.services.question_service import prepare_questions_for_exam_from_pdf

router = APIRouter(prefix="/exams", tags=["exams"])


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


def get_exam_or_404(db, exam_id: str, user_id: str):
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


def build_resume_payload_for_exam(exam: dict):
    now = datetime.now(timezone.utc)

    last_active_at = ensure_utc_aware(
        exam.get("resumed_at")
        or exam.get("paused_at")
        or exam.get("started_at")
        or exam.get("updated_at")
    )

    remaining_seconds = exam.get("remaining_seconds", 0)

    if last_active_at is not None:
        elapsed_seconds = max(0, int((now - last_active_at).total_seconds()))
        remaining_seconds = max(0, remaining_seconds - elapsed_seconds)

    return {
        "remaining_seconds": remaining_seconds,
        "current_index": exam.get("current_index", 0),
        "answers": exam.get("answers", {}),
        "flagged": exam.get("flagged", {}),
    }

@router.post("", response_model=ExamResponse, status_code=status.HTTP_201_CREATED)
def create_exam(
    payload: ExamCreateRequest,
    current_user: dict = Depends(get_current_user),
):
    db = get_database()

    new_exam = exam_document(
        user_id=str(current_user["_id"]),
        title=payload.title,
        source_type=payload.source_type,
        input_mode=payload.input_mode,
        difficulty=payload.difficulty,
        objective_count=payload.objective_count,
        descriptive_count=payload.descriptive_count,
        options_count=payload.options_count,
        timer_mode=payload.timer_mode,
        total_duration_minutes=payload.total_duration_minutes,
        section_timers=[section.model_dump() for section in payload.section_timers],
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
                uploads_dir = Path("uploads")
                pdf_path = uploads_dir / exam["pdf_filename"]

                if not pdf_path.exists():
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail=f"Uploaded PDF not found at {pdf_path}",
                    )

                num_questions = prepare_questions_for_exam_from_pdf(
                    exam_id=str(exam["_id"]),
                    user_id=str(current_user["_id"]),
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
                {
                    "$set": {
                        "generation_status": "failed",
                        "updated_at": utc_now(),
                    }
                },
            )
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Question generation failed: {str(e)}",
            )

    status_value = (
        "ready" if generation_status in {"completed", "not_applicable"} else "draft"
    )

    db.exams.update_one(
        {"_id": exam["_id"]},
        {
            "$set": {
                "total_questions": total_questions,
                "generation_status": generation_status,
                "prepared_at": prepared_at,
                "status": status_value,
                "updated_at": utc_now(),
            }
        },
    )

    updated_exam = db.exams.find_one({"_id": exam["_id"]})
    return serialize_exam(updated_exam)


@router.get("", response_model=PaginatedExamListResponse)
def list_exams(
    current_user: dict = Depends(get_current_user),
    page: int = Query(default=1, ge=1, description="Page number"),
    limit: int = Query(default=10, ge=1, le=100, description="Items per page"),
):
    db = get_database()

    query = {"user_id": str(current_user["_id"]), "is_active": True}
    total = db.exams.count_documents(query)
    skip = (page - 1) * limit

    exams = list(
        db.exams.find(query)
        .sort("updated_at", -1)
        .skip(skip)
        .limit(limit)
    )

    return {
        "exams": [serialize_exam(exam) for exam in exams],
        "total": total,
        "page": page,
        "limit": limit,
        "has_next": (skip + limit) < total,
        "has_prev": page > 1,
    }


@router.get("/{exam_id}", response_model=ExamResponse)
def get_exam(exam_id: str, current_user: dict = Depends(get_current_user)):
    db = get_database()
    exam = get_exam_or_404(db, exam_id, str(current_user["_id"]))
    return serialize_exam(exam)


@router.put("/{exam_id}", response_model=ExamResponse)
def update_exam(
    exam_id: str,
    payload: ExamUpdateRequest,
    current_user: dict = Depends(get_current_user),
):
    db = get_database()
    exam = get_exam_or_404(db, exam_id, str(current_user["_id"]))

    update_data = payload.model_dump(exclude_none=True)

    if update_data:
        update_data["updated_at"] = utc_now()
        db.exams.update_one({"_id": exam["_id"]}, {"$set": update_data})

    updated_exam = db.exams.find_one({"_id": exam["_id"]})
    return serialize_exam(updated_exam)


@router.delete("/{exam_id}", status_code=status.HTTP_200_OK)
def delete_exam(exam_id: str, current_user: dict = Depends(get_current_user)):
    db = get_database()
    exam = get_exam_or_404(db, exam_id, str(current_user["_id"]))

    db.exams.update_one(
        {"_id": exam["_id"]},
        {
            "$set": {
                "is_active": False,
                "updated_at": utc_now(),
            }
        },
    )

    return {"message": "Exam deleted successfully"}


@router.post("/{exam_id}/start", response_model=StartExamResponse)
def start_exam(exam_id: str, current_user: dict = Depends(get_current_user)):
    db = get_database()
    exam = get_exam_or_404(db, exam_id, str(current_user["_id"]))

    current_status = exam.get("status")
    now = utc_now()
    resume_payload = None

    if current_status == "cancelled":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cancelled exams cannot be started again.",
        )

    if current_status == "submitted":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Submitted exams cannot be started again.",
        )

    if current_status == "draft":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Exam is not ready yet.",
        )

    if current_status in ["ready", "evaluated", "reviewed", "pending_review"]:
        initial_remaining_seconds = 0
        if exam.get("timer_mode") in {"full_exam", "per_section"}:
            initial_remaining_seconds = int((exam.get("total_duration_minutes") or 0) * 60)
        elif exam.get("timer_mode") == "per_question":
            initial_remaining_seconds = int(exam.get("question_time_seconds") or 0)

        db.exams.update_one(
            {"_id": exam["_id"]},
            {
                "$set": {
                    "status": "in_progress",
                    "started_at": exam.get("started_at") or now,
                    "resumed_at": now,
                    "updated_at": now,
                    "attempt_snapshot": {
                        "remaining_seconds": initial_remaining_seconds,
                        "current_index": 0,
                        "answers": {},
                        "flagged": {},
                    },
                },
                "$unset": {
                    "cancelled_at": "",
                    "paused_at": "",
                },
            },
        )
        exam = db.exams.find_one({"_id": exam["_id"]})
        resume_payload = build_resume_payload_for_exam(exam)

    elif current_status == "paused":
        resume_payload = build_resume_payload_for_exam(exam)

        db.exams.update_one(
            {"_id": exam["_id"]},
            {
                "$set": {
                    "status": "in_progress",
                    "resumed_at": now,
                    "updated_at": now,
                },
                "$unset": {
                    "paused_at": "",
                },
            },
        )
        exam = db.exams.find_one({"_id": exam["_id"]})
        resume_payload = build_resume_payload_for_exam(exam)

    elif current_status == "in_progress":
        resume_payload = build_resume_payload_for_exam(exam)

        if resume_payload and resume_payload["remaining_seconds"] <= 0:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Exam time is over. Submit the exam.",
            )

        db.exams.update_one(
            {"_id": exam["_id"]},
            {
                "$set": {
                    "resumed_at": now,
                    "updated_at": now,
                    "attempt_snapshot.remaining_seconds": (
                        resume_payload["remaining_seconds"] if resume_payload else 0
                    ),
                }
            },
        )
        exam = db.exams.find_one({"_id": exam["_id"]})
        resume_payload = build_resume_payload_for_exam(exam)

    raw_questions = list(
        db.questions.find(
            {
                "exam_id": str(exam["_id"]),
                "user_id": str(current_user["_id"]),
                "is_active": True,
            }
        ).sort("question_order", 1)
    )

    if not raw_questions:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No questions found for this exam. Generation may have failed.",
        )

    student_questions = [serialize_student_question(q) for q in raw_questions]

    return {
        "exam_id": str(exam["_id"]),
        "timer_mode": exam["timer_mode"],
        "total_duration_minutes": exam.get("total_duration_minutes"),
        "question_time_seconds": exam.get("question_time_seconds"),
        "status": exam["status"],
        "resume_payload": resume_payload,
        "questions": student_questions,
    }


@router.post("/{exam_id}/pause", response_model=ExamPauseResponse)
def pause_exam(
    exam_id: str,
    payload: ExamPauseRequest,
    current_user: dict = Depends(get_current_user),
):
    db = get_database()
    exam = get_exam_or_404(db, exam_id, str(current_user["_id"]))

    if exam.get("status") not in ["in_progress", "paused"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Only in-progress exams can be paused.",
        )

    paused_at = utc_now()

    safe_remaining_seconds = max(0, int(payload.remaining_seconds or 0))

    db.exams.update_one(
        {"_id": exam["_id"]},
        {
            "$set": {
                "status": "paused",
                "paused_at": paused_at,
                "updated_at": paused_at,
                "attempt_snapshot": {
                    "remaining_seconds": safe_remaining_seconds,
                    "current_index": payload.current_index,
                    "answers": payload.answers,
                    "flagged": payload.flagged,
                },
            }
        },
    )

    return {
        "message": "Exam paused successfully",
        "exam_id": str(exam["_id"]),
        "status": "paused",
        "paused_at": paused_at,
    }


@router.post("/{exam_id}/cancel", response_model=ExamCancelResponse)
def cancel_exam(exam_id: str, current_user: dict = Depends(get_current_user)):
    db = get_database()
    exam = get_exam_or_404(db, exam_id, str(current_user["_id"]))

    if exam.get("status") not in ["draft", "ready", "in_progress", "paused"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="This exam cannot be cancelled in its current state.",
        )

    db.responses.delete_many(
        {"exam_id": str(exam["_id"]), "user_id": str(current_user["_id"])}
    )
    db.results.delete_many(
        {"exam_id": str(exam["_id"]), "user_id": str(current_user["_id"])}
    )

    cancelled_at = utc_now()

    db.exams.update_one(
        {"_id": exam["_id"]},
        {
            "$set": {
                "status": "cancelled",
                "cancelled_at": cancelled_at,
                "updated_at": cancelled_at,
            },
            "$unset": {
                "submitted_at": "",
                "paused_at": "",
                "resumed_at": "",
                "attempt_snapshot": "",
            },
        },
    )

    return {"message": "Exam cancelled successfully"}