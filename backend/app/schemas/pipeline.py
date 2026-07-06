from datetime import datetime
from typing import Optional

from pydantic import BaseModel


class PdfUploadResponse(BaseModel):
    exam_id: str
    pdf_filename: str
    pdf_path: str
    page_count: int
    char_count: int
    needs_ocr: bool
    extraction_mode: str
    uploaded_at: datetime


class PrepareExamResponse(BaseModel):
    exam_id: str
    generation_status: str
    status: str
    total_generated_questions: int
    message: str
    processed_at: datetime
    needs_ocr: bool
    extracted_char_count: int
    source_preview: Optional[str]