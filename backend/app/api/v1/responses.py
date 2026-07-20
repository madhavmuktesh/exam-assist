from datetime import datetime, timezone

from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException, status

from app.api.deps import get_current_user
from app.core.database import get_database
from app.models.response import response_document
from app.models.result import result_document
from app.schemas.response import ExamSubmitRequest, ResponseListResponse
from app.schemas.result import ResultResponse
from app.services.scoring_service import score_exam
from app.utils.response_utils import serialize_response_item, serialize_result
from app.services.exam_service import get_exam_or_404

router = APIRouter(prefix="/responses", tags=["responses"])


@router.post("/exam/{exam_id}/submit", response_model=ResultResponse)
def submit_exam(
    exam_id: str,
    payload: ExamSubmitRequest,
    current_user: dict = Depends(get_current_user),
):
    db = get_database()
    exam = get_exam_or_404(db, exam_id, str(current_user["_id"]))

    questions = list(
        db.questions.find({
            "exam_id": str(exam["_id"]),
            "user_id": str(current_user["_id"]),
            "is_active": True,
        }).sort("question_order", 1)
    )

    if not questions:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="No questions found for this exam")

    question_map = {str(q["_id"]): q for q in questions}
    db.responses.delete_many({"exam_id": str(exam["_id"]), "user_id": str(current_user["_id"])})

    stored_response_docs = []
    for answer in payload.answers:
        if not ObjectId.is_valid(answer.question_id):
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Invalid question id: {answer.question_id}")

        question = question_map.get(answer.question_id)
        if not question:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Question does not belong to this exam: {answer.question_id}")

        if answer.question_type != question["question_type"]:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Question type mismatch for question: {answer.question_id}")

        stored_response_docs.append(response_document(
            exam_id=str(exam["_id"]),
            question_id=answer.question_id,
            user_id=str(current_user["_id"]),
            question_type=answer.question_type,
            selected_option_ids=answer.selected_option_ids,
            descriptive_answer=answer.descriptive_answer,
            time_taken_seconds=answer.time_taken_seconds,
            is_flagged_for_review=answer.is_flagged_for_review,
        ))

    if stored_response_docs:
        db.responses.insert_many(stored_response_docs)

    stored_responses = list(db.responses.find({"exam_id": str(exam["_id"]), "user_id": str(current_user["_id"]), "is_active": True}))
    responses_map = {str(item["question_id"]): item for item in stored_responses}
    scoring = score_exam(questions, responses_map)

    db.results.delete_many({"exam_id": str(exam["_id"]), "user_id": str(current_user["_id"])})

    result_doc = result_document(
        exam_id=str(exam["_id"]),
        user_id=str(current_user["_id"]),
        **{k: scoring[k] for k in [
            "total_questions", "attempted_questions", "objective_total",
            "objective_attempted", "objective_correct", "objective_wrong",
            "descriptive_total", "descriptive_attempted", "max_marks",
            "objective_score", "descriptive_score", "final_score",
            "percentage", "status", "review_required", "answer_breakdown",
        ]},
    )

    result_insert = db.results.insert_one(result_doc)

    db.exams.update_one(
        {"_id": exam["_id"]},
        {
            "$set": {"status": "submitted", "submitted_at": datetime.now(timezone.utc), "updated_at": datetime.now(timezone.utc)},
            "$unset": {"paused_at": "", "resumed_at": "", "attempt_snapshot": ""},
        },
    )

    created_result = db.results.find_one({"_id": result_insert.inserted_id})
    return serialize_result(created_result)


@router.get("/exam/{exam_id}", response_model=ResponseListResponse)
def list_exam_responses(exam_id: str, current_user: dict = Depends(get_current_user)):
    db = get_database()
    exam = get_exam_or_404(db, exam_id, str(current_user["_id"]))
    responses = list(db.responses.find({"exam_id": str(exam["_id"]), "user_id": str(current_user["_id"]), "is_active": True}).sort("created_at", 1))
    return {"responses": [serialize_response_item(item) for item in responses]}


@router.get("/exam/{exam_id}/result", response_model=ResultResponse)
def get_exam_result(exam_id: str, current_user: dict = Depends(get_current_user)):
    db = get_database()
    exam = get_exam_or_404(db, exam_id, str(current_user["_id"]))
    result = db.results.find_one({"exam_id": str(exam["_id"]), "user_id": str(current_user["_id"])})
    if not result:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Result not found for this exam")
    return serialize_result(result)


@router.delete("/exam/{exam_id}/result", status_code=status.HTTP_204_NO_CONTENT)
def delete_exam_result(exam_id: str, current_user: dict = Depends(get_current_user)):
    db = get_database()
    exam = get_exam_or_404(db, exam_id, str(current_user["_id"]))
    delete_result = db.results.delete_one({"exam_id": str(exam["_id"]), "user_id": str(current_user["_id"])})
    if delete_result.deleted_count == 0:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Result not found for this exam")
    db.exams.update_one(
        {"_id": exam["_id"]},
        {"$set": {"status": "draft", "updated_at": datetime.now(timezone.utc)}, "$unset": {"submitted_at": ""}},
    )