from pathlib import Path

from app.utils.file_utils import UPLOAD_DIR, save_uploaded_pdf


def get_upload_path(filename: str) -> Path:
    """Returns the full path for a given uploaded filename."""
    return UPLOAD_DIR / filename


def pdf_exists(filename: str) -> bool:
    """Check if an uploaded PDF file exists on disk."""
    return get_upload_path(filename).exists()


def delete_uploaded_file(filename: str) -> bool:
    """Deletes an uploaded file. Returns True if deleted, False if not found."""
    path = get_upload_path(filename)
    if path.exists():
        path.unlink()
        return True
    return False


# Re-export for convenience
__all__ = [
    "save_uploaded_pdf",
    "get_upload_path",
    "pdf_exists",
    "delete_uploaded_file",
    "UPLOAD_DIR",
]