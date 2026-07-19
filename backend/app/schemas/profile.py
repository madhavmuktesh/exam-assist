from datetime import datetime
from typing import Optional

from pydantic import BaseModel, EmailStr, Field


class ProfileResponse(BaseModel):
    id: str
    full_name: str
    email: EmailStr
    phone_number: str
    is_active: bool
    created_at: datetime
    updated_at: datetime


class ProfileUpdateRequest(BaseModel):
    full_name: Optional[str] = Field(default=None, min_length=2, max_length=100)
    phone_number: Optional[str] = Field(default=None, min_length=10, max_length=20)

class ChangePasswordRequest(BaseModel):
    current_password: str = Field(..., min_length=6, max_length=72)
    new_password: str = Field(..., min_length=6, max_length=72)