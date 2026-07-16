from datetime import datetime, timezone
from pathlib import Path

from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException, Query, status

from app.api.deps import get_current_user
from app.core.database import get_database
from app.models.exam import exam_document
from app.services.question_service import prepare_questions_for_exam_from_pdf
from app.schemas.exam import (
    ExamCreateRequest,
    ExamListResponse,
    ExamResponse,
    ExamUpdateRequest,
    PaginatedExamListResponse,
)

router = APIRouter(prefix="/exams", tags=["exams"])


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
        "total_questions": exam["total_questions"],
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
    }

@router.post("", response_model=ExamResponse, status_code=status.HTTP_201_CREATED)
def create_exam(
    payload: ExamCreateRequest,
    current_user: dict = Depends(get_current_user),
):
    """
    Create an exam and:
    - If source_type='pdf', try to auto-generate questions from the PDF.
    - Otherwise, mark generation_status as 'not_applicable'.
    """
    db = get_database()

    # ---- Basic logical validations ----
    total_requested_questions = payload.objective_count + payload.descriptive_count
    if total_requested_questions <= 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="You must request at least one question (objective + descriptive > 0).",
        )

    if payload.options_count < 2 or payload.options_count > 6:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="options_count must be between 2 and 6.",
        )

    # Source-specific validation
    if payload.source_type == "pdf" and not payload.pdf_filename:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="pdf_filename is required for pdf-based exams.",
        )

    if payload.source_type == "topic" and not payload.topic_name:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="topic_name is required for topic-based exams.",
        )

    # Timer-specific validation
    if payload.timer_mode == "full_exam":
        if payload.total_duration_minutes is None or payload.total_duration_minutes <= 0:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="total_duration_minutes must be positive for 'full_exam' timer mode.",
            )

    if payload.timer_mode == "per_section":
        if not payload.section_timers:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="section_timers must be provided for 'per_section' timer mode.",
            )
        if any(st.duration_minutes <= 0 for st in payload.section_timers):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Each section timer duration_minutes must be positive.",
            )

    if payload.timer_mode == "per_question":
        if payload.question_time_seconds is None or payload.question_time_seconds <= 0:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="question_time_seconds must be positive for 'per_question' timer mode.",
            )

    # ---- Build initial exam document (0 total_questions; will update after generation) ----
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

    # Decide whether generation applies at all
    if exam["source_type"] != "pdf":
        generation_status = "not_applicable"
    else:
        # Default to failed; will set to completed if generation succeeds
        generation_status = "failed"
        try:
            if exam["pdf_filename"]:
                uploads_dir = Path("uploads")
                pdf_path = uploads_dir / exam["pdf_filename"]

                if not pdf_path.exists():
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail=f"Uploaded PDF not found at {pdf_path}",
                    )

                file_bytes = pdf_path.read_bytes()

                num_questions = prepare_questions_for_exam_from_pdf(
                    exam_id=str(exam["_id"]),
                    user_id=str(current_user["_id"]),
                    file_name=exam["pdf_filename"],
                    file_bytes=file_bytes,
                    objective_count=exam["objective_count"],
                    descriptive_count=exam["descriptive_count"],
                    options_count=exam["options_count"],
                    difficulty=exam["difficulty"],
                    input_mode=exam["input_mode"],
                )

                total_questions = num_questions
                generation_status = "completed"
                prepared_at = datetime.now(timezone.utc)
        except HTTPException:
            # Bubble up HTTP errors (e.g., missing PDF)
            raise
        except Exception:
            # Keep generation_status = "failed"
            generation_status = "failed"

    # ---- Update exam with generation info and total_questions ----
    db.exams.update_one(
        {"_id": exam["_id"]},
        {
            "$set": {
                "total_questions": total_questions,
                "generation_status": generation_status,
                "prepared_at": prepared_at,
                "updated_at": datetime.now(timezone.utc),
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
        .sort("created_at", -1)
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

    if not ObjectId.is_valid(exam_id):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid exam id",
        )

    exam = db.exams.find_one(
        {"_id": ObjectId(exam_id), "user_id": str(current_user["_id"]), "is_active": True}
    )

    if not exam:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Exam not found",
        )

    return serialize_exam(exam)


@router.put("/{exam_id}", response_model=ExamResponse)
def update_exam(
    exam_id: str,
    payload: ExamUpdateRequest,
    current_user: dict = Depends(get_current_user),
):
    db = get_database()

    if not ObjectId.is_valid(exam_id):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid exam id",
        )

    exam = db.exams.find_one(
        {"_id": ObjectId(exam_id), "user_id": str(current_user["_id"]), "is_active": True}
    )

    if not exam:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Exam not found",
        )

    update_data = payload.model_dump(exclude_none=True)

    if update_data:
        update_data["updated_at"] = datetime.now(timezone.utc)

        db.exams.update_one(
            {"_id": ObjectId(exam_id)},
            {"$set": update_data},
        )

    updated_exam = db.exams.find_one({"_id": ObjectId(exam_id)})
    return serialize_exam(updated_exam)


@router.delete("/{exam_id}", status_code=status.HTTP_200_OK)
def delete_exam(exam_id: str, current_user: dict = Depends(get_current_user)):
    db = get_database()

    if not ObjectId.is_valid(exam_id):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid exam id",
        )

    exam = db.exams.find_one(
        {"_id": ObjectId(exam_id), "user_id": str(current_user["_id"]), "is_active": True}
    )

    if not exam:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Exam not found",
        )

    db.exams.update_one(
        {"_id": ObjectId(exam_id)},
        {
            "$set": {
                "is_active": False,
                "updated_at": datetime.now(timezone.utc),
            }
        },
    )

    return {"message": "Exam deleted successfully"}