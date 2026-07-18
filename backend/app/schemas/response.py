from datetime import datetime
from typing import Literal, Optional

from pydantic import BaseModel, Field, model_validator

QuestionType = Literal["objective", "descriptive"]


class QuestionResponseSubmitItem(BaseModel):
    question_id: str = Field(..., min_length=1)
    question_type: QuestionType
    selected_option_ids: list[str] = Field(default_factory=list)
    descriptive_answer: Optional[str] = Field(default=None, max_length=10000)
    time_taken_seconds: Optional[int] = Field(default=None, ge=0, le=7200)
    is_flagged_for_review: bool = False

    @model_validator(mode="after")
    def validate_answer_shape(self):
        if self.question_type == "objective":
            if self.descriptive_answer is not None:
                raise ValueError(
                    "descriptive_answer must be empty for objective questions"
                )

        if self.question_type == "descriptive":
            if self.selected_option_ids:
                raise ValueError(
                    "selected_option_ids must be empty for descriptive questions"
                )

        return self


class ExamSubmitRequest(BaseModel):
    answers: list[QuestionResponseSubmitItem] = Field(..., min_length=1)


class StoredResponseView(BaseModel):
    id: str
    exam_id: str
    question_id: str
    user_id: str
    question_type: QuestionType
    selected_option_ids: list[str]
    descriptive_answer: Optional[str]
    time_taken_seconds: Optional[int]
    is_flagged_for_review: bool
    submitted_at: datetime
    created_at: datetime
    updated_at: datetime


class ResponseListResponse(BaseModel):
    responses: list[StoredResponseView]


class ExamHistoryItem(BaseModel):
    exam_id: str
    exam_title: str
    final_score: float
    max_marks: float
    percentage: float
    status: str
    created_at: datetime
    updated_at: datetime


class ExamHistoryResponse(BaseModel):
    history: list[ExamHistoryItem]