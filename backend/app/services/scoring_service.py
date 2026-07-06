def normalize_option_ids(values: list[str]) -> list[str]:
    return sorted([value.strip() for value in values if value and value.strip()])


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
    descriptive_score = 0.0  # reserved if you later auto-score descriptives

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

        selected_option_ids: list[str] = []
        descriptive_answer: str | None = None

        if response:
            selected_option_ids = response.get("selected_option_ids", [])
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

            # include options in breakdown so frontend can render text + highlighting
            options = question.get("options", [])

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
                    "options": options,  # NEW: list of {id, text}
                    "descriptive_answer": None,
                    "correct_answer_text": None,
                    "explanation": question.get("explanation"),
                    "review_required": False,
                }
            )

        elif question_type == "descriptive":
            descriptive_total += 1

            if descriptive_answer and descriptive_answer.strip():
                attempted_questions += 1
                descriptive_attempted += 1
                is_attempted = True

            review_required = True

            answer_breakdown.append(
                {
                    "question_id": question_id,
                    "question_type": question_type,
                    "question_text": question["question_text"],
                    "marks": marks,
                    "obtained_marks": 0.0,  # manual review later
                    "is_attempted": is_attempted,
                    "is_correct": None,
                    "selected_option_ids": [],
                    "correct_option_ids": [],
                    "options": [],  # keep consistent structure
                    "descriptive_answer": descriptive_answer,
                    "correct_answer_text": question.get("correct_answer_text"),
                    "explanation": question.get("explanation"),
                    "review_required": True,
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