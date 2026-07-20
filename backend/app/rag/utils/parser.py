import re


def clean_json_response(raw_string: str) -> str:
    """Removes markdown fences around JSON outputs from LLMs."""
    text = raw_string.strip()
    text = re.sub(r"^```(?:json)?\s*\n", "", text, flags=re.IGNORECASE)
    text = re.sub(r"\n```\s*$", "", text)
    return text.strip()


def extract_existing_questions(
    text: str,
    options_count: int,
    difficulty: str,
) -> list[dict]:
    lines = [line.strip() for line in text.splitlines() if line.strip()]
    questions = []
    current_question = None
    next_q_num = 1

    question_pattern = re.compile(
        r"^(?:Q(?:uestion)?\s*\.?\s*(\d+)|(\d+))\s*[\).:-](?:\s+(.*))?$",
        re.IGNORECASE,
    )
    option_pattern = re.compile(r"^[\(]?([A-Fa-f1-6])[\).]\s+(.*)", re.IGNORECASE)
    answer_pattern = re.compile(
        r"^(?:Ans\.?|Answer)\s*[\(:-]?\s*([A-Fa-f1-6])[\)]?", re.IGNORECASE
    )

    opt_map = {
        "A": 1, "B": 2, "C": 3, "D": 4, "E": 5, "F": 6,
        "1": 1, "2": 2, "3": 3, "4": 4, "5": 5, "6": 6,
    }

    for line in lines:
        lower_line = line.lower()
        if (
            "exam paper" in lower_line
            or "contact number" in lower_line
            or lower_line.startswith("page:")
        ):
            continue

        q_match = question_pattern.match(line)
        o_match = option_pattern.match(line)
        ans_match = answer_pattern.match(line)

        is_new_question = False
        if q_match:
            q_num_str = q_match.group(1) or q_match.group(2)
            q_num = int(q_num_str)

            if current_question is None or (next_q_num <= q_num <= next_q_num + 5):
                is_new_question = True
                next_q_num = q_num + 1
                q_text = (q_match.group(3) or "").strip()

        if is_new_question:
            if current_question:
                questions.append(current_question)

            current_question = {
                "question_type": "objective",
                "question_text": q_text,
                "question_order": q_num,
                "marks": 1,
                "options": [],
                "correct_option_ids": [],
                "correct_answer_text": None,
                "explanation": "Extracted from uploaded question PDF.",
                "section_name": "Objective",
                "difficulty": difficulty,
                "source_chunk_ids": [],
                "time_limit_seconds": 45,
            }
            continue

        if o_match and current_question:
            opt_id = o_match.group(1).upper()
            opt_text = o_match.group(2).strip()
            expected_opt_num = len(current_question["options"]) + 1

            if expected_opt_num <= options_count and opt_id in opt_map:
                if opt_map[opt_id] == expected_opt_num:
                    current_question["options"].append({"id": opt_id, "text": opt_text})
                    continue

        if ans_match and current_question:
            correct_letter = ans_match.group(1).upper()
            current_question["correct_option_ids"] = [correct_letter]
            continue

        if current_question:
            if len(current_question["options"]) == 0:
                if current_question["question_text"]:
                    current_question["question_text"] += "\n" + line
                else:
                    current_question["question_text"] = line
            else:
                current_question["options"][-1]["text"] += " " + line

    if current_question:
        questions.append(current_question)

    for q in questions:
        if len(q["options"]) > 0:
            q["question_type"] = "objective"
        else:
            q["question_type"] = "descriptive"

    return questions