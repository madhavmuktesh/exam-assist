from fastapi import APIRouter, Depends, HTTPException, Query, status

from app.api.deps import get_current_user
from app.core.database import get_database
from app.services.exam_service import (
    serialize_exam,
    serialize_student_question,
    get_exam_or_404,
    build_resume_payload,
    create_exam_with_questions,
    utc_now,
)
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

router = APIRouter(prefix="/exams", tags=["exams"])


@router.post("", response_model=ExamResponse, status_code=status.HTTP_201_CREATED)
def create_exam(
    payload: ExamCreateRequest,
    current_user: dict = Depends(get_current_user),
):
    db = get_database()
    exam = create_exam_with_questions(db, str(current_user["_id"]), payload)
    return serialize_exam(exam)


@router.get("", response_model=PaginatedExamListResponse)
def list_exams(
    current_user: dict = Depends(get_current_user),
    page: int = Query(default=1, ge=1),
    limit: int = Query(default=10, ge=1, le=100),
):
    db = get_database()
    query = {"user_id": str(current_user["_id"]), "is_active": True}
    total = db.exams.count_documents(query)
    skip = (page - 1) * limit
    exams = list(db.exams.find(query).sort("updated_at", -1).skip(skip).limit(limit))

    return {
        "exams": [serialize_exam(e) for e in exams],
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
        {"$set": {"is_active": False, "updated_at": utc_now()}},
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
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Cancelled exams cannot be started again.")
    if current_status == "submitted":
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Submitted exams cannot be started again.")
    if current_status == "draft":
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Exam is not ready yet.")

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
                "$unset": {"cancelled_at": "", "paused_at": ""},
            },
        )
        exam = db.exams.find_one({"_id": exam["_id"]})
        resume_payload = build_resume_payload(exam)

    elif current_status == "paused":
        resume_payload = build_resume_payload(exam)
        db.exams.update_one(
            {"_id": exam["_id"]},
            {"$set": {"status": "in_progress", "resumed_at": now, "updated_at": now}, "$unset": {"paused_at": ""}},
        )
        exam = db.exams.find_one({"_id": exam["_id"]})
        resume_payload = build_resume_payload(exam)

    elif current_status == "in_progress":
        resume_payload = build_resume_payload(exam)
        if resume_payload and resume_payload["remaining_seconds"] <= 0:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Exam time is over. Submit the exam.")
        db.exams.update_one(
            {"_id": exam["_id"]},
            {"$set": {
                "resumed_at": now,
                "updated_at": now,
                "attempt_snapshot.remaining_seconds": resume_payload["remaining_seconds"] if resume_payload else 0,
            }},
        )
        exam = db.exams.find_one({"_id": exam["_id"]})
        resume_payload = build_resume_payload(exam)

    raw_questions = list(
        db.questions.find({
            "exam_id": str(exam["_id"]),
            "user_id": str(current_user["_id"]),
            "is_active": True,
        }).sort("question_order", 1)
    )

    if not raw_questions:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="No questions found for this exam.")

    return {
        "exam_id": str(exam["_id"]),
        "timer_mode": exam["timer_mode"],
        "total_duration_minutes": exam.get("total_duration_minutes"),
        "question_time_seconds": exam.get("question_time_seconds"),
        "status": exam["status"],
        "resume_payload": resume_payload,
        "questions": [serialize_student_question(q) for q in raw_questions],
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
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Only in-progress exams can be paused.")

    paused_at = utc_now()
    db.exams.update_one(
        {"_id": exam["_id"]},
        {"$set": {
            "status": "paused",
            "paused_at": paused_at,
            "updated_at": paused_at,
            "attempt_snapshot": {
                "remaining_seconds": max(0, int(payload.remaining_seconds or 0)),
                "current_index": payload.current_index,
                "answers": payload.answers,
                "flagged": payload.flagged,
            },
        }},
    )
    return {"message": "Exam paused successfully", "exam_id": str(exam["_id"]), "status": "paused", "paused_at": paused_at}


@router.post("/{exam_id}/cancel", response_model=ExamCancelResponse)
def cancel_exam(exam_id: str, current_user: dict = Depends(get_current_user)):
    db = get_database()
    exam = get_exam_or_404(db, exam_id, str(current_user["_id"]))

    if exam.get("status") not in ["draft", "ready", "in_progress", "paused"]:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="This exam cannot be cancelled in its current state.")

    db.responses.delete_many({"exam_id": str(exam["_id"]), "user_id": str(current_user["_id"])})
    db.results.delete_many({"exam_id": str(exam["_id"]), "user_id": str(current_user["_id"])})

    cancelled_at = utc_now()
    db.exams.update_one(
        {"_id": exam["_id"]},
        {
            "$set": {"status": "cancelled", "cancelled_at": cancelled_at, "updated_at": cancelled_at},
            "$unset": {"submitted_at": "", "paused_at": "", "resumed_at": "", "attempt_snapshot": ""},
        },
    )
    return {"message": "Exam cancelled successfully"}