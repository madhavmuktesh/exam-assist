# backend/app/main.py (or equivalent entrypoint)

from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.v1.auth import router as auth_router
from app.api.v1.exams import router as exams_router
from app.api.v1.pipeline import router as pipeline_router
from app.api.v1.profile import router as profile_router
from app.api.v1.questions import router as questions_router
from app.api.v1.responses import router as responses_router
from app.api.v1.files import router as files_router  # ← ADD THIS
from app.core.config import get_settings
from app.core.database import create_indexes, ping_database

settings = get_settings()


@asynccontextmanager
async def lifespan(app: FastAPI):
    db_ok = ping_database()
    if db_ok:
        create_indexes()
    app.state.db_ok = db_ok
    yield


app = FastAPI(
    title=settings.app_name,
    debug=settings.app_debug,
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.backend_cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth_router, prefix="/api/v1")
app.include_router(profile_router, prefix="/api/v1")
app.include_router(exams_router, prefix="/api/v1")
app.include_router(questions_router, prefix="/api/v1")
app.include_router(responses_router, prefix="/api/v1")
app.include_router(pipeline_router, prefix="/api/v1")
app.include_router(files_router, prefix="/api/v1")  # ← ADD THIS


@app.get("/")
async def root():
    return {
        "message": f"{settings.app_name} is running",
        "environment": settings.app_env,
    }


@app.get("/health")
async def health():
    return {
        "status": "ok",
        "database": "connected" if app.state.db_ok else "disconnected",
    }