from functools import lru_cache
from typing import List

from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    app_name: str = "Exam Assistant API"
    app_env: str = "development"
    app_host: str = "0.0.0.0"
    app_port: int = 8000
    app_debug: bool = True

    mongodb_uri: str = "mongodb://localhost:27017"
    mongodb_db_name: str = "exam_assistant"

    jwt_secret_key: str
    jwt_algorithm: str = "HS256"
    jwt_access_token_expire_minutes: int = 60 * 24 * 2
    refresh_token_expire_minutes: int = 60 * 24 * 2

    backend_cors_origins: List[str] = Field(
        default=["http://localhost:3000", "http://127.0.0.1:3000"]
    )

    openrouter_api_key: str = ""
    openrouter_base_url: str = "https://openrouter.ai/api/v1"
    openrouter_model: str = "openrouter/free"
    openrouter_site_url: str = "http://localhost:3000"
    openrouter_site_name: str = "Exam Assistant"

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    @field_validator("backend_cors_origins")
    @classmethod
    def strip_trailing_slash(cls, value: List[str]) -> List[str]:
        return [origin.rstrip("/") for origin in value]


@lru_cache
def get_settings() -> Settings:
    return Settings()