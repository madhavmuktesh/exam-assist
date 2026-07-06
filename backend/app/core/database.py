from pymongo import MongoClient
from pymongo.database import Database

from app.core.config import get_settings

settings = get_settings()

client = MongoClient(settings.mongodb_uri)
db: Database = client[settings.mongodb_db_name]


def get_database() -> Database:
    return db


def ping_database() -> bool:
    try:
        client.admin.command("ping")
        return True
    except Exception:
        return False


def create_indexes() -> None:
    db.users.create_index("email", unique=True)
    db.users.create_index("phone_number", unique=True)

    db.exams.create_index([("user_id", 1), ("created_at", -1)])
    db.exams.create_index("status")
    db.exams.create_index("generation_status")

    db.questions.create_index([("exam_id", 1), ("question_order", 1)], unique=True)
    db.questions.create_index([("user_id", 1), ("exam_id", 1)])

    db.responses.create_index([("exam_id", 1), ("user_id", 1)])
    db.responses.create_index([("question_id", 1), ("user_id", 1)])

    db.results.create_index([("exam_id", 1), ("user_id", 1)], unique=True)