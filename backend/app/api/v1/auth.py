from fastapi import APIRouter, Depends, HTTPException, status

from app.api.deps import get_current_user, serialize_user
from app.core.database import get_database
from app.core.security import create_access_token, hash_password, verify_password
from app.models.user import user_document
from app.schemas.auth import LoginRequest, RegisterRequest, TokenResponse, UserResponse

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/register", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
def register(payload: RegisterRequest):
    db = get_database()

    existing_email = db.users.find_one({"email": payload.email.lower().strip()})
    if existing_email:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email already registered",
        )

    existing_phone = db.users.find_one({"phone_number": payload.phone_number.strip()})
    if existing_phone:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Phone number already registered",
        )

    new_user = user_document(
        full_name=payload.full_name,
        email=payload.email,
        phone_number=payload.phone_number,
        password_hash=hash_password(payload.password),
    )

    result = db.users.insert_one(new_user)
    created_user = db.users.find_one({"_id": result.inserted_id})

    return serialize_user(created_user)


@router.post("/login", response_model=TokenResponse)
def login(payload: LoginRequest):
    db = get_database()

    user = db.users.find_one({"email": payload.email.lower().strip()})
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password",
        )

    if not verify_password(payload.password, user["password_hash"]):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password",
        )

    access_token = create_access_token(subject=str(user["_id"]))
    return TokenResponse(access_token=access_token)


@router.get("/me", response_model=UserResponse)
def me(current_user: dict = Depends(get_current_user)):
    return serialize_user(current_user)