from pydantic import BaseModel


class MessageResponse(BaseModel):
    message: str


class PaginationMeta(BaseModel):
    total: int
    page: int
    limit: int
    has_next: bool
    has_prev: bool


class ErrorResponse(BaseModel):
    detail: str