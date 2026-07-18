import json
import re

from openai import OpenAI
from pydantic import ValidationError

from app.core.config import get_settings
from app.schemas.llm_question import LLMGeneratedQuestionSet


settings = get_settings()

def clean_json_response(raw_string: str) -> str:
    """Removes markdown fences around JSON outputs from LLMs."""
    text = raw_string.strip()
    # Remove starting ```json or ```
    text = re.sub(r"^```(?:json)?\s*\n", "", text, flags=re.IGNORECASE)
    # Remove ending ```
    text = re.sub(r"\n```\s*$", "", text)
    return text.strip()

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
    clean_content = clean_json_response(raw_content)
    parsed = json.loads(clean_content) # Use clean_content here

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
    
    clean_content = clean_json_response(raw_content)
    parsed = json.loads(clean_content) # Use clean_content here

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
    next_q_num = 1
    
    # Matches Q1. Q 1) 1. 1) Question 1: (and captures the number)
    question_pattern = re.compile(r"^(?:Q(?:uestion)?\s*\.?\s*(\d+)|(\d+))\s*[\).:-](?:\s+(.*))?$", re.IGNORECASE)
    
    # Matches A) (A) a. 1. (1)
    option_pattern = re.compile(r"^[\(]?([A-Fa-f1-6])[\).]\s+(.*)", re.IGNORECASE)
    answer_pattern = re.compile(r"^(?:Ans\.?|Answer)\s*[\(:-]?\s*([A-Fa-f1-6])[\)]?", re.IGNORECASE)

    # Maps letters/numbers to their logical sequence index
    opt_map = {'A':1, 'B':2, 'C':3, 'D':4, 'E':5, 'F':6, '1':1, '2':2, '3':3, '4':4, '5':5, '6':6}

    for line in lines:
        # Skip common NEET/SSC PDF headers and footers to keep text clean
        lower_line = line.lower()
        if "exam paper" in lower_line or "contact number" in lower_line or lower_line.startswith("page:"):
            continue

        q_match = question_pattern.match(line)
        o_match = option_pattern.match(line)
        ans_match = answer_pattern.match(line)

        is_new_question = False
        if q_match:
            q_num_str = q_match.group(1) or q_match.group(2)
            q_num = int(q_num_str)
            
            # Accept if it's the very first question found (allows papers starting at Q91)
            # OR if it sequentially follows the last question (allows a gap of 5 for skipped/mangled questions)
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
            
            # Check if this option logically follows the previous one (e.g., expecting 'B' or '2')
            if expected_opt_num <= options_count and opt_id in opt_map:
                if opt_map[opt_id] == expected_opt_num:
                    current_question["options"].append({
                        "id": opt_id,
                        "text": opt_text
                    })
                    continue

        if ans_match and current_question:
            correct_letter = ans_match.group(1).upper()
            current_question["correct_option_ids"] = [correct_letter]
            continue

        # Append trailing text to the current block (either question text or the last option)
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

    # Normalize question types based on successfully found options
    for q in questions:
        if len(q["options"]) > 0:
            q["question_type"] = "objective"
        else:
            q["question_type"] = "descriptive"

    return questions