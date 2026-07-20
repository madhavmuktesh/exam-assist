from datetime import datetime, timezone

from bson import ObjectId
from fastapi import HTTPException, status

from app.core.security import hash_password, verify_password
from app.core.security import create_access_token, create_refresh_token


def serialize_user(user: dict) -> dict:
    return {
        "id": str(user["_id"]),
        "full_name": user["full_name"],
        "email": user["email"],
        "phone_number": user.get("phone_number"),
        "created_at": user["created_at"],
        "updated_at": user["updated_at"],
    }


def login_user(db, email: str, password: str) -> dict:
    user = db.users.find_one({"email": email.lower().strip()})
    if not user or not verify_password(password, user["password_hash"]):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    return {
        "access_token": create_access_token(subject=str(user["_id"])),
        "refresh_token": create_refresh_token(subject=str(user["_id"])),
        "token_type": "bearer",
    }


def register_user(db, full_name: str, email: str, phone_number: str, password: str) -> dict:
    from app.models.user import user_document

    if db.users.find_one({"email": email.lower().strip()}):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email already registered",
        )
    if db.users.find_one({"phone_number": phone_number.strip()}):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Phone number already registered",
        )

    new_user = user_document(
        full_name=full_name,
        email=email,
        phone_number=phone_number,
        password_hash=hash_password(password),
    )
    result = db.users.insert_one(new_user)
    created_user = db.users.find_one({"_id": result.inserted_id})
    return serialize_user(created_user)


def update_user_profile(db, current_user: dict, full_name: str | None, phone_number: str | None) -> dict:
    update_data = {}

    if full_name is not None:
        update_data["full_name"] = full_name

    if phone_number is not None:
        if phone_number != current_user.get("phone_number"):
            existing_phone = db.users.find_one({"phone_number": phone_number.strip()})
            if existing_phone:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Phone number already registered to another account.",
                )
        update_data["phone_number"] = phone_number

    if not update_data:
        return serialize_user(current_user)

    update_data["updated_at"] = datetime.now(timezone.utc)
    db.users.update_one({"_id": current_user["_id"]}, {"$set": update_data})
    updated_user = db.users.find_one({"_id": current_user["_id"]})
    return serialize_user(updated_user)


def change_user_password(db, current_user: dict, current_password: str, new_password: str) -> dict:
    if not verify_password(current_password, current_user["password_hash"]):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect current password.",
        )
    if current_password == new_password:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="New password must be different from the current password.",
        )
    db.users.update_one(
        {"_id": current_user["_id"]},
        {"$set": {
            "password_hash": hash_password(new_password),
            "updated_at": datetime.now(timezone.utc),
        }},
    )
    return {"message": "Password updated successfully."}


def delete_user_account(db, current_user: dict) -> dict:
    user_id_str = str(current_user["_id"])
    db.exams.delete_many({"user_id": user_id_str})
    db.questions.delete_many({"user_id": user_id_str})
    db.responses.delete_many({"user_id": user_id_str})
    db.results.delete_many({"user_id": user_id_str})
    db.users.delete_one({"_id": current_user["_id"]})
    return {"message": "Account and all associated data deleted successfully."}