from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import get_settings
from app.core.database import ping_database

settings = get_settings()


@asynccontextmanager
async def lifespan(app: FastAPI):
    db_ok = ping_database()
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