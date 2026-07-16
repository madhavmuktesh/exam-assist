from datetime import datetime
from typing import Literal, Optional

from pydantic import BaseModel, Field, model_validator


TimerMode = Literal["full_exam", "per_section", "per_question"]
DifficultyLevel = Literal["easy", "medium", "hard"]
SourceType = Literal["pdf", "topic", "questions_pdf"]
InputMode = Literal["generate_from_content", "extract_existing_questions"]
ExamStatus = Literal["draft", "ready", "in_progress", "submitted", "evaluated"]
GenerationStatus = Literal["pending", "processing", "completed", "failed"]


class SectionTimer(BaseModel):
    section_name: str = Field(..., min_length=2, max_length=100)
    duration_minutes: int = Field(..., ge=1, le=300)


class ExamCreateRequest(BaseModel):
    title: str = Field(..., min_length=3, max_length=150)
    source_type: SourceType
    input_mode: InputMode
    pdf_filename: Optional[str] = None
    topic_name: Optional[str] = None
    instructions: Optional[str] = Field(default=None, max_length=1000)

    difficulty: DifficultyLevel = "medium"
    objective_count: int = Field(..., ge=0, le=200)
    descriptive_count: int = Field(..., ge=0, le=100)
    options_count: int = Field(..., ge=2, le=4)

    timer_mode: TimerMode
    total_duration_minutes: Optional[int] = Field(default=None, ge=1, le=600)
    section_timers: list[SectionTimer] = Field(default_factory=list)
    question_time_seconds: Optional[int] = Field(default=None, ge=10, le=7200)

    @model_validator(mode="after")
    def validate_exam_config(self):
        if self.objective_count == 0 and self.descriptive_count == 0:
            raise ValueError("At least one question must be requested")

        if self.source_type in {"pdf", "questions_pdf"} and not self.pdf_filename:
            raise ValueError("pdf_filename is required for pdf-based exams")

        if self.source_type == "topic" and not self.topic_name:
            raise ValueError("topic_name is required for topic-based exams")

        if self.timer_mode == "full_exam":
            if self.total_duration_minutes is None:
                raise ValueError("total_duration_minutes is required for full_exam mode")
            if self.section_timers:
                raise ValueError("section_timers must be empty for full_exam mode")
            if self.question_time_seconds is not None:
                raise ValueError("question_time_seconds must be empty for full_exam mode")

        if self.timer_mode == "per_section":
            if not self.section_timers:
                raise ValueError("section_timers are required for per_section mode")
            if self.question_time_seconds is not None:
                raise ValueError("question_time_seconds must be empty for per_section mode")

        if self.timer_mode == "per_question":
            if self.question_time_seconds is None:
                raise ValueError("question_time_seconds is required for per_question mode")
            if self.section_timers:
                raise ValueError("section_timers must be empty for per_question mode")

        return self


class ExamUpdateRequest(BaseModel):
    title: Optional[str] = Field(default=None, min_length=3, max_length=150)
    difficulty: Optional[DifficultyLevel] = None
    instructions: Optional[str] = Field(default=None, max_length=1000)
    status: Optional[ExamStatus] = None
    generation_status: Optional[GenerationStatus] = None


class ExamResponse(BaseModel):
    id: str
    user_id: str
    title: str
    source_type: SourceType
    input_mode: InputMode
    pdf_filename: Optional[str]
    topic_name: Optional[str]
    instructions: Optional[str]

    difficulty: DifficultyLevel
    objective_count: int
    descriptive_count: int
    total_questions: int
    options_count: int

    timer_mode: TimerMode
    total_duration_minutes: Optional[int]
    section_timers: list[SectionTimer]
    question_time_seconds: Optional[int]

    status: ExamStatus
    generation_status: GenerationStatus
    is_active: bool

    created_at: datetime
    updated_at: datetime
    prepared_at: Optional[datetime]
    started_at: Optional[datetime]
    submitted_at: Optional[datetime]


class ExamListResponse(BaseModel):
    exams: list[ExamResponse]

class PaginatedExamListResponse(BaseModel):
    exams: list[ExamResponse]
    total: int
    page: int
    limit: int
    has_next: bool
    has_prev: bool