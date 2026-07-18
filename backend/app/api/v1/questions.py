from datetime import datetime, timezone

from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException, status

from app.api.deps import get_current_user
from app.core.database import get_database
from app.models.question import question_document
from app.schemas.question import (
    AuthorQuestionListResponse,
    AuthorQuestionResponse,
    QuestionCreateRequest,
    QuestionUpdateRequest,
    StudentQuestionListResponse,
)

router = APIRouter(prefix="/questions", tags=["questions"])


def serialize_author_question(question: dict) -> dict:
    return {
        "id": str(question["_id"]),
        "exam_id": str(question["exam_id"]),
        "user_id": str(question["user_id"]),
        "question_type": question["question_type"],
        "question_text": question["question_text"],
        "question_order": question["question_order"],
        "marks": question["marks"],
        "options": question.get("options", []),
        "correct_option_ids": question.get("correct_option_ids", []),
        "correct_answer_text": question.get("correct_answer_text"),
        "explanation": question.get("explanation"),
        "section_name": question.get("section_name"),
        "difficulty": question.get("difficulty"),
        "source_chunk_ids": question.get("source_chunk_ids", []),
        "time_limit_seconds": question.get("time_limit_seconds"),
        "is_active": question.get("is_active", True),
        "created_at": question["created_at"],
        "updated_at": question["updated_at"],
    }


def serialize_student_question(question: dict) -> dict:
    return {
        "id": str(question["_id"]),
        "exam_id": str(question["exam_id"]),
        "question_type": question["question_type"],
        "question_text": question["question_text"],
        "question_order": question["question_order"],
        "marks": question["marks"],
        "options": question.get("options", []),
        "section_name": question.get("section_name"),
        "difficulty": question.get("difficulty"),
        "time_limit_seconds": question.get("time_limit_seconds"),
    }


def get_exam_for_user(db, exam_id: str, user_id: str):
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


@router.post("/exam/{exam_id}", response_model=AuthorQuestionResponse, status_code=status.HTTP_201_CREATED)
def create_question(
    exam_id: str,
    payload: QuestionCreateRequest,
    current_user: dict = Depends(get_current_user),
):
    db = get_database()
    exam = get_exam_for_user(db, exam_id, str(current_user["_id"]))

    if exam.get("status") == "submitted":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot add questions to a submitted exam",
        )

    existing_order = db.questions.find_one(
        {
            "exam_id": str(exam["_id"]),
            "question_order": payload.question_order,
            "is_active": True,
        }
    )
    if existing_order:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Question order already exists for this exam",
        )

    new_question = question_document(
        exam_id=str(exam["_id"]),
        user_id=str(current_user["_id"]),
        question_type=payload.question_type,
        question_text=payload.question_text,
        question_order=payload.question_order,
        marks=payload.marks,
        options=[option.model_dump() for option in payload.options],
        correct_option_ids=payload.correct_option_ids,
        correct_answer_text=payload.correct_answer_text,
        explanation=payload.explanation,
        section_name=payload.section_name,
        difficulty=payload.difficulty,
        source_chunk_ids=payload.source_chunk_ids,
        time_limit_seconds=payload.time_limit_seconds,
    )

    result = db.questions.insert_one(new_question)
    created_question = db.questions.find_one({"_id": result.inserted_id})

    return serialize_author_question(created_question)


@router.get("/exam/{exam_id}/author", response_model=AuthorQuestionListResponse)
def list_questions_for_author(
    exam_id: str,
    current_user: dict = Depends(get_current_user),
):
    db = get_database()
    exam = get_exam_for_user(db, exam_id, str(current_user["_id"]))

    questions = list(
        db.questions.find(
            {"exam_id": str(exam["_id"]), "is_active": True}
        ).sort("question_order", 1)
    )

    return {"questions": [serialize_author_question(question) for question in questions]}


@router.get("/exam/{exam_id}/start", response_model=StudentQuestionListResponse)
def start_exam_questions(
    exam_id: str,
    current_user: dict = Depends(get_current_user),
):
    db = get_database()
    exam = get_exam_for_user(db, exam_id, str(current_user["_id"]))

    if exam.get("status") == "submitted":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="This exam has already been submitted and cannot be started again",
        )

    if exam.get("generation_status") != "completed":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Exam is not ready to start. generation_status={exam.get('generation_status')}",
        )

    questions = list(
        db.questions.find(
            {"exam_id": str(exam["_id"]), "is_active": True}
        ).sort("question_order", 1)
    )

    if not questions:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Exam generation was marked completed, but no questions were found",
        )

    db.exams.update_one(
        {"_id": exam["_id"]},
        {
            "$set": {
                "status": "in_progress",
                "started_at": exam.get("started_at") or datetime.now(timezone.utc),
                "updated_at": datetime.now(timezone.utc),
            }
        },
    )

    return {"questions": [serialize_student_question(question) for question in questions]}


@router.get("/{question_id}", response_model=AuthorQuestionResponse)
def get_question(
    question_id: str,
    current_user: dict = Depends(get_current_user),
):
    db = get_database()

    if not ObjectId.is_valid(question_id):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid question id",
        )

    question = db.questions.find_one(
        {"_id": ObjectId(question_id), "user_id": str(current_user["_id"]), "is_active": True}
    )

    if not question:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Question not found",
        )

    return serialize_author_question(question)


@router.put("/{question_id}", response_model=AuthorQuestionResponse)
def update_question(
    question_id: str,
    payload: QuestionUpdateRequest,
    current_user: dict = Depends(get_current_user),
):
    db = get_database()

    if not ObjectId.is_valid(question_id):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid question id",
        )

    question = db.questions.find_one(
        {"_id": ObjectId(question_id), "user_id": str(current_user["_id"]), "is_active": True}
    )

    if not question:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Question not found",
        )

    exam = db.exams.find_one(
        {"_id": ObjectId(question["exam_id"]), "user_id": str(current_user["_id"]), "is_active": True}
    )

    if not exam:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Parent exam not found",
        )

    if exam.get("status") == "submitted":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot edit questions of a submitted exam",
        )

    update_data = payload.model_dump(exclude_none=True)

    if "options" in update_data and payload.options is not None:
        update_data["options"] = [option.model_dump() for option in payload.options]

    if update_data:
        final_type = question["question_type"]
        final_options = update_data.get("options", question.get("options", []))
        final_correct_ids = update_data.get(
            "correct_option_ids", question.get("correct_option_ids", [])
        )
        final_correct_answer_text = update_data.get(
            "correct_answer_text", question.get("correct_answer_text")
        )

        if final_type == "objective":
            if len(final_options) < 2:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Objective questions must have at least 2 options",
                )

            option_ids = {option["id"] for option in final_options}
            if not set(final_correct_ids).issubset(option_ids):
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="All correct_option_ids must exist in options",
                )

            if final_correct_answer_text is not None:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="correct_answer_text must be empty for objective questions",
                )

        if final_type == "descriptive":
            if final_options:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Descriptive questions cannot have options",
                )

            if final_correct_ids:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Descriptive questions cannot have correct_option_ids",
                )

        if "question_order" in update_data:
            existing_order = db.questions.find_one(
                {
                    "exam_id": question["exam_id"],
                    "question_order": update_data["question_order"],
                    "is_active": True,
                    "_id": {"$ne": question["_id"]},
                }
            )
            if existing_order:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Question order already exists for this exam",
                )

        update_data["updated_at"] = datetime.now(timezone.utc)

        db.questions.update_one(
            {"_id": question["_id"]},
            {"$set": update_data},
        )

    updated_question = db.questions.find_one({"_id": question["_id"]})
    return serialize_author_question(updated_question)


@router.delete("/{question_id}", status_code=status.HTTP_200_OK)
def delete_question(
    question_id: str,
    current_user: dict = Depends(get_current_user),
):
    db = get_database()

    if not ObjectId.is_valid(question_id):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid question id",
        )

    question = db.questions.find_one(
        {"_id": ObjectId(question_id), "user_id": str(current_user["_id"]), "is_active": True}
    )

    if not question:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Question not found",
        )

    exam = db.exams.find_one(
        {"_id": ObjectId(question["exam_id"]), "user_id": str(current_user["_id"]), "is_active": True}
    )

    if not exam:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Parent exam not found",
        )

    if exam.get("status") == "submitted":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot delete questions from a submitted exam",
        )

    db.questions.update_one(
        {"_id": question["_id"]},
        {
            "$set": {
                "is_active": False,
                "updated_at": datetime.now(timezone.utc),
            }
        },
    )

    return {"message": "Question deleted successfully"}