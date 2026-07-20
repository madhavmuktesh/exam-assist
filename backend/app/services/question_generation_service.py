import json
import re
from typing import Any

from openai import OpenAI
from pydantic import ValidationError

from app.core.config import get_settings
from app.schemas.llm_question import LLMGeneratedQuestionSet

settings = get_settings()


def clean_json_response(raw_string: str) -> str:
    """Removes markdown fences around JSON outputs from LLMs."""
    text = raw_string.strip()
    text = re.sub(r"^```(?:json)?\s*\n", "", text, flags=re.IGNORECASE)
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
    text = re.sub(r"\n{3,}", "\n\n", text).strip()
    if not text:
        return []

    # Try to split on question boundaries first (Q1. / 1. / Question 1)
    question_splits = re.split(
        r"(?=(?:Q(?:uestion)?\s*\.?\s*\d+|\d+\s*[\).:-])\s)",
        text,
        flags=re.IGNORECASE,
    )

    chunks = []
    current_chunk = ""

    for segment in question_splits:
        if len(current_chunk) + len(segment) <= chunk_size:
            current_chunk += segment
        else:
            if current_chunk.strip():
                chunks.append(current_chunk.strip())
            current_chunk = segment

    if current_chunk.strip():
        chunks.append(current_chunk.strip())

    return chunks if chunks else [text[:chunk_size]]


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
- Every objective question must include at least 1 correct option in `correct_option_ids`.
- Descriptive questions must have no options and no correct_option_ids.
- Every question must include `marks`.
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
You are an expert exam paper parser. The source text was extracted from a PDF and may contain:
- Multi-column merge artifacts (words from two columns on the same line)
- Extra whitespace, line breaks mid-sentence
- Garbled option labels

Your job is to RECONSTRUCT clean, complete questions by intelligently parsing the noisy text.
Fix broken sentences that are clearly the same question split across columns.
Do NOT generate or invent new questions. Only extract and reconstruct what is explicitly there.

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
- Every question must include `marks`.
- Maintain the original meaning of the questions, but FIX formatting artifacts, split lines, and garbled text.
- Do not include markdown fences. Return JSON only.

Source material:
{text}
""".strip()


def _normalize_option_id(value: Any) -> str:
    if value is None:
        return ""
    return str(value).strip().upper()


def _sanitize_question(
    question: dict[str, Any],
    index: int,
    options_count: int,
    difficulty: str,
) -> dict[str, Any] | None:
    if not isinstance(question, dict):
        return None

    question_type = str(question.get("question_type", "")).strip().lower()
    if question_type not in {"objective", "descriptive"}:
        question_type = "objective" if question.get("options") else "descriptive"

    question_text = str(question.get("question_text", "")).strip()
    if not question_text:
        return None

    marks = question.get("marks")
    if marks in (None, ""):
        marks = 1 if question_type == "objective" else 5
    try:
        marks = float(marks)
    except (TypeError, ValueError):
        marks = 1.0 if question_type == "objective" else 5.0

    question_order = question.get("question_order", index + 1)
    try:
        question_order = int(question_order)
    except (TypeError, ValueError):
        question_order = index + 1

    time_limit_seconds = question.get("time_limit_seconds", 45)
    try:
        time_limit_seconds = int(time_limit_seconds)
    except (TypeError, ValueError):
        time_limit_seconds = 45

    explanation = str(question.get("explanation") or "").strip()
    if not explanation:
        explanation = "Generated from source content."

    section_name = str(question.get("section_name") or "").strip()
    if not section_name:
        section_name = "Objective" if question_type == "objective" else "Descriptive"

    source_chunk_ids = question.get("source_chunk_ids")
    if not isinstance(source_chunk_ids, list):
        source_chunk_ids = []

    sanitized: dict[str, Any] = {
        "question_type": question_type,
        "question_text": question_text,
        "question_order": question_order,
        "marks": marks,
        "options": [],
        "correct_option_ids": [],
        "correct_answer_text": None,
        "explanation": explanation,
        "section_name": section_name,
        "difficulty": difficulty,
        "source_chunk_ids": source_chunk_ids,
        "time_limit_seconds": time_limit_seconds,
    }

    if question_type == "objective":
        raw_options = question.get("options") or []
        if not isinstance(raw_options, list):
            return None

        cleaned_options = []
        for opt_index, opt in enumerate(raw_options[:options_count]):
            if not isinstance(opt, dict):
                continue

            opt_text = str(opt.get("text", "")).strip()
            if not opt_text:
                continue

            raw_id = opt.get("id")
            option_id = _normalize_option_id(raw_id) or chr(65 + opt_index)

            cleaned_options.append({
                "id": option_id,
                "text": opt_text,
            })

        if len(cleaned_options) != options_count:
            return None

        allowed_ids = {opt["id"] for opt in cleaned_options}
        raw_correct_ids = question.get("correct_option_ids") or []

        if not isinstance(raw_correct_ids, list):
            raw_correct_ids = [raw_correct_ids]

        cleaned_correct_ids = []
        for cid in raw_correct_ids:
            normalized = _normalize_option_id(cid)
            if normalized in allowed_ids and normalized not in cleaned_correct_ids:
                cleaned_correct_ids.append(normalized)

        if len(cleaned_correct_ids) < 1:
            return None

        sanitized["options"] = cleaned_options
        sanitized["correct_option_ids"] = cleaned_correct_ids
        sanitized["correct_answer_text"] = None

    else:
        answer_text = question.get("correct_answer_text")
        sanitized["options"] = []
        sanitized["correct_option_ids"] = []
        sanitized["correct_answer_text"] = (
            str(answer_text).strip()
            if answer_text not in (None, "")
            else "Refer to the source content."
        )

    return sanitized


def _sanitize_question_set(
    parsed: dict[str, Any],
    options_count: int,
    difficulty: str,
) -> dict[str, Any]:
    raw_questions = parsed.get("questions", [])
    if not isinstance(raw_questions, list):
        raw_questions = []

    cleaned_questions = []
    for index, question in enumerate(raw_questions):
        cleaned = _sanitize_question(
            question=question,
            index=index,
            options_count=options_count,
            difficulty=difficulty,
        )
        if cleaned:
            cleaned_questions.append(cleaned)

    for idx, question in enumerate(cleaned_questions, start=1):
        question["question_order"] = idx

    return {"questions": cleaned_questions}


def _validate_question_set(
    parsed: dict[str, Any],
    options_count: int,
    difficulty: str,
) -> LLMGeneratedQuestionSet:
    sanitized = _sanitize_question_set(
        parsed=parsed,
        options_count=options_count,
        difficulty=difficulty,
    )
    return LLMGeneratedQuestionSet.model_validate(sanitized)


def _chat_completion_with_schema(
    messages: list[dict[str, str]],
    temperature: float,
) -> str:
    response = client.chat.completions.create(
        model=settings.openrouter_model,
        messages=messages,
        response_format={
            "type": "json_schema",
            "json_schema": {
                "name": "llm_generated_question_set",
                "schema": LLMGeneratedQuestionSet.model_json_schema(),
                "strict": True,
            },
        },
        temperature=temperature,
    )
    return response.choices[0].message.content or "{}"


def _chat_completion_json_mode(
    messages: list[dict[str, str]],
    temperature: float,
) -> str:
    response = client.chat.completions.create(
        model=settings.openrouter_model,
        messages=messages,
        response_format={"type": "json_object"},
        temperature=temperature,
    )
    return response.choices[0].message.content or "{}"


def _call_llm_json(
    prompt: str,
    system_message: str,
    temperature: float,
) -> dict[str, Any]:
    messages = [
        {"role": "system", "content": system_message},
        {"role": "user", "content": prompt},
    ]

    raw_content = None
    schema_error = None

    try:
        raw_content = _chat_completion_with_schema(
            messages=messages,
            temperature=temperature,
        )
    except Exception as exc:
        schema_error = exc

    if raw_content is None:
        raw_content = _chat_completion_json_mode(
            messages=messages,
            temperature=temperature,
        )

    clean_content = clean_json_response(raw_content)

    try:
        return json.loads(clean_content)
    except json.JSONDecodeError as exc:
        if schema_error is not None:
            raise ValueError(
                f"Structured output fallback also failed. Schema error: {schema_error}; JSON parse error: {exc}"
            ) from exc
        raise


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

    expected_minimum = objective_count + descriptive_count
    last_error: Exception | None = None

    for attempt in range(2):
        try:
            parsed = _call_llm_json(
                prompt=prompt,
                system_message="You generate high-quality exam questions and must return strict JSON only.",
                temperature=0.3 if attempt == 0 else 0.2,
            )

            validated = _validate_question_set(
                parsed=parsed,
                options_count=options_count,
                difficulty=difficulty,
            )

            if len(validated.questions) < expected_minimum:
                raise ValueError(
                    f"LLM returned only {len(validated.questions)} valid questions, expected at least {expected_minimum}."
                )

            return [question.model_dump() for question in validated.questions]

        except (ValidationError, ValueError, json.JSONDecodeError) as exc:
            last_error = exc
            if attempt == 1:
                break

    raise ValueError(f"LLM output validation failed after retry: {last_error}")


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

    last_error: Exception | None = None

    for attempt in range(2):
        try:
            parsed = _call_llm_json(
                prompt=prompt,
                system_message="You are a precise data extraction tool. You return strict JSON only.",
                temperature=0.1,
            )

            validated = _validate_question_set(
                parsed=parsed,
                options_count=options_count,
                difficulty=difficulty,
            )

            if len(validated.questions) == 0:
                raise ValueError("No valid questions could be extracted from the LLM output.")

            return [question.model_dump() for question in validated.questions]

        except (ValidationError, ValueError, json.JSONDecodeError) as exc:
            last_error = exc
            if attempt == 1:
                break

    raise ValueError(f"LLM extraction validation failed after retry: {last_error}")


def extract_existing_questions(
    text: str,
    options_count: int,
    difficulty: str,
) -> list[dict[str, Any]]:
    """
    Regex-based question extractor for exam PDFs.
    Handles multi-column bleed and option recovery from answer keys.
    Parses each column independently to avoid cross-column contamination.
    """
    # ── Clean noise ──────────────────────────────────────────────────────────
    noise_patterns = [
        r"SSC CGL Tier-I Solved Paper \d+\s+\d+",
        r"\d+ 30 SSC CGL Year-Wise.*?W",
        r"General IntellIGence and\s*\nreasonInG",
        r"General (Awareness|awareness)\s*\n?",
        r"QuantItatIve aptItude\s*\n?",
        r"enGlIsh comprehensIon\s*\n?",
        r"INSTRUCTIONS.*?unanswered questions\.",
        r"Clik Here.*?More",
        r"SOLVED PAPER\s*\n",
    ]
    for pat in noise_patterns:
        text = re.sub(pat, "", text, flags=re.DOTALL | re.IGNORECASE)

    # ── Parse questions ───────────────────────────────────────────────────────
    q_pattern = re.compile(
        r"(?:^|\n)(\d{1,3})\.\s+(.+?)(?=\n\d{1,3}\.\s+|\Z)",
        re.DOTALL,
    )

    all_questions: dict[int, dict[str, Any]] = {}

    for m in q_pattern.finditer(text):
        q_num = int(m.group(1))
        if q_num < 1 or q_num > 500:
            continue

        body = m.group(2).strip()
        if len(body) < 8:
            continue

        # Question text = everything before first option marker
        first_opt = re.search(r"\([a-dA-D]\)", body)
        if first_opt:
            q_text = body[: first_opt.start()].strip()
        else:
            q_text = body.strip()

        q_text = re.sub(r"\s+", " ", q_text).strip()
        if not q_text:
            continue

        # Extract options
        raw_opts = re.findall(
            r"\(([a-dA-D])\)\s*(.+?)(?=\([a-dA-D]\)|\Z)", body, re.DOTALL
        )
        options = []
        for oid, otext in raw_opts[: options_count]:
            cleaned = re.sub(r"\s+", " ", otext).strip()
            # Trim bleed from next question
            cleaned = re.split(r"\n\d{1,3}\.", cleaned)[0].strip()
            options.append({"id": oid.upper(), "text": cleaned})

        # Keep the version with more options
        existing = all_questions.get(q_num)
        if existing is None or len(options) > len(existing["options"]):
            all_questions[q_num] = {
                "question_order": q_num,
                "question_type": "objective" if len(options) >= 2 else "descriptive",
                "question_text": q_text,
                "options": options,
                "correct_option_ids": [],
                "correct_answer_text": None,
                "marks": 1,
                "difficulty": difficulty,
                "section_name": "Objective" if len(options) >= 2 else "Descriptive",
                "source_chunk_ids": [],
                "time_limit_seconds": 45,
                "explanation": "Extracted from uploaded question PDF.",
            }

    # ── Answer key extraction ─────────────────────────────────────────────────
    answer_pattern = re.compile(r"(\d{1,3})\.\s*\(([a-dA-D])\)", re.MULTILINE)
    for m in answer_pattern.finditer(text):
        q_num = int(m.group(1))
        ans = m.group(2).upper()
        if q_num in all_questions and not all_questions[q_num]["correct_option_ids"]:
            all_questions[q_num]["correct_option_ids"] = [ans]

    # ── Post-process ─────────────────────────────────────────────────────────
    questions = sorted(all_questions.values(), key=lambda q: q["question_order"])
    for idx, q in enumerate(questions, start=1):
        q["question_order"] = idx
        if q["question_type"] == "descriptive":
            q["marks"] = 5
            q["section_name"] = "Descriptive"
            if not q["correct_answer_text"]:
                q["correct_answer_text"] = "Refer to source content."
            q["correct_option_ids"] = []

    return questions