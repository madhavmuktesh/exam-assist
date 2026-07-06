from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status

from app.api.deps import get_current_user, serialize_user
from app.core.database import get_database
from app.schemas.profile import ProfileResponse, ProfileUpdateRequest

router = APIRouter(prefix="/profile", tags=["profile"])


@router.get("", response_model=ProfileResponse)
def get_profile(current_user: dict = Depends(get_current_user)):
    return serialize_user(current_user)


@router.put("", response_model=ProfileResponse)
def update_profile(
    payload: ProfileUpdateRequest,
    current_user: dict = Depends(get_current_user),
):
    db = get_database()

    update_data = {}

    if payload.full_name is not None:
        update_data["full_name"] = payload.full_name.strip()

    if payload.phone_number is not None:
        normalized_phone = payload.phone_number.strip()

        existing_phone_owner = db.users.find_one({"phone_number": normalized_phone})
        if existing_phone_owner and existing_phone_owner["_id"] != current_user["_id"]:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Phone number already registered",
            )

        update_data["phone_number"] = normalized_phone

    if update_data:
        update_data["updated_at"] = datetime.now(timezone.utc)
        db.users.update_one(
            {"_id": current_user["_id"]},
            {"$set": update_data},
        )

    updated_user = db.users.find_one({"_id": current_user["_id"]})
    return serialize_user(updated_user)