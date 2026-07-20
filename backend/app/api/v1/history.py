from fastapi import APIRouter, Depends

from app.api.deps import get_current_user
from app.core.database import get_database
from app.services.history_service import get_exam_history
from app.schemas.response import ExamHistoryResponse

router = APIRouter(prefix="/history", tags=["history"])


@router.get("", response_model=ExamHistoryResponse)
def exam_history(current_user: dict = Depends(get_current_user)):
    db = get_database()
    history = get_exam_history(db, str(current_user["_id"]))
    return {"history": history}