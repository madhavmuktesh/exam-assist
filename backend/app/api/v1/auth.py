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


# 1. Update your existing login endpoint to return the refresh token:
@router.post("/login", response_model=Token)
def login(
    form_data: OAuth2PasswordRequestForm = Depends(),
    db=Depends(get_database)
):
    user = authenticate_user(db, form_data.username, form_data.password)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    access_token = create_access_token(subject=str(user["_id"]))
    refresh_token = create_refresh_token(subject=str(user["_id"])) # <-- NEW

    return {
        "access_token": access_token,
        "refresh_token": refresh_token, # <-- NEW
        "token_type": "bearer",
    }


# 2. Add the new /refresh endpoint at the bottom of auth.py:
from jose import jwt, JWTError
from app.schemas.auth import RefreshTokenRequest
from app.core.config import get_settings

settings = get_settings()

@router.post("/refresh", response_model=Token)
def refresh_access_token(
    payload: RefreshTokenRequest,
    db = Depends(get_database)
):
    """
    Takes a valid refresh token and returns a new access & refresh token pair.
    """
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    
    try:
        # Decode the token
        decoded_token = jwt.decode(
            payload.refresh_token, settings.secret_key, algorithms=[settings.algorithm]
        )
        
        # Verify it is actually a refresh token
        if decoded_token.get("type") != "refresh":
            raise credentials_exception
            
        user_id: str = decoded_token.get("sub")
        if user_id is None:
            raise credentials_exception
            
    except JWTError:
        raise credentials_exception

    # Verify user still exists in DB
    from bson import ObjectId
    user = db.users.find_one({"_id": ObjectId(user_id)})
    if not user:
        raise credentials_exception

    # Issue new pair
    new_access_token = create_access_token(subject=str(user["_id"]))
    new_refresh_token = create_refresh_token(subject=str(user["_id"]))

    return {
        "access_token": new_access_token,
        "refresh_token": new_refresh_token,
        "token_type": "bearer",
    }


@router.get("/me", response_model=UserResponse)
def me(current_user: dict = Depends(get_current_user)):
    return serialize_user(current_user)