"""
Auth endpoints: signup, login, get current user.
"""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, EmailStr
from sqlalchemy.orm import Session

from database.db import get_db
from database.models import User
from services.auth_service import hash_password, verify_password, create_token, get_current_user

router = APIRouter()


class SignupRequest(BaseModel):
    name: str
    email: str
    password: str


class LoginRequest(BaseModel):
    email: str
    password: str


def _user_dict(user: User, token: str) -> dict:
    initials = ""
    if user.name:
        parts = user.name.strip().split()
        initials = "".join(p[0].upper() for p in parts[:2])
    return {
        "id": user.id,
        "email": user.email,
        "name": user.name,
        "role": user.role,
        "institution": user.institution,
        "department": user.department,
        "bio": user.bio,
        "initials": initials,
        "token": token,
    }


@router.post("/api/auth/signup")
def signup(req: SignupRequest, db: Session = Depends(get_db)):
    if not req.email or not req.password:
        raise HTTPException(status_code=400, detail="Email and password are required")
    if len(req.password) < 6:
        raise HTTPException(status_code=400, detail="Password must be at least 6 characters")
    existing = db.query(User).filter(User.email == req.email.lower().strip()).first()
    if existing:
        raise HTTPException(status_code=409, detail="An account with this email already exists")
    user = User(
        email=req.email.lower().strip(),
        name=req.name.strip(),
        password_hash=hash_password(req.password),
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    token = create_token(user.id)
    return _user_dict(user, token)


@router.post("/api/auth/login")
def login(req: LoginRequest, db: Session = Depends(get_db)):
    if not req.email or not req.password:
        raise HTTPException(status_code=400, detail="Email and password are required")
    user = db.query(User).filter(User.email == req.email.lower().strip()).first()
    if not user or not verify_password(req.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    token = create_token(user.id)
    return _user_dict(user, token)


@router.get("/api/auth/me")
def me(user: User = Depends(get_current_user)):
    token = create_token(user.id)
    return _user_dict(user, token)
