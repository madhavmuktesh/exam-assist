from datetime import datetime
from typing import Literal, Optional

from pydantic import BaseModel, Field, model_validator


SourceType = Literal["pdf", "topic", "questions_pdf"]
Difficulty = Literal["easy", "medium", "hard"]
TimerMode = Literal["full_exam", "per_section", "per_question"]
QuestionPreparationMode = Literal[
    "generate_from_content",
    "extract_existing_questions",
]
ExamStatus = Literal[
    "draft",
    "ready",
    "in_progress",
    "paused",
    "cancelled",
    "submitted",
    "evaluated",
    "reviewed",
    "pending_review",
]
GenerationStatus = Literal[
    "pending",
    "processing",
    "completed",
    "failed",
    "not_applicable",
]
QuestionType = Literal["objective", "descriptive"]


class SectionTimer(BaseModel):
    section_name: str = Field(..., min_length=1, max_length=200)
    duration_minutes: int = Field(..., gt=0, le=600)


class StudentQuestionOption(BaseModel):
    id: str
    text: str


class StudentQuestion(BaseModel):
    id: str
    question_text: str
    question_type: QuestionType
    marks: float
    options: list[StudentQuestionOption] = Field(default_factory=list)


class ResumePayload(BaseModel):
    remaining_seconds: int = Field(..., ge=0)
    current_index: int = Field(..., ge=0)
    answers: dict[str, str] = Field(default_factory=dict)
    flagged: dict[str, bool] = Field(default_factory=dict)


class ExamCreateRequest(BaseModel):
    title: str = Field(..., min_length=1, max_length=255)
    source_type: SourceType
    input_mode: QuestionPreparationMode
    difficulty: Difficulty

    objective_count: int = Field(..., ge=0, le=500)
    descriptive_count: int = Field(..., ge=0, le=500)
    options_count: int = Field(..., ge=2, le=10)

    timer_mode: TimerMode
    total_duration_minutes: Optional[int] = Field(default=None, gt=0, le=1440)
    section_timers: list[SectionTimer] = Field(default_factory=list)
    question_time_seconds: Optional[int] = Field(default=None, gt=0, le=7200)

    pdf_filename: Optional[str] = None
    topic_name: Optional[str] = None
    instructions: Optional[str] = Field(default=None, max_length=5000)

    @model_validator(mode="after")
    def validate_timer_configuration(self):
        if self.timer_mode in {"full_exam", "per_section"}:
            if self.timer_mode == "full_exam" and self.total_duration_minutes is None:
                raise ValueError(
                    "total_duration_minutes is required for full_exam timer mode"
                )

            if self.timer_mode == "per_section" and not self.section_timers:
                raise ValueError(
                    "section_timers are required for per_section timer mode"
                )

            if self.question_time_seconds is not None:
                raise ValueError(
                    "question_time_seconds must be empty unless timer_mode is per_question"
                )

        if self.timer_mode == "per_question":
            if self.question_time_seconds is None:
                raise ValueError(
                    "question_time_seconds is required for per_question timer mode"
                )

            if self.total_duration_minutes is not None:
                raise ValueError(
                    "total_duration_minutes must be empty for per_question timer mode"
                )

            if self.section_timers:
                raise ValueError(
                    "section_timers must be empty for per_question timer mode"
                )

        return self

    @model_validator(mode="after")
    def validate_source_configuration(self):
        if self.source_type == "pdf":
            if not self.pdf_filename:
                raise ValueError("pdf_filename is required when source_type is pdf")
        else:
            if self.pdf_filename is not None:
                raise ValueError(
                    "pdf_filename must be empty unless source_type is pdf"
                )

        if self.source_type == "topic":
            if not self.topic_name:
                raise ValueError("topic_name is required when source_type is topic")

        return self

    @model_validator(mode="after")
    def validate_question_counts(self):
        if self.objective_count + self.descriptive_count <= 0:
            raise ValueError("At least one question must be requested")
        return self


class ExamUpdateRequest(BaseModel):
    title: Optional[str] = Field(default=None, min_length=1, max_length=255)
    difficulty: Optional[Difficulty] = None
    objective_count: Optional[int] = Field(default=None, ge=0, le=500)
    descriptive_count: Optional[int] = Field(default=None, ge=0, le=500)
    options_count: Optional[int] = Field(default=None, ge=2, le=10)
    instructions: Optional[str] = Field(default=None, max_length=5000)


class ExamResponse(BaseModel):
    id: str
    user_id: str
    title: str
    source_type: SourceType
    input_mode: QuestionPreparationMode
    pdf_filename: Optional[str] = None
    topic_name: Optional[str] = None
    instructions: Optional[str] = None
    difficulty: Difficulty

    objective_count: int
    descriptive_count: int
    total_questions: int
    options_count: int

    timer_mode: TimerMode
    total_duration_minutes: Optional[int] = None
    section_timers: list[SectionTimer] = Field(default_factory=list)
    question_time_seconds: Optional[int] = None

    status: ExamStatus
    generation_status: GenerationStatus
    is_active: bool

    created_at: datetime
    updated_at: datetime
    prepared_at: Optional[datetime] = None
    started_at: Optional[datetime] = None
    submitted_at: Optional[datetime] = None
    paused_at: Optional[datetime] = None
    resumed_at: Optional[datetime] = None
    cancelled_at: Optional[datetime] = None


class PaginatedExamListResponse(BaseModel):
    exams: list[ExamResponse]
    total: int
    page: int
    limit: int
    has_next: bool
    has_prev: bool


class StartExamResponse(BaseModel):
    exam_id: str
    timer_mode: TimerMode
    total_duration_minutes: Optional[int] = None
    question_time_seconds: Optional[int] = None
    status: ExamStatus
    resume_payload: Optional[ResumePayload] = None
    questions: list[StudentQuestion] = Field(default_factory=list)


class ExamPauseRequest(BaseModel):
    remaining_seconds: int = Field(..., ge=0)
    current_index: int = Field(..., ge=0)
    answers: dict[str, str] = Field(default_factory=dict)
    flagged: dict[str, bool] = Field(default_factory=dict)


class ExamPauseResponse(BaseModel):
    message: str
    exam_id: str
    status: Literal["paused"]
    paused_at: datetime


class ExamCancelResponse(BaseModel):
    message: str