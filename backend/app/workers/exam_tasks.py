import logging
from pathlib import Path

from app.workers.celery_app import celery_app
from app.core.database import get_database
from app.rag.pipelines.prepare_exam_pipeline import prepare_questions_for_exam_from_pdf
from app.utils.datetime_utils import utc_now

logger = logging.getLogger(__name__)


@celery_app.task(bind=True, max_retries=3, default_retry_delay=10)
def task_prepare_exam_questions(
    self,
    exam_id: str,
    user_id: str,
    pdf_filename: str,
    objective_count: int,
    descriptive_count: int,
    options_count: int,
    difficulty: str,
    input_mode: str,
):
    db = get_database()

    try:
        db.exams.update_one(
            {"_id": exam_id},
            {"$set": {"generation_status": "processing", "updated_at": utc_now()}},
        )

        pdf_path = Path("uploads") / pdf_filename

        num_questions = prepare_questions_for_exam_from_pdf(
            exam_id=exam_id,
            user_id=user_id,
            pdf_path=pdf_path,
            objective_count=objective_count,
            descriptive_count=descriptive_count,
            options_count=options_count,
            difficulty=difficulty,
            input_mode=input_mode,
        )

        db.exams.update_one(
            {"_id": exam_id},
            {
                "$set": {
                    "generation_status": "completed",
                    "status": "ready",
                    "total_questions": num_questions,
                    "prepared_at": utc_now(),
                    "updated_at": utc_now(),
                }
            },
        )

        logger.info("Exam %s prepared with %d questions", exam_id, num_questions)
        return {"exam_id": exam_id, "total_questions": num_questions}

    except Exception as exc:
        logger.error("Task failed for exam %s: %s", exam_id, exc)
        db.exams.update_one(
            {"_id": exam_id},
            {"$set": {"generation_status": "failed", "updated_at": utc_now()}},
        )
        raise self.retry(exc=exc)