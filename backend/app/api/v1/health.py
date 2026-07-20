from fastapi import APIRouter
from app.core.database import get_database

router = APIRouter(prefix="/health", tags=["health"])


@router.get("")
def health_check():
    return {"status": "ok", "service": "exam-assist-api"}


@router.get("/db")
def db_health_check():
    try:
        db = get_database()
        db.command("ping")
        return {"status": "ok", "database": "connected"}
    except Exception as e:
        return {"status": "error", "database": str(e)}