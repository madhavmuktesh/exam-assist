# backend/app/api/v1/files.py

from fastapi import APIRouter, Depends, File, UploadFile, HTTPException, status

from app.api.deps import get_current_user
from app.services.pdf_service import save_uploaded_pdf

router = APIRouter(prefix="/files", tags=["files"])


@router.post("/upload-pdf")
async def upload_pdf(
    file: UploadFile = File(...),
    current_user: dict = Depends(get_current_user),
):
    """
    Upload a PDF, save it to the uploads/ directory, and return the safe filename.
    """
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

    safe_path = save_uploaded_pdf(file_name=file.filename, file_bytes=contents)
    # safe_path is like "uploads/SSC-...pdf"
    # store only the file name part in pdf_filename
    pdf_filename = safe_path.split("/")[-1].split("\\")[-1]

    return {"pdf_filename": pdf_filename}