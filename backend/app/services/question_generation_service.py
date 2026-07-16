import json
import re

from openai import OpenAI
from pydantic import ValidationError

from app.core.config import get_settings
from app.schemas.llm_question import LLMGeneratedQuestionSet

settings = get_settings()
client = OpenAI(api_key=settings.openai_api_key)


def chunk_text(text: str, chunk_size: int = 4000) -> list[str]:
    text = re.sub(r"\s+", " ", text).strip()
    if not text:
        return []

    chunks = []
    start = 0

    while start < len(text):
        end = min(start + chunk_size, len(text))
        chunk = text[start:end].strip()
        if chunk:
            chunks.append(chunk)
        start = end

    return chunks


def build_generation_prompt(
    text: str,
    objective_count: int,
    descriptive_count: int,
    options_count: int,
    difficulty: str,
) -> str:
    return f"""
You are generating exam questions from course material.

Generate:
- {objective_count} objective questions
- {descriptive_count} descriptive questions
- MCQ options count must be exactly {options_count}
- Difficulty level must be {difficulty}

Return valid JSON only in this format:
{{
  "questions": [
    {{
      "question_type": "objective" or "descriptive",
      "question_text": "string",
      "question_order": 1,
      "marks": 1,
      "options": [{{"id": "A", "text": "..."}}],
      "correct_option_ids": ["A"],
      "correct_answer_text": null,
      "explanation": "string",
      "section_name": "Objective" or "Descriptive",
      "difficulty": "{difficulty}",
      "source_chunk_ids": ["chunk_0"],
      "time_limit_seconds": 45
    }}
  ]
}}

Rules:
- Objective questions must include exactly {options_count} options.
- Descriptive questions must have no options and no correct_option_ids.
- Use question_order starting from 1.
- Marks should be 1 for objective and 5 for descriptive unless strongly justified.
- correct_answer_text must be null for objective questions.
- For descriptive questions, provide a short model answer in correct_answer_text.
- Do not include markdown fences.
- Return JSON only.

Source material:
{text}
""".strip()


def generate_questions_from_content(
    text: str,
    objective_count: int,
    descriptive_count: int,
    options_count: int,
    difficulty: str,
) -> list[dict]:
    if not settings.openai_api_key:
        raise ValueError("OPENAI_API_KEY is not configured")

    chunks = chunk_text(text, chunk_size=5000)
    source_text = "\n\n".join(
        f"[chunk_{i}] {chunk}" for i, chunk in enumerate(chunks[:6])
    )

    prompt = build_generation_prompt(
        text=source_text,
        objective_count=objective_count,
        descriptive_count=descriptive_count,
        options_count=options_count,
        difficulty=difficulty,
    )

    response = client.chat.completions.create(
        model=settings.openai_model,
        messages=[
            {
                "role": "system",
                "content": "You generate high-quality exam questions and must return strict JSON only.",
            },
            {
                "role": "user",
                "content": prompt,
            },
        ],
        response_format={"type": "json_object"},
        temperature=0.3,
    )

    raw_content = response.choices[0].message.content
    parsed = json.loads(raw_content)

    try:
        validated = LLMGeneratedQuestionSet.model_validate(parsed)
    except ValidationError as exc:
        raise ValueError(f"LLM output validation failed: {exc}") from exc

    return [question.model_dump() for question in validated.questions]


def extract_existing_questions(
    text: str,
    options_count: int,
    difficulty: str,
) -> list[dict]:
    lines = [line.strip() for line in text.splitlines() if line.strip()]
    questions = []
    current_question = None
    question_order = 1

    # Matches Q1., Q1, Question 1, 1., 1) etc.
    question_pattern = re.compile(r"^(?:Q(?:uestion)?\s*\d+|\d+)[\).:]?\s+(.+)", re.IGNORECASE)
    
    # Matches A), (A), a., a) -> Changed to (.*) to handle options where text wraps to the next line
    option_pattern = re.compile(r"^[\(]?([A-Da-d])[\).]\s*(.*)", re.IGNORECASE)

    for line in lines:
        q_match = question_pattern.match(line)
        o_match = option_pattern.match(line)

        # --- FIX 1: HANDLE NUMBERED LISTS INSIDE QUESTIONS ---
        # If it looks like a question, BUT we are in the middle of a question 
        # and haven't found any options yet, it might be a numbered list (like 1., 2., 3.).
        if q_match and current_question and len(current_question["options"]) == 0:
            # If the line explicitly starts with 'Q' (e.g., Q81.), it's definitely a new question.
            if re.match(r"^Q(?:uestion)?\s*\d+", line, re.IGNORECASE):
                pass # Let it be processed as a new question below
            else:
                # It's a numbered list inside the current question. Append it to the question text.
                current_question["question_text"] += "\n" + line
                continue

        # --- PROCESS NEW QUESTION ---
        if q_match:
            if current_question:
                questions.append(current_question)

            current_question = {
                "question_type": "objective",
                "question_text": q_match.group(1).strip(),
                "question_order": question_order,
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
            question_order += 1
            continue

        # --- PROCESS OPTIONS & CONTINUATION TEXT ---
        if current_question:
            if o_match:
                if len(current_question["options"]) < options_count:
                    option_id = o_match.group(1).upper()
                    current_question["options"].append(
                        {
                            "id": option_id,
                            "text": o_match.group(2).strip(),
                        }
                    )
            else:
                # --- FIX 2: HANDLE MULTI-LINE TEXT ---
                # If it's not a new question and not an option, append it.
                if len(current_question["options"]) == 0:
                    # Append to question text
                    current_question["question_text"] += "\n" + line
                else:
                    # Append to the LAST option (handles values pushed to the next line)
                    current_question["options"][-1]["text"] += " " + line

    if current_question:
        questions.append(current_question)

    return questions