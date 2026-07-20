from bson import ObjectId
from datetime import datetime, timezone


def find_user_by_email(db, email: str) -> dict | None:
    return db.users.find_one({"email": email.lower().strip()})


def find_user_by_id(db, user_id: str) -> dict | None:
    if not ObjectId.is_valid(user_id):
        return None
    return db.users.find_one({"_id": ObjectId(user_id)})


def find_user_by_phone(db, phone_number: str) -> dict | None:
    return db.users.find_one({"phone_number": phone_number.strip()})


def insert_user(db, user_doc: dict) -> dict:
    result = db.users.insert_one(user_doc)
    return db.users.find_one({"_id": result.inserted_id})


def update_user(db, user_id: ObjectId, update_data: dict) -> dict:
    update_data["updated_at"] = datetime.now(timezone.utc)
    db.users.update_one({"_id": user_id}, {"$set": update_data})
    return db.users.find_one({"_id": user_id})


def delete_user(db, user_id: ObjectId) -> None:
    db.users.delete_one({"_id": user_id})


def set_password_reset_token(db, user_id: ObjectId, token: str, expires_at: datetime) -> None:
    db.users.update_one(
        {"_id": user_id},
        {"$set": {
            "password_reset_token": token,
            "password_reset_expires": expires_at,
            "updated_at": datetime.now(timezone.utc),
        }},
    )


def find_user_by_reset_token(db, token: str, now: datetime) -> dict | None:
    return db.users.find_one({
        "password_reset_token": token,
        "password_reset_expires": {"$gt": now},
    })


def clear_reset_token(db, user_id: ObjectId, new_password_hash: str) -> None:
    db.users.update_one(
        {"_id": user_id},
        {
            "$set": {
                "password_hash": new_password_hash,
                "updated_at": datetime.now(timezone.utc),
            },
            "$unset": {
                "password_reset_token": "",
                "password_reset_expires": "",
            },
        },
    )