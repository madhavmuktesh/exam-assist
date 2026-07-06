from datetime import datetime, timezone

from bson import ObjectId
from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status

from app.api.deps import get_current_user
from app.core.database import get_database
from app.models.question import question_document
from app.schemas.pipeline import PdfUploadResponse, PrepareExamResponse
from app.services.pdf_service import extract_text_from_pdf, save_uploaded_pdf
from app.services.question_generation_service import (
    extract_existing_questions,
    generate_questions_from_content,
)

router = APIRouter(prefix="/pipeline", tags=["pipeline"])


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


@router.post("/exam/{exam_id}/upload-pdf", response_model=PdfUploadResponse)
async def upload_exam_pdf(
    exam_id: str,
    file: UploadFile = File(...),
    current_user: dict = Depends(get_current_user),
):
    db = get_database()
    exam = get_exam_for_user(db, exam_id, str(current_user["_id"]))

    if exam.get("status") == "submitted":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot upload PDF for a submitted exam",
        )

    if not file.filename or not file.filename.lower().endswith(".pdf"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Only PDF files are allowed",
        )

    file_bytes = await file.read()
    if not file_bytes:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Uploaded PDF is empty",
        )

    saved_path = save_uploaded_pdf(file.filename, file_bytes)
    extraction = extract_text_from_pdf(saved_path)
    now = datetime.now(timezone.utc)

    db.exams.update_one(
        {"_id": exam["_id"]},
        {
            "$set": {
                "pdf_filename": file.filename,
                "pdf_path": saved_path,
                "pdf_page_count": extraction["page_count"],
                "pdf_char_count": extraction["char_count"],
                "pdf_extraction_mode": extraction["extraction_mode"],
                "pdf_needs_ocr": extraction["needs_ocr"],
                "updated_at": now,
            }
        },
    )

    return {
        "exam_id": str(exam["_id"]),
        "pdf_filename": file.filename,
        "pdf_path": saved_path,
        "page_count": extraction["page_count"],
        "char_count": extraction["char_count"],
        "needs_ocr": extraction["needs_ocr"],
        "extraction_mode": extraction["extraction_mode"],
        "uploaded_at": now,
    }


@router.post("/exam/{exam_id}/prepare", response_model=PrepareExamResponse)
def prepare_exam_from_source(
    exam_id: str,
    current_user: dict = Depends(get_current_user),
):
    db = get_database()
    exam = get_exam_for_user(db, exam_id, str(current_user["_id"]))

    if exam.get("status") == "submitted":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot prepare a submitted exam",
        )

    pdf_path = exam.get("pdf_path")
    topic_name = exam.get("topic_name")
    source_type = exam.get("source_type")
    input_mode = exam.get("input_mode")

    source_text = ""

    if source_type in {"pdf", "questions_pdf"}:
        if not pdf_path:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="No PDF uploaded for this exam",
            )

        extraction = extract_text_from_pdf(pdf_path)
        source_text = extraction["full_text"]

        db.exams.update_one(
            {"_id": exam["_id"]},
            {
                "$set": {
                    "generation_status": "processing",
                    "pdf_page_count": extraction["page_count"],
                    "pdf_char_count": extraction["char_count"],
                    "pdf_extraction_mode": extraction["extraction_mode"],
                    "pdf_needs_ocr": extraction["needs_ocr"],
                    "updated_at": datetime.now(timezone.utc),
                }
            },
        )
    elif source_type == "topic":
        source_text = topic_name or ""
        extraction = {
            "char_count": len(source_text),
            "needs_ocr": False,
        }
        db.exams.update_one(
            {"_id": exam["_id"]},
            {
                "$set": {
                    "generation_status": "processing",
                    "updated_at": datetime.now(timezone.utc),
                }
            },
        )
    else:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Unsupported source type",
        )

    if not source_text.strip():
        db.exams.update_one(
            {"_id": exam["_id"]},
            {
                "$set": {
                    "generation_status": "failed",
                    "updated_at": datetime.now(timezone.utc),
                }
            },
        )
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No extractable content found in source",
        )

    db.questions.delete_many({"exam_id": str(exam["_id"])})

    try:
        if input_mode == "generate_from_content":
            generated_questions = generate_questions_from_content(
                text=source_text,
                objective_count=exam["objective_count"],
                descriptive_count=exam["descriptive_count"],
                options_count=exam["options_count"],
                difficulty=exam["difficulty"],
            )
        elif input_mode == "extract_existing_questions":
            generated_questions = extract_existing_questions(
                text=source_text,
                options_count=exam["options_count"],
                difficulty=exam["difficulty"],
            )
        else:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Unsupported input mode",
            )
    except Exception as exc:
        db.exams.update_one(
            {"_id": exam["_id"]},
            {
                "$set": {
                    "generation_status": "failed",
                    "updated_at": datetime.now(timezone.utc),
                }
            },
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Question generation failed: {str(exc)}",
        )

    if not generated_questions:
        db.exams.update_one(
            {"_id": exam["_id"]},
            {
                "$set": {
                    "generation_status": "failed",
                    "updated_at": datetime.now(timezone.utc),
                }
            },
        )
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No questions could be generated or extracted",
        )

    docs = []
    for item in generated_questions:
        docs.append(
            question_document(
                exam_id=str(exam["_id"]),
                user_id=str(current_user["_id"]),
                question_type=item["question_type"],
                question_text=item["question_text"],
                question_order=item["question_order"],
                marks=item["marks"],
                options=item.get("options", []),
                correct_option_ids=item.get("correct_option_ids", []),
                correct_answer_text=item.get("correct_answer_text"),
                explanation=item.get("explanation"),
                section_name=item.get("section_name"),
                difficulty=item.get("difficulty"),
                source_chunk_ids=item.get("source_chunk_ids", []),
                time_limit_seconds=item.get("time_limit_seconds"),
            )
        )

    if docs:
        db.questions.insert_many(docs)

    now = datetime.now(timezone.utc)
    db.exams.update_one(
        {"_id": exam["_id"]},
        {
            "$set": {
                "generation_status": "completed",
                "status": "ready",
                "prepared_at": now,
                "updated_at": now,
            }
        },
    )

    return {
        "exam_id": str(exam["_id"]),
        "generation_status": "completed",
        "status": "ready",
        "total_generated_questions": len(docs),
        "message": "Exam questions prepared successfully",
        "processed_at": now,
        "needs_ocr": extraction["needs_ocr"],
        "extracted_char_count": extraction["char_count"],
        "source_preview": source_text[:300] if source_text else None,
    }