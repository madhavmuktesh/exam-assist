from datetime import datetime, timezone
from typing import Any


def user_document(
    full_name: str,
    email: str,
    phone_number: str,
    password_hash: str,
) -> dict[str, Any]:
    now = datetime.now(timezone.utc)
    return {
        "full_name": full_name.strip(),
        "email": email.lower().strip(),
        "phone_number": phone_number.strip(),
        "password_hash": password_hash,
        "is_active": True,
        "created_at": now,
        "updated_at": now,
    }