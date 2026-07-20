import json

from openai import OpenAI
from pydantic import ValidationError

from app.core.config import get_settings
from app.rag.chunking.text_chunker import chunk_text
from app.rag.utils.parser import clean_json_response
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
            {"role": "user", "content": prompt},
        ],
        response_format={"type": "json_object"},
        temperature=0.3,
    )

    raw_content = response.choices[0].message.content
    clean_content = clean_json_response(raw_content)
    parsed = json.loads(clean_content)

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
            {"role": "user", "content": prompt},
        ],
        response_format={"type": "json_object"},
        temperature=0.1,
    )

    raw_content = response.choices[0].message.content
    clean_content = clean_json_response(raw_content)
    parsed = json.loads(clean_content)

    try:
        validated = LLMGeneratedQuestionSet.model_validate(parsed)
    except ValidationError as exc:
        raise ValueError(f"LLM extraction validation failed: {exc}") from exc

    return [question.model_dump() for question in validated.questions]