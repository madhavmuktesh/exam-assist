from datetime import datetime
from typing import Literal, Optional

from pydantic import BaseModel


ResultStatus = Literal["evaluated", "pending_review", "reviewed"]


class AnswerBreakdownItem(BaseModel):
    question_id: str
    question_type: str
    question_text: str
    marks: float
    obtained_marks: float
    is_attempted: bool
    is_correct: Optional[bool]
    selected_option_ids: list[str]
    correct_option_ids: list[str]
    descriptive_answer: Optional[str]
    correct_answer_text: Optional[str]
    explanation: Optional[str]
    review_required: bool


class ResultResponse(BaseModel):
    id: str
    exam_id: str
    user_id: str

    total_questions: int
    attempted_questions: int

    objective_total: int
    objective_attempted: int
    objective_correct: int
    objective_wrong: int

    descriptive_total: int
    descriptive_attempted: int

    max_marks: float
    objective_score: float
    descriptive_score: float
    final_score: float
    percentage: float

    status: ResultStatus
    review_required: bool
    answer_breakdown: list[AnswerBreakdownItem]

    created_at: datetime
    updated_at: datetime