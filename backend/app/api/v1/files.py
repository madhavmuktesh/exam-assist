import os
from pathlib import Path

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status
from fastapi.responses import FileResponse

from app.api.deps import get_current_user
from app.services.pdf_service import UPLOAD_DIR, save_uploaded_pdf

router = APIRouter(prefix="/files", tags=["files"])


@router.post("/upload-pdf")
async def upload_pdf(
    file: UploadFile = File(...),
    current_user: dict = Depends(get_current_user),
):
    """Upload a PDF and return the safe stored filename."""
    if not file.filename.lower().endswith(".pdf"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Only PDF files are allowed.",
        )

    contents = await file.read()
    if not contents:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Uploaded file is empty.",
        )

    # 10 MB cap — prevents memory exhaustion
    if len(contents) > 10 * 1024 * 1024:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="File too large. Maximum allowed size is 10 MB.",
        )

    pdf_filename = save_uploaded_pdf(file_name=file.filename, file_bytes=contents)
    return {"pdf_filename": pdf_filename}


@router.get("")
def list_uploaded_files(current_user: dict = Depends(get_current_user)):
    """
    List all PDF files in the uploads directory.
    Returns filename, size in KB, and last modified time.
    """
    if not UPLOAD_DIR.exists():
        return {"files": []}

    files = []
    for f in sorted(UPLOAD_DIR.iterdir(), key=os.path.getmtime, reverse=True):
        if f.is_file() and f.suffix.lower() == ".pdf":
            stat = f.stat()
            files.append({
                "filename": f.name,
                "size_kb": round(stat.st_size / 1024, 2),
                "uploaded_at": stat.st_mtime,
            })

    return {"files": files}


@router.delete("/{filename}")
def delete_uploaded_file(
    filename: str,
    current_user: dict = Depends(get_current_user),
):
    """
    Delete a specific uploaded PDF by filename.
    Guards against path traversal (e.g. ../../etc/passwd).
    """
    # Security: resolve the path and confirm it stays inside UPLOAD_DIR
    target = (UPLOAD_DIR / filename).resolve()
    upload_dir_resolved = UPLOAD_DIR.resolve()

    if not str(target).startswith(str(upload_dir_resolved)):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid filename.",
        )

    if not target.exists() or not target.is_file():
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="File not found.",
        )

    target.unlink()
    return {"message": f"{filename} deleted successfully."}