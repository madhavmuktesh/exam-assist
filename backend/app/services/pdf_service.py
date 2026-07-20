# Re-exports for backward compatibility
from app.utils.file_utils import save_uploaded_pdf, UPLOAD_DIR
from app.rag.loaders.pdf_loader import extract_text_from_pdf

__all__ = ["save_uploaded_pdf", "UPLOAD_DIR", "extract_text_from_pdf"]