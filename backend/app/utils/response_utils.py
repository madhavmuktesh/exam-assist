def success_message(message: str) -> dict:
    return {"message": message}


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