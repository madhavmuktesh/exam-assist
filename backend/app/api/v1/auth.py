import secrets
from datetime import datetime, timedelta, timezone

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
    ForgotPasswordRequest,
    ForgotPasswordResponse,
    LoginRequest,
    RefreshTokenRequest,
    RegisterRequest,
    ResetPasswordRequest,
    Token,
    UserResponse,
)
from app.schemas.auth import UserUpdateProfileRequest, ChangePasswordRequest

router = APIRouter(prefix="/auth", tags=["auth"])
settings = get_settings()

PASSWORD_RESET_EXPIRE_MINUTES = 30


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


@router.post("/forgot-password", response_model=ForgotPasswordResponse)
def forgot_password(payload: ForgotPasswordRequest, db=Depends(get_database)):
    user = db.users.find_one({"email": payload.email.lower().strip()})

    # Always return 200 — never reveal whether the email exists
    if not user:
        return {
            "message": "If that email is registered, a reset link has been sent.",
            "reset_token": None,
        }

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

    # TODO: send reset_token via email (e.g. resend/sendgrid)
    # Expose token in response only during development
    exposed_token = reset_token if settings.app_env == "development" else None

    return {
        "message": "If that email is registered, a reset link has been sent.",
        "reset_token": exposed_token,
    }


@router.post("/reset-password")
def reset_password(payload: ResetPasswordRequest, db=Depends(get_database)):
    now = datetime.now(timezone.utc)

    user = db.users.find_one({
        "password_reset_token": payload.reset_token,
        "password_reset_expires": {"$gt": now},
    })

    if not user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid or expired reset token",
        )

    db.users.update_one(
        {"_id": user["_id"]},
        {
            "$set": {
                "password_hash": hash_password(payload.new_password),
                "updated_at": now,
            },
            "$unset": {
                "password_reset_token": "",
                "password_reset_expires": "",
            },
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
    db=Depends(get_database)
):
    """Update logged-in user's profile information (name, phone)."""
    update_data = {}
    
    if payload.full_name is not None:
        update_data["full_name"] = payload.full_name
        
    if payload.phone_number is not None:
        # Check if the new phone number is already taken by someone else
        if payload.phone_number != current_user.get("phone_number"):
            existing_phone = db.users.find_one({"phone_number": payload.phone_number.strip()})
            if existing_phone:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Phone number already registered to another account."
                )
        update_data["phone_number"] = payload.phone_number

    if not update_data:
        return serialize_user(current_user)

    update_data["updated_at"] = datetime.now(timezone.utc)

    db.users.update_one(
        {"_id": current_user["_id"]},
        {"$set": update_data}
    )

    updated_user = db.users.find_one({"_id": current_user["_id"]})
    return serialize_user(updated_user)


@router.put("/me/password", status_code=status.HTTP_200_OK)
def change_password(
    payload: ChangePasswordRequest, 
    current_user: dict = Depends(get_current_user), 
    db=Depends(get_database)
):
    """Change password for a logged-in user."""
    # 1. Verify the current password is correct
    if not verify_password(payload.current_password, current_user["password_hash"]):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect current password.",
        )

    # 2. Prevent setting the new password to the exact same current password
    if payload.current_password == payload.new_password:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="New password must be different from the current password.",
        )

    # 3. Hash and update
    db.users.update_one(
        {"_id": current_user["_id"]},
        {
            "$set": {
                "password_hash": hash_password(payload.new_password),
                "updated_at": datetime.now(timezone.utc),
            }
        }
    )

    return {"message": "Password updated successfully."}


@router.delete("/me", status_code=status.HTTP_200_OK)
def delete_account(
    current_user: dict = Depends(get_current_user), 
    db=Depends(get_database)
):
    """Permanently delete the logged-in user's account and all associated data."""
    user_id_str = str(current_user["_id"])
    
    # 1. (Optional but recommended) Delete cascading user data to prevent orphaned records
    db.exams.delete_many({"user_id": user_id_str})
    db.questions.delete_many({"user_id": user_id_str})
    db.responses.delete_many({"user_id": user_id_str})
    db.results.delete_many({"user_id": user_id_str})
    
    # 2. Delete the actual user record
    db.users.delete_one({"_id": current_user["_id"]})
    
    return {"message": "Account and all associated data deleted successfully."}