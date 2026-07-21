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

    # Use the smart chunker and process EVERY chunk, not just the first 6
    chunks = chunk_text(text, chunk_size=3500)
    all_extracted_questions = []
    
    # Process each chunk individually to avoid LLM JSON truncation limits
    for i, chunk in enumerate(chunks):
        prompt = build_extraction_prompt(
            text=chunk,
            options_count=options_count,
            difficulty=difficulty,
        )

        last_error: Exception | None = None
        for attempt in range(2):
            try:
                parsed = _call_llm_json(
                    prompt=prompt,
                    system_message="You are a precise data extraction tool. You return strict JSON only. Extract ONLY the questions present in this chunk.",
                    temperature=0.1,
                )

                validated = _validate_question_set(
                    parsed=parsed,
                    options_count=options_count,
                    difficulty=difficulty,
                )

                if validated.questions:
                    all_extracted_questions.extend([q.model_dump() for q in validated.questions])
                
                break  # Success, move to the next chunk

            except (ValidationError, ValueError, json.JSONDecodeError) as exc:
                last_error = exc
                if attempt == 1:
                    # Log the failure but continue to the next chunk so the whole paper doesn't fail
                    print(f"Skipping chunk {i+1}/{len(chunks)} due to LLM failure: {last_error}")
                    break

    if not all_extracted_questions:
        raise ValueError("No valid questions could be extracted from the LLM output across any chunks.")

    # Re-order the questions sequentially since they were extracted in batches
    for idx, question in enumerate(all_extracted_questions, start=1):
        question["question_order"] = idx

    return all_extracted_questions


def extract_existing_questions(
    text: str,
    options_count: int,
    difficulty: str,
) -> list[dict[str, Any]]:
    """
    Regex-based question extractor for exam PDFs.
    Updated to handle 'Q1.', '1.', numerical options, and 'Ans.(a)' formats.
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
        r"Test Prime - built only for mock tests",
        r"Contact Number: \d+/\d+"
    ]
    for pat in noise_patterns:
        text = re.sub(pat, "", text, flags=re.DOTALL | re.IGNORECASE)

    # ── Parse questions ───────────────────────────────────────────────────────
    # Matches '1.', 'Q1.', 'Q.1', '1)'
    q_pattern = re.compile(
        r"(?:^|\n)(?:Q\.?\s*)?(\d{1,3})[\.\)]\s+(.+?)(?=\n(?:Q\.?\s*)?\d{1,3}[\.\)]\s+|\Z)",
        re.DOTALL | re.IGNORECASE,
    )

    all_questions: dict[int, dict[str, Any]] = {}

    for m in q_pattern.finditer(text):
        q_num = int(m.group(1))
        if q_num < 1 or q_num > 500:
            continue

        body = m.group(2).strip()
        if len(body) < 8:
            continue

        # Question text = everything before first option marker (matches (a), a), (1), 1))
        first_opt = re.search(r"(?:^|\s)\(?([a-dA-D1-4])\)", body)
        if first_opt:
            q_text = body[: first_opt.start()].strip()
        else:
            q_text = body.strip()

        q_text = re.sub(r"\s+", " ", q_text).strip()
        if not q_text:
            continue

        # Extract options
        raw_opts = re.findall(
            r"(?:^|\s)\(?([a-dA-D1-4])\)\s*(.+?)(?=(?:\s\(?[a-dA-D1-4]\)\s)|\Z)", body, re.DOTALL
        )
        
        options = []
        for oid, otext in raw_opts[: options_count]:
            cleaned = re.sub(r"\s+", " ", otext).strip()
            cleaned = re.split(r"\n(?:Q\.?\s*)?\d{1,3}[\.\)]", cleaned)[0].strip()
            
            # Map numeric options (1,2,3,4) to alphabetic (A,B,C,D) for standardization
            mapped_id = oid.upper()
            if mapped_id == '1': mapped_id = 'A'
            elif mapped_id == '2': mapped_id = 'B'
            elif mapped_id == '3': mapped_id = 'C'
            elif mapped_id == '4': mapped_id = 'D'
            
            options.append({"id": mapped_id, "text": cleaned})

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
    # Matches Ans.(a), Answer: A, Ans: 1, etc.
    answer_pattern = re.compile(r"(?:Q\.?\s*)?(\d{1,3})[\.\)]?.*?(?:Ans(?:wer)?\.?\s*[\(:]?\s*([a-dA-D1-4])\)?|\nAns\.\(([a-dA-D1-4])\))", re.IGNORECASE | re.DOTALL)
    
    for m in answer_pattern.finditer(text):
        q_num = int(m.group(1))
        ans = m.group(2) or m.group(3)
        if not ans:
            continue
            
        ans = ans.upper()
        if ans == '1': ans = 'A'
        elif ans == '2': ans = 'B'
        elif ans == '3': ans = 'C'
        elif ans == '4': ans = 'D'
        
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