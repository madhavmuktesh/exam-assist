from typing import Literal, Optional

from pydantic import BaseModel, Field, model_validator


QuestionType = Literal["objective", "descriptive"]


class LLMQuestionOption(BaseModel):
    id: str = Field(..., min_length=1, max_length=5)
    text: str = Field(..., min_length=1, max_length=500)


class LLMGeneratedQuestion(BaseModel):
    question_type: QuestionType
    question_text: str = Field(..., min_length=5, max_length=5000)
    question_order: int = Field(..., ge=1, le=1000)
    marks: float = Field(..., gt=0, le=100)

    options: list[LLMQuestionOption] = Field(default_factory=list)
    correct_option_ids: list[str] = Field(default_factory=list)
    correct_answer_text: Optional[str] = Field(default=None, max_length=5000)
    explanation: Optional[str] = Field(default=None, max_length=5000)

    section_name: Optional[str] = Field(default=None, max_length=100)
    difficulty: Optional[str] = Field(default=None, max_length=30)
    source_chunk_ids: list[str] = Field(default_factory=list)
    time_limit_seconds: Optional[int] = Field(default=None, ge=10, le=7200)

    @model_validator(mode="after")
    def validate_question(self):
        if self.question_type == "objective":
            if len(self.options) < 2:
                raise ValueError("Objective questions must have at least 2 options")
            if not self.correct_option_ids:
                raise ValueError("Objective questions must have at least 1 correct option")
            option_ids = {item.id for item in self.options}
            if not set(self.correct_option_ids).issubset(option_ids):
                raise ValueError("correct_option_ids must exist in options")
            if self.correct_answer_text is not None:
                raise ValueError("correct_answer_text must be empty for objective questions")

        if self.question_type == "descriptive":
            if self.options:
                raise ValueError("Descriptive questions cannot have options")
            if self.correct_option_ids:
                raise ValueError("Descriptive questions cannot have correct_option_ids")

        return self


class LLMGeneratedQuestionSet(BaseModel):
    questions: list[LLMGeneratedQuestion]