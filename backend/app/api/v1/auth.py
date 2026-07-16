from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException, status
from jose import JWTError, jwt

from app.api.deps import get_current_user, serialize_user
from app.core.config import get_settings
from app.core.database import get_database
from app.core.security import (
    create_access_token,
    create_refresh_token,
    hash_password,
    verify_password,
)
from app.models.user import user_document
from app.schemas.auth import (
    LoginRequest,
    RefreshTokenRequest,
    RegisterRequest,
    Token,
    UserResponse,
)

router = APIRouter(prefix="/auth", tags=["auth"])
settings = get_settings()


@router.post("/register", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
def register(payload: RegisterRequest, db=Depends(get_database)):
    if db.users.find_one({"email": payload.email.lower().strip()}):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email already registered",
        )
    if db.users.find_one({"phone_number": payload.phone_number.strip()}):
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


@router.post("/login", response_model=Token)
def login(payload: LoginRequest, db=Depends(get_database)):
    user = db.users.find_one({"email": payload.email.lower().strip()})
    if not user or not verify_password(payload.password, user["password_hash"]):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )

    access_token = create_access_token(subject=str(user["_id"]))
    refresh_token = create_refresh_token(subject=str(user["_id"]))

    return {
        "access_token": access_token,
        "refresh_token": refresh_token,
        "token_type": "bearer",
    }


@router.post("/refresh", response_model=Token)
def refresh_access_token(payload: RefreshTokenRequest, db=Depends(get_database)):
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )

    try:
        decoded = jwt.decode(
            payload.refresh_token,
            settings.jwt_secret_key,
            algorithms=[settings.jwt_algorithm],
        )
        if decoded.get("type") != "refresh":
            raise credentials_exception
        user_id: str = decoded.get("sub")
        if not user_id:
            raise credentials_exception
    except JWTError:
        raise credentials_exception

    user = db.users.find_one({"_id": ObjectId(user_id)})
    if not user:
        raise credentials_exception

    return {
        "access_token": create_access_token(subject=str(user["_id"])),
        "refresh_token": create_refresh_token(subject=str(user["_id"])),
        "token_type": "bearer",
    }


@router.get("/me", response_model=UserResponse)
def me(current_user: dict = Depends(get_current_user)):
    return serialize_user(current_user)