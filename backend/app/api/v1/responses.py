from datetime import datetime, timezone

from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException, status

from app.api.deps import get_current_user
from app.core.database import get_database
from app.models.response import response_document
from app.models.result import result_document
from app.schemas.response import (
    ExamHistoryResponse,
    ExamSubmitRequest,
    ResponseListResponse,
)
from app.schemas.result import ResultResponse
from app.services.scoring_service import score_exam

router = APIRouter(prefix="/responses", tags=["responses"])


def serialize_response_item(item: dict) -> dict:
    return {
        "id": str(item["_id"]),
        "exam_id": str(item["exam_id"]),
        "question_id": str(item["question_id"]),
        "user_id": str(item["user_id"]),
        "question_type": item["question_type"],
        "selected_option_ids": item.get("selected_option_ids", []),
        "descriptive_answer": item.get("descriptive_answer"),
        "time_taken_seconds": item.get("time_taken_seconds"),
        "is_flagged_for_review": item.get("is_flagged_for_review", False),
        "submitted_at": item["submitted_at"],
        "created_at": item["created_at"],
        "updated_at": item["updated_at"],
    }


def serialize_result(item: dict) -> dict:
    return {
        "id": str(item["_id"]),
        "exam_id": str(item["exam_id"]),
        "user_id": str(item["user_id"]),
        "total_questions": item["total_questions"],
        "attempted_questions": item["attempted_questions"],
        "objective_total": item["objective_total"],
        "objective_attempted": item["objective_attempted"],
        "objective_correct": item["objective_correct"],
        "objective_wrong": item["objective_wrong"],
        "descriptive_total": item["descriptive_total"],
        "descriptive_attempted": item["descriptive_attempted"],
        "max_marks": item["max_marks"],
        "objective_score": item["objective_score"],
        "descriptive_score": item["descriptive_score"],
        "final_score": item["final_score"],
        "percentage": item["percentage"],
        "status": item["status"],
        "review_required": item["review_required"],
        "answer_breakdown": item.get("answer_breakdown", []),
        "created_at": item["created_at"],
        "updated_at": item["updated_at"],
    }


def serialize_history_item(result_item: dict, exam_item: dict | None) -> dict:
    return {
        "exam_id": str(result_item["exam_id"]),
        "exam_title": exam_item["title"] if exam_item else "Untitled Exam",
        "final_score": result_item["final_score"],
        "max_marks": result_item["max_marks"],
        "percentage": result_item["percentage"],
        "status": result_item["status"],
        "created_at": result_item["created_at"],
        "updated_at": result_item["updated_at"],
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


@router.post("/exam/{exam_id}/submit", response_model=ResultResponse)
def submit_exam(
    exam_id: str,
    payload: ExamSubmitRequest,
    current_user: dict = Depends(get_current_user),
):
    db = get_database()
    exam = get_exam_or_404(db, exam_id, str(current_user["_id"]))

    questions = list(
        db.questions.find(
            {
                "exam_id": str(exam["_id"]),
                "user_id": str(current_user["_id"]),
                "is_active": True,
            }
        ).sort("question_order", 1)
    )

    if not questions:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No questions found for this exam",
        )

    question_map = {str(question["_id"]): question for question in questions}

    db.responses.delete_many(
        {"exam_id": str(exam["_id"]), "user_id": str(current_user["_id"])}
    )

    stored_response_docs: list[dict] = []

    for answer in payload.answers:
        if not ObjectId.is_valid(answer.question_id):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid question id: {answer.question_id}",
            )

        question = question_map.get(answer.question_id)
        if not question:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Question does not belong to this exam: {answer.question_id}",
            )

        if answer.question_type != question["question_type"]:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Question type mismatch for question: {answer.question_id}",
            )

        doc = response_document(
            exam_id=str(exam["_id"]),
            question_id=answer.question_id,
            user_id=str(current_user["_id"]),
            question_type=answer.question_type,
            selected_option_ids=answer.selected_option_ids,
            descriptive_answer=answer.descriptive_answer,
            time_taken_seconds=answer.time_taken_seconds,
            is_flagged_for_review=answer.is_flagged_for_review,
        )
        stored_response_docs.append(doc)

    if stored_response_docs:
        db.responses.insert_many(stored_response_docs)

    stored_responses = list(
        db.responses.find(
            {
                "exam_id": str(exam["_id"]),
                "user_id": str(current_user["_id"]),
                "is_active": True,
            }
        )
    )

    responses_map = {str(item["question_id"]): item for item in stored_responses}

    scoring = score_exam(questions, responses_map)

    db.results.delete_many(
        {"exam_id": str(exam["_id"]), "user_id": str(current_user["_id"])}
    )

    result_doc = result_document(
        exam_id=str(exam["_id"]),
        user_id=str(current_user["_id"]),
        total_questions=scoring["total_questions"],
        attempted_questions=scoring["attempted_questions"],
        objective_total=scoring["objective_total"],
        objective_attempted=scoring["objective_attempted"],
        objective_correct=scoring["objective_correct"],
        objective_wrong=scoring["objective_wrong"],
        descriptive_total=scoring["descriptive_total"],
        descriptive_attempted=scoring["descriptive_attempted"],
        max_marks=scoring["max_marks"],
        objective_score=scoring["objective_score"],
        descriptive_score=scoring["descriptive_score"],
        final_score=scoring["final_score"],
        percentage=scoring["percentage"],
        status=scoring["status"],
        review_required=scoring["review_required"],
        answer_breakdown=scoring["answer_breakdown"],
    )

    result_insert = db.results.insert_one(result_doc)

    db.exams.update_one(
        {"_id": exam["_id"]},
        {
            "$set": {
                "status": "submitted",
                "submitted_at": datetime.now(timezone.utc),
                "updated_at": datetime.now(timezone.utc),
            }
        },
    )

    created_result = db.results.find_one({"_id": result_insert.inserted_id})
    return serialize_result(created_result)


@router.get("/history", response_model=ExamHistoryResponse)
def get_exam_history(current_user: dict = Depends(get_current_user)):
    db = get_database()
    user_id = str(current_user["_id"])

    results = list(
        db.results.find({"user_id": user_id}).sort("created_at", -1)
    )

    if not results:
        return {"history": []}

    exam_ids = []
    for item in results:
        exam_id = item.get("exam_id")
        if exam_id and ObjectId.is_valid(exam_id):
            exam_ids.append(ObjectId(exam_id))

    exams = list(
        db.exams.find({"_id": {"$in": exam_ids}})
    ) if exam_ids else []

    exam_map = {str(exam["_id"]): exam for exam in exams}

    history = [
        serialize_history_item(item, exam_map.get(str(item["exam_id"])))
        for item in results
    ]

    return {"history": history}


@router.get("/exam/{exam_id}", response_model=ResponseListResponse)
def list_exam_responses(
    exam_id: str,
    current_user: dict = Depends(get_current_user),
):
    db = get_database()
    exam = get_exam_or_404(db, exam_id, str(current_user["_id"]))

    responses = list(
        db.responses.find(
            {
                "exam_id": str(exam["_id"]),
                "user_id": str(current_user["_id"]),
                "is_active": True,
            }
        ).sort("created_at", 1)
    )

    return {"responses": [serialize_response_item(item) for item in responses]}


@router.get("/exam/{exam_id}/result", response_model=ResultResponse)
def get_exam_result(
    exam_id: str,
    current_user: dict = Depends(get_current_user),
):
    db = get_database()
    exam = get_exam_or_404(db, exam_id, str(current_user["_id"]))

    result = db.results.find_one(
        {"exam_id": str(exam["_id"]), "user_id": str(current_user["_id"])}
    )

    if not result:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Result not found for this exam",
        )

    return serialize_result(result)