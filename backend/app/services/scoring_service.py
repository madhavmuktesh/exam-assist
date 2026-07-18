import json
import logging

from app.core.config import get_settings

logger = logging.getLogger(__name__)


def get_openai_client():
    from openai import OpenAI

    settings = get_settings()
    return OpenAI(api_key=settings.openai_api_key), settings


def normalize_option_ids(values: list[str]) -> list[str]:
    return sorted([value.strip() for value in values if value and value.strip()])


def build_grading_prompt(
    question_text: str,
    student_answer: str,
    max_marks: float,
    correct_answer_text: str | None = None,
) -> str:
    reference_block = (
        f"\nReference Answer: {correct_answer_text}\n"
        if correct_answer_text and correct_answer_text.strip()
        else ""
    )

    return f"""
You are an expert examiner. Grade the following descriptive question.

Question: {question_text}
Max Marks: {max_marks}{reference_block}
Student Answer: {student_answer}

Provide a JSON response:
{{
    "score": float (0 to {max_marks}),
    "feedback": "string (A brief justification for the marks given)"
}}

Rules:
- Be fair but strict.
- If the answer is completely off-topic, give 0.
- Return ONLY the JSON object. No other text.
""".strip()


def grade_descriptive_answer(
    question_text: str,
    student_answer: str,
    max_marks: float,
    correct_answer_text: str | None = None,
) -> dict:
    try:
        client, settings = get_openai_client()

        if not settings.openai_api_key:
            logger.warning(
                "OPENAI_API_KEY is not set — marking descriptive answer for manual review."
            )
            return {
                "obtained_marks": 0.0,
                "ai_feedback": "AI grading unavailable — pending manual review.",
                "review_required": True,
            }

        prompt = build_grading_prompt(
            question_text=question_text,
            student_answer=student_answer,
            max_marks=max_marks,
            correct_answer_text=correct_answer_text,
        )

        response = client.chat.completions.create(
            model=settings.openai_model,
            messages=[
                {
                    "role": "system",
                    "content": "You are a grading assistant. Return strict JSON.",
                },
                {"role": "user", "content": prompt},
            ],
            response_format={"type": "json_object"},
            temperature=0.2,
        )

        result = json.loads(response.choices[0].message.content)

        raw_score = float(result.get("score", 0.0))
        clamped_score = max(0.0, min(raw_score, max_marks))

        return {
            "obtained_marks": clamped_score,
            "ai_feedback": result.get("feedback", ""),
            "review_required": False,
        }

    except Exception as e:
        logger.error(f"AI grading failed: {e}")
        return {
            "obtained_marks": 0.0,
            "ai_feedback": "AI grading failed — pending manual review.",
            "review_required": True,
        }


def score_exam(questions: list[dict], responses_map: dict[str, dict]) -> dict:
    total_questions = len(questions)
    attempted_questions = 0

    objective_total = 0
    objective_attempted = 0
    objective_correct = 0
    objective_wrong = 0

    descriptive_total = 0
    descriptive_attempted = 0

    max_marks = 0.0
    objective_score = 0.0
    descriptive_score = 0.0

    review_required = False
    answer_breakdown: list[dict] = []

    for question in questions:
        question_id = str(question["_id"])
        response = responses_map.get(question_id)

        marks = float(question.get("marks", 0))
        max_marks += marks

        question_type = question["question_type"]
        obtained_marks = 0.0
        is_attempted = False
        is_correct: bool | None = None
        per_q_review_required = False
        ai_feedback: str | None = None

        selected_option_ids: list[str] = []
        descriptive_answer: str | None = None

        if response:
            selected_option_ids = response.get("selected_option_ids", []) or []
            descriptive_answer = response.get("descriptive_answer")

        if question_type == "objective":
            objective_total += 1
            correct_option_ids = normalize_option_ids(
                question.get("correct_option_ids", [])
            )
            submitted_option_ids = normalize_option_ids(selected_option_ids)

            if submitted_option_ids:
                attempted_questions += 1
                objective_attempted += 1
                is_attempted = True

                if submitted_option_ids == correct_option_ids:
                    objective_correct += 1
                    objective_score += marks
                    obtained_marks = marks
                    is_correct = True
                else:
                    objective_wrong += 1
                    is_correct = False

            answer_breakdown.append(
                {
                    "question_id": question_id,
                    "question_type": question_type,
                    "question_text": question["question_text"],
                    "marks": marks,
                    "obtained_marks": obtained_marks,
                    "is_attempted": is_attempted,
                    "is_correct": is_correct,
                    "selected_option_ids": submitted_option_ids,
                    "correct_option_ids": correct_option_ids,
                    "descriptive_answer": None,
                    "correct_answer_text": None,
                    "explanation": question.get("explanation"),
                    "review_required": False,
                    "ai_feedback": None,
                }
            )

        elif question_type == "descriptive":
            descriptive_total += 1

            if descriptive_answer and descriptive_answer.strip():
                attempted_questions += 1
                descriptive_attempted += 1
                is_attempted = True

                grading = grade_descriptive_answer(
                    question_text=question["question_text"],
                    student_answer=descriptive_answer,
                    max_marks=marks,
                    correct_answer_text=question.get("correct_answer_text"),
                )
                obtained_marks = grading["obtained_marks"]
                ai_feedback = grading["ai_feedback"]
                descriptive_score += obtained_marks
                per_q_review_required = grading.get("review_required", False)
            else:
                per_q_review_required = False

            if per_q_review_required:
                review_required = True

            answer_breakdown.append(
                {
                    "question_id": question_id,
                    "question_type": question_type,
                    "question_text": question["question_text"],
                    "marks": marks,
                    "obtained_marks": obtained_marks,
                    "is_attempted": is_attempted,
                    "is_correct": None,
                    "selected_option_ids": [],
                    "correct_option_ids": [],
                    "descriptive_answer": descriptive_answer,
                    "correct_answer_text": question.get("correct_answer_text"),
                    "explanation": question.get("explanation"),
                    "review_required": per_q_review_required,
                    "ai_feedback": ai_feedback,
                }
            )

    final_score = objective_score + descriptive_score
    percentage = (final_score / max_marks * 100) if max_marks > 0 else 0.0
    status = "pending_review" if review_required else "evaluated"

    return {
        "total_questions": total_questions,
        "attempted_questions": attempted_questions,
        "objective_total": objective_total,
        "objective_attempted": objective_attempted,
        "objective_correct": objective_correct,
        "objective_wrong": objective_wrong,
        "descriptive_total": descriptive_total,
        "descriptive_attempted": descriptive_attempted,
        "max_marks": max_marks,
        "objective_score": objective_score,
        "descriptive_score": descriptive_score,
        "final_score": final_score,
        "percentage": percentage,
        "status": status,
        "review_required": review_required,
        "answer_breakdown": answer_breakdown,
    }