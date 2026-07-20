import secrets
from datetime import datetime, timedelta, timezone

from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException, status
from jose import JWTError, jwt

from app.api.deps import get_current_user
from app.core.config import get_settings
from app.core.database import get_database
from app.core.security import create_access_token, create_refresh_token, hash_password
from app.services.auth_service import (
    serialize_user,
    register_user,
    login_user,
    update_user_profile,
    change_user_password,
    delete_user_account,
)
from app.schemas.auth import (
    ForgotPasswordRequest,
    ForgotPasswordResponse,
    LoginRequest,
    RefreshTokenRequest,
    RegisterRequest,
    ResetPasswordRequest,
    Token,
    UserResponse,
    UserUpdateProfileRequest,
    ChangePasswordRequest,
)

router = APIRouter(prefix="/auth", tags=["auth"])
settings = get_settings()

PASSWORD_RESET_EXPIRE_MINUTES = 30


@router.post("/register", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
def register(payload: RegisterRequest, db=Depends(get_database)):
    return register_user(
        db,
        full_name=payload.full_name,
        email=payload.email,
        phone_number=payload.phone_number,
        password=payload.password,
    )


@router.post("/login", response_model=Token)
def login(payload: LoginRequest, db=Depends(get_database)):
    return login_user(db, email=payload.email, password=payload.password)


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


@router.post("/forgot-password", response_model=ForgotPasswordResponse)
def forgot_password(payload: ForgotPasswordRequest, db=Depends(get_database)):
    user = db.users.find_one({"email": payload.email.lower().strip()})

    if not user:
        return {"message": "If that email is registered, a reset link has been sent.", "reset_token": None}

    reset_token = secrets.token_urlsafe(32)
    expires_at = datetime.now(timezone.utc) + timedelta(minutes=PASSWORD_RESET_EXPIRE_MINUTES)

    db.users.update_one(
        {"_id": user["_id"]},
        {"$set": {
            "password_reset_token": reset_token,
            "password_reset_expires": expires_at,
            "updated_at": datetime.now(timezone.utc),
        }},
    )

    exposed_token = reset_token if settings.app_env == "development" else None
    return {"message": "If that email is registered, a reset link has been sent.", "reset_token": exposed_token}


@router.post("/reset-password")
def reset_password(payload: ResetPasswordRequest, db=Depends(get_database)):
    now = datetime.now(timezone.utc)
    user = db.users.find_one({
        "password_reset_token": payload.reset_token,
        "password_reset_expires": {"$gt": now},
    })
    if not user:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid or expired reset token")

    db.users.update_one(
        {"_id": user["_id"]},
        {
            "$set": {"password_hash": hash_password(payload.new_password), "updated_at": now},
            "$unset": {"password_reset_token": "", "password_reset_expires": ""},
        },
    )
    return {"message": "Password has been reset successfully."}


@router.get("/me", response_model=UserResponse)
def me(current_user: dict = Depends(get_current_user)):
    return serialize_user(current_user)


@router.put("/me", response_model=UserResponse)
def update_profile(
    payload: UserUpdateProfileRequest,
    current_user: dict = Depends(get_current_user),
    db=Depends(get_database),
):
    return update_user_profile(db, current_user, payload.full_name, payload.phone_number)


@router.put("/me/password", status_code=status.HTTP_200_OK)
def change_password(
    payload: ChangePasswordRequest,
    current_user: dict = Depends(get_current_user),
    db=Depends(get_database),
):
    return change_user_password(db, current_user, payload.current_password, payload.new_password)


@router.delete("/me", status_code=status.HTTP_200_OK)
def delete_account(
    current_user: dict = Depends(get_current_user),
    db=Depends(get_database),
):
    return delete_user_account(db, current_user)