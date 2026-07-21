import json
import logging
import re
from typing import Any

from openai import OpenAI
from pydantic import ValidationError

from app.core.config import get_settings
from app.schemas.llm_question import LLMGeneratedQuestionSet

logger = logging.getLogger(__name__)
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


def chunk_text(text: str, chunk_size: int = 3500) -> list[str]:
    """
    Splits text into chunks at double newlines (paragraphs).
    Prevents slicing a question or its options in half.
    """
    text = re.sub(r"\n{3,}", "\n\n", text).strip()
    if not text:
        return []

    paragraphs = text.split("\n\n")
    chunks = []
    current_chunk = ""

    for para in paragraphs:
        if len(current_chunk) + len(para) <= chunk_size:
            current_chunk += para + "\n\n"
        else:
            if current_chunk.strip():
                chunks.append(current_chunk.strip())
            current_chunk = para + "\n\n"

    if current_chunk.strip():
        chunks.append(current_chunk.strip())

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
- Every objective question must include at least 1 correct option in `correct_option_ids`.
- Descriptive questions must have NO options (empty array `[]`) and NO correct_option_ids (empty array `[]`).
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
You are an expert exam paper parser. Extract all questions from the source text.
Fix multi-column artifacts or line break issues, but do NOT invent new questions.

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
- If a question has no options, mark it as "descriptive". Its `options` and `correct_option_ids` MUST be empty arrays `[]`.
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
    val_str = str(value).strip().upper()
    # Map numeric options (1,2,3,4) to alphabetic (A,B,C,D) for standardization
    mapping = {"1": "A", "2": "B", "3": "C", "4": "D"}
    return mapping.get(val_str, val_str)


def _sanitize_question(
    question: dict[str, Any],
    index: int,
    options_count: int,
    difficulty: str,
) -> dict[str, Any] | None:
    if not isinstance(question, dict):
        return None

    question_text = str(question.get("question_text", "")).strip()
    if not question_text:
        return None

    question_type = str(question.get("question_type", "")).strip().lower()
    raw_options = question.get("options") or []

    if question_type not in {"objective", "descriptive"}:
        question_type = "objective" if len(raw_options) >= 2 else "descriptive"

    marks = question.get("marks", 1 if question_type == "objective" else 5)
    try:
        marks = float(marks)
    except (TypeError, ValueError):
        marks = 1.0

    sanitized: dict[str, Any] = {
        "question_type": question_type,
        "question_text": question_text,
        "question_order": index + 1,
        "marks": marks,
        "options": [],
        "correct_option_ids": [],
        "correct_answer_text": None,
        "explanation": str(question.get("explanation") or "Extracted from source content.").strip(),
        "section_name": "Objective" if question_type == "objective" else "Descriptive",
        "difficulty": difficulty,
        "source_chunk_ids": question.get("source_chunk_ids") if isinstance(question.get("source_chunk_ids"), list) else [],
        "time_limit_seconds": 45,
    }

    if question_type == "objective":
        cleaned_options = []
        for opt_index, opt in enumerate(raw_options):
            if isinstance(opt, dict):
                opt_text = str(opt.get("text", "")).strip()
                if opt_text:
                    raw_id = opt.get("id")
                    option_id = _normalize_option_id(raw_id) or chr(65 + opt_index)
                    cleaned_options.append({"id": option_id, "text": opt_text})

        # If options < 2, gracefully convert to descriptive instead of deleting the question
        if len(cleaned_options) < 2:
            sanitized["question_type"] = "descriptive"
            sanitized["options"] = []
            sanitized["correct_option_ids"] = []
            sanitized["correct_answer_text"] = "Refer to source content."
            return sanitized

        allowed_ids = {opt["id"] for opt in cleaned_options}
        raw_correct_ids = question.get("correct_option_ids") or []
        if not isinstance(raw_correct_ids, list):
            raw_correct_ids = [raw_correct_ids]

        cleaned_correct_ids = []
        for cid in raw_correct_ids:
            normalized = _normalize_option_id(cid)
            if normalized in allowed_ids and normalized not in cleaned_correct_ids:
                cleaned_correct_ids.append(normalized)

        if not cleaned_correct_ids:
            cleaned_correct_ids = [cleaned_options[0]["id"]]

        sanitized["options"] = cleaned_options[:options_count]
        sanitized["correct_option_ids"] = cleaned_correct_ids
    else:
        answer_text = question.get("correct_answer_text")
        sanitized["options"] = []
        sanitized["correct_option_ids"] = []
        sanitized["correct_answer_text"] = str(answer_text).strip() if answer_text else "Refer to source content."

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

    chunks = chunk_text(text, chunk_size=3500)
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
    """Iterates through all text chunks to extract questions without hitting token limits."""
    if not settings.openrouter_api_key:
        raise ValueError("OPENROUTER_API_KEY is not configured")

    chunks = chunk_text(text, chunk_size=3500)
    all_extracted_questions = []

    for i, chunk in enumerate(chunks):
        prompt = build_extraction_prompt(
            text=chunk,
            options_count=options_count,
            difficulty=difficulty,
        )

        try:
            parsed = _call_llm_json(
                prompt=prompt,
                system_message="You are a precise data extraction tool. Return strict JSON only.",
                temperature=0.1,
            )

            validated = _validate_question_set(
                parsed=parsed,
                options_count=options_count,
                difficulty=difficulty,
            )

            if validated.questions:
                all_extracted_questions.extend([q.model_dump() for q in validated.questions])

        except Exception as exc:
            logger.warning("Chunk %d extraction failed: %s", i + 1, exc)
            continue

    if not all_extracted_questions:
        raise ValueError("No valid questions could be extracted via LLM fallback.")

    for idx, q in enumerate(all_extracted_questions, start=1):
        q["question_order"] = idx

    return all_extracted_questions


def extract_existing_questions(
    text: str,
    options_count: int,
    difficulty: str,
) -> list[dict[str, Any]]:
    """Deterministic regex extraction supporting Q1., 1., numeric options, and Ans.(a)."""
    # Clean non-question noise found in the target document
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
        r"Test Prime - built only for mock tests",
        r"Contact Number: \d+/\d+",
        r"A Google Play",
        r"Adda247"
    ]
    for pat in noise_patterns:
        text = re.sub(pat, "", text, flags=re.DOTALL | re.IGNORECASE)

    # SECURE SPLIT: Separate Questions from Explanations to prevent overlap
    exp_split = re.split(r"(?:\n|^)\s*EXPLANATIONS\s*(?:\n|$)", text, maxsplit=1, flags=re.IGNORECASE)
    main_text = exp_split[0]
    explanation_text = exp_split[1] if len(exp_split) > 1 else ""

    q_pattern = re.compile(
        r"(?:^|\n)(?:Q\.?\s*)?(\d{1,3})[\.\)]\s+(.+?)(?=\n(?:Q\.?\s*)?\d{1,3}[\.\)]\s+|\Z)",
        re.DOTALL | re.IGNORECASE,
    )

    all_questions: dict[int, dict[str, Any]] = {}

    # Extract questions ONLY from the main_text
    for m in q_pattern.finditer(main_text):
        q_num = int(m.group(1))
        if q_num < 1 or q_num > 500:
            continue

        body = m.group(2).strip()
        if len(body) < 5:
            continue

        # Two-Pass Option Extraction: Try alphabetic (a) first to avoid numeric list conflict (e.g. 1. All envelopes)
        raw_opts = re.findall(
            r"(?:^|\n|\s)\(([a-d])\)\s+(.+?)(?=(?:\s|\n)\([a-d]\)\s+|\nAns|\Z)",
            body,
            re.DOTALL | re.IGNORECASE,
        )
        if not raw_opts:
            # Fallback to numeric 1. 2.
            raw_opts = re.findall(
                r"(?:^|\n|\s)\(?([1-4])[\.\)]\s+(.+?)(?=(?:\s|\n)\(?[1-4][\.\)]\s+|\nAns|\Z)",
                body,
                re.DOTALL | re.IGNORECASE,
            )

        options = []
        for oid, otext in raw_opts:
            cleaned = re.sub(r"\s+", " ", otext).strip()
            cleaned = re.split(r"Ans\.\s*\(", cleaned, flags=re.IGNORECASE)[0].strip()

            mapped_id = _normalize_option_id(oid)
            if cleaned and mapped_id:
                options.append({"id": mapped_id, "text": cleaned})

        unique_options = []
        seen_ids = set()
        for opt in options:
            if opt["id"] not in seen_ids:
                seen_ids.add(opt["id"])
                unique_options.append(opt)

        # Slice question text BEFORE the first option found
        first_opt = re.search(r"(?:^|\n|\s)\([a-d]\)\s+", body, re.IGNORECASE)
        if not first_opt:
            first_opt = re.search(r"(?:^|\n|\s)\(?([1-4])[\.\)]\s+", body, re.IGNORECASE)

        if first_opt:
            q_text = body[: first_opt.start()].strip()
        else:
            q_text = body.strip()

        q_text = re.sub(r"Ans\.\s*\(.*?\)", "", q_text, flags=re.IGNORECASE).strip()
        q_text = re.sub(r"\s+", " ", q_text).strip()

        if not q_text:
            continue

        # Inline Answer key extraction
        ans_match = re.search(r"(?:Ans\.|Answer:?)\s*[\(:]?\s*([a-dA-D1-4])\)?", body, re.IGNORECASE)
        correct_ids = []
        if ans_match:
            correct_ids = [_normalize_option_id(ans_match.group(1))]

        existing = all_questions.get(q_num)
        if existing is None or len(unique_options) > len(existing["options"]):
            all_questions[q_num] = {
                "question_order": q_num,
                "question_type": "objective" if len(unique_options) >= 2 else "descriptive",
                "question_text": q_text,
                "options": unique_options[:options_count],
                "correct_option_ids": correct_ids,
                "correct_answer_text": None,
                "marks": 1,
                "difficulty": difficulty,
                "section_name": "Objective" if len(unique_options) >= 2 else "Descriptive",
                "source_chunk_ids": [],
                "time_limit_seconds": 45,
                "explanation": "Extracted from uploaded question PDF.",
            }

    # Extract answers globally ONLY from the explanation_text block
    if explanation_text:
        global_answer_pattern = re.compile(r"(?:^|\n)\s*(?:Q\.?\s*)?(\d{1,3})\.\s*\(([a-dA-D1-4])\)", re.IGNORECASE)
        for m in global_answer_pattern.finditer(explanation_text):
            q_num = int(m.group(1))
            ans = _normalize_option_id(m.group(2))
            if q_num in all_questions and not all_questions[q_num]["correct_option_ids"]:
                all_questions[q_num]["correct_option_ids"] = [ans]

    questions = sorted(all_questions.values(), key=lambda q: q["question_order"])
    for idx, q in enumerate(questions, start=1):
        q["question_order"] = idx
        if q["question_type"] == "descriptive":
            q["marks"] = 5
            q["section_name"] = "Descriptive"
            q["correct_answer_text"] = "Refer to source content."
            q["correct_option_ids"] = []
            q["options"] = [] 

    return questions