from bson import ObjectId
from fastapi import HTTPException, status


def validate_object_id(id_str: str, label: str = "id") -> ObjectId:
    """Validates and returns an ObjectId, raises 400 if invalid."""
    if not ObjectId.is_valid(id_str):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid {label}: {id_str}",
        )
    return ObjectId(id_str)