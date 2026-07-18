import json
import re

from openai import OpenAI
from pydantic import ValidationError

from app.core.config import get_settings
from app.schemas.llm_question import LLMGeneratedQuestionSet


settings = get_settings()

client = OpenAI(
    api_key=settings.openrouter_api_key,
    base_url=settings.openrouter_base_url,
    default_headers={
        "HTTP-Referer": settings.openrouter_site_url,
        "X-OpenRouter-Title": settings.openrouter_site_name,
    },
)


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


def build_extraction_prompt(
    text: str,
    options_count: int,
    difficulty: str,
) -> str:
    return f"""
You are an expert data extractor. I am providing you with the raw text of an uploaded question paper.
Your task is to accurately EXTRACT the existing questions and their options from this text.
Do NOT generate or invent new questions. Only extract what is explicitly there.

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
      "explanation": "Extracted via AI fallback.",
      "section_name": "Extracted",
      "difficulty": "{difficulty}",
      "source_chunk_ids": [],
      "time_limit_seconds": 45
    }}
  ]
}}

Rules:
- If a question has options, mark it as "objective". Extract up to {options_count} options.
- If a question has no options, mark it as "descriptive".
- If the text contains an answer key (e.g., "Ans.(C)", "Answer: A"), put that letter in `correct_option_ids`.
- Maintain the original wording of the questions as closely as possible.
- Do not include markdown fences. Return JSON only.

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
    if not settings.openrouter_api_key:
        raise ValueError("OPENROUTER_API_KEY is not configured")

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
        model=settings.openrouter_model,
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


def extract_questions_with_llm(
    text: str,
    options_count: int,
    difficulty: str,
) -> list[dict]:
    if not settings.openrouter_api_key:
        raise ValueError("OPENROUTER_API_KEY is not configured")

    chunks = chunk_text(text, chunk_size=5000)
    source_text = "\n\n".join(chunks[:6])

    prompt = build_extraction_prompt(
        text=source_text,
        options_count=options_count,
        difficulty=difficulty,
    )

    response = client.chat.completions.create(
        model=settings.openrouter_model,
        messages=[
            {
                "role": "system",
                "content": "You are a precise data extraction tool. You return strict JSON only.",
            },
            {
                "role": "user",
                "content": prompt,
            },
        ],
        response_format={"type": "json_object"},
        temperature=0.1,
    )

    raw_content = response.choices[0].message.content
    parsed = json.loads(raw_content)

    try:
        validated = LLMGeneratedQuestionSet.model_validate(parsed)
    except ValidationError as exc:
        raise ValueError(f"LLM extraction validation failed: {exc}") from exc

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

    question_pattern = re.compile(r"^(?:Q(?:uestion)?\s*\d+|\d+)[\).:]?\s+(.+)", re.IGNORECASE)
    option_pattern = re.compile(r"^[\(]?([A-Da-d])[\).]\s*(.*)", re.IGNORECASE)
    answer_pattern = re.compile(r"^(?:Ans\.?|Answer)\s*[\(:-]?\s*([A-Da-d])[\)]?", re.IGNORECASE)

    for line in lines:
        q_match = question_pattern.match(line)
        o_match = option_pattern.match(line)
        ans_match = answer_pattern.match(line)

        if q_match and current_question and len(current_question["options"]) == 0:
            if re.match(r"^Q(?:uestion)?\s*\d+", line, re.IGNORECASE):
                pass
            else:
                current_question["question_text"] += "\n" + line
                continue

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

        if current_question:
            if ans_match:
                correct_letter = ans_match.group(1).upper()
                current_question["correct_option_ids"] = [correct_letter]
                continue

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
                if len(current_question["options"]) == 0:
                    current_question["question_text"] += "\n" + line
                else:
                    current_question["options"][-1]["text"] += " " + line

    if current_question:
        questions.append(current_question)

    return questions