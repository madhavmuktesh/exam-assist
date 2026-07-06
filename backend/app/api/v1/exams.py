from datetime import datetime, timezone

from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException, status

from app.api.deps import get_current_user
from app.core.database import get_database
from app.models.exam import exam_document
from app.schemas.exam import (
    ExamCreateRequest,
    ExamListResponse,
    ExamResponse,
    ExamUpdateRequest,
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

    result = db.exams.insert_one(new_exam)
    created_exam = db.exams.find_one({"_id": result.inserted_id})

    return serialize_exam(created_exam)


@router.get("", response_model=ExamListResponse)
def list_exams(current_user: dict = Depends(get_current_user)):
    db = get_database()

    exams = list(
        db.exams.find({"user_id": str(current_user["_id"]), "is_active": True}).sort(
            "created_at", -1
        )
    )

    return {"exams": [serialize_exam(exam) for exam in exams]}


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