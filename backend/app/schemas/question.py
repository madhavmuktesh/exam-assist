from datetime import datetime
from typing import Literal, Optional

from pydantic import BaseModel, Field, model_validator


QuestionType = Literal["objective", "descriptive"]


class QuestionOption(BaseModel):
    id: str = Field(..., min_length=1, max_length=20)
    text: str = Field(..., min_length=1, max_length=500)


class QuestionCreateRequest(BaseModel):
    question_type: QuestionType
    question_text: str = Field(..., min_length=5, max_length=5000)
    question_order: int = Field(..., ge=1, le=1000)
    marks: float = Field(..., gt=0, le=100)

    options: list[QuestionOption] = Field(default_factory=list)
    correct_option_ids: list[str] = Field(default_factory=list)
    correct_answer_text: Optional[str] = Field(default=None, max_length=5000)
    explanation: Optional[str] = Field(default=None, max_length=5000)

    section_name: Optional[str] = Field(default=None, max_length=100)
    difficulty: Optional[str] = Field(default=None, max_length=30)
    source_chunk_ids: list[str] = Field(default_factory=list)
    time_limit_seconds: Optional[int] = Field(default=None, ge=10, le=7200)

    @model_validator(mode="after")
    def validate_question_type_rules(self):
        if self.question_type == "objective":
            if len(self.options) < 2:
                raise ValueError("Objective questions must have at least 2 options")
            if len(self.correct_option_ids) < 1:
                raise ValueError("Objective questions must have at least 1 correct option")
            option_ids = {option.id for option in self.options}
            if not set(self.correct_option_ids).issubset(option_ids):
                raise ValueError("All correct_option_ids must exist in options")
            if self.correct_answer_text is not None:
                raise ValueError("correct_answer_text must be empty for objective questions")

        if self.question_type == "descriptive":
            if self.options:
                raise ValueError("Descriptive questions cannot have options")
            if self.correct_option_ids:
                raise ValueError("Descriptive questions cannot have correct_option_ids")

        return self


class QuestionUpdateRequest(BaseModel):
    question_text: Optional[str] = Field(default=None, min_length=5, max_length=5000)
    question_order: Optional[int] = Field(default=None, ge=1, le=1000)
    marks: Optional[float] = Field(default=None, gt=0, le=100)

    options: Optional[list[QuestionOption]] = None
    correct_option_ids: Optional[list[str]] = None
    correct_answer_text: Optional[str] = Field(default=None, max_length=5000)
    explanation: Optional[str] = Field(default=None, max_length=5000)

    section_name: Optional[str] = Field(default=None, max_length=100)
    difficulty: Optional[str] = Field(default=None, max_length=30)
    source_chunk_ids: Optional[list[str]] = None
    time_limit_seconds: Optional[int] = Field(default=None, ge=10, le=7200)


class BaseQuestionView(BaseModel):
    id: str
    exam_id: str
    user_id: str

    question_type: QuestionType
    question_text: str
    question_order: int
    marks: float

    options: list[QuestionOption]

    section_name: Optional[str]
    difficulty: Optional[str]
    source_chunk_ids: list[str]
    time_limit_seconds: Optional[int]

    is_active: bool
    created_at: datetime
    updated_at: datetime


class AuthorQuestionResponse(BaseQuestionView):
    correct_option_ids: list[str]
    correct_answer_text: Optional[str]
    explanation: Optional[str]


class StudentQuestionResponse(BaseModel):
    id: str
    exam_id: str
    question_type: QuestionType
    question_text: str
    question_order: int
    marks: float
    options: list[QuestionOption]
    section_name: Optional[str]
    difficulty: Optional[str]
    time_limit_seconds: Optional[int]


class AuthorQuestionListResponse(BaseModel):
    questions: list[AuthorQuestionResponse]


class StudentQuestionListResponse(BaseModel):
    questions: list[StudentQuestionResponse]