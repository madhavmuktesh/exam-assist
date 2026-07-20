import uuid
from pathlib import Path

UPLOAD_DIR = Path("uploads")
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)


def save_uploaded_pdf(file_name: str, file_bytes: bytes) -> str:
    """
    Saves PDF with a UUID prefix to prevent filename collisions
    and path traversal attacks.
    """
    safe_name = Path(file_name).name.replace(" ", "_")
    unique_name = f"{uuid.uuid4().hex}_{safe_name}"
    target_path = UPLOAD_DIR / unique_name
    target_path.write_bytes(file_bytes)
    return unique_name