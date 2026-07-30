"""
SQLAlchemy models for users, profiles, saved work, and activity.
"""

from __future__ import annotations

import time

from sqlalchemy import Column, Integer, String, Float, ForeignKey, Text
from sqlalchemy.orm import relationship

from database.db import Base


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String(255), unique=True, index=True, nullable=False)
    name = Column(String(255), nullable=False, default="")
    password_hash = Column(String(255), nullable=False)
    role = Column(String(255), nullable=False, default="")
    institution = Column(String(255), nullable=False, default="")
    department = Column(String(255), nullable=False, default="")
    bio = Column(Text, nullable=False, default="")
    created_at = Column(Float, nullable=False, default=time.time)

    interests = relationship("ResearchInterest", back_populates="user", cascade="all, delete-orphan")
    saved_designs = relationship("SavedDesign", back_populates="user", cascade="all, delete-orphan")
    favorites = relationship("FavoriteGene", back_populates="user", cascade="all, delete-orphan")
    activity = relationship("RecentActivity", back_populates="user", cascade="all, delete-orphan")


class ResearchInterest(Base):
    __tablename__ = "research_interests"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    topic = Column(String(255), nullable=False)
    description = Column(Text, nullable=False, default="")

    user = relationship("User", back_populates="interests")


class SavedDesign(Base):
    __tablename__ = "saved_designs"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    name = Column(String(255), nullable=False)
    gene_symbol = Column(String(100), nullable=False, default="")
    ensembl_id = Column(String(100), nullable=False, default="")
    disease = Column(String(255), nullable=False, default="")
    sequence = Column(Text, nullable=False, default="")
    notes = Column(Text, nullable=False, default="")
    created_at = Column(Float, nullable=False, default=time.time)

    user = relationship("User", back_populates="saved_designs")


class FavoriteGene(Base):
    __tablename__ = "favorite_genes"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    gene_symbol = Column(String(100), nullable=False)
    ensembl_id = Column(String(100), nullable=False, default="")
    note = Column(Text, nullable=False, default="")
    created_at = Column(Float, nullable=False, default=time.time)

    user = relationship("User", back_populates="favorites")


class RecentActivity(Base):
    __tablename__ = "recent_activity"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    action = Column(String(255), nullable=False)
    detail = Column(Text, nullable=False, default="")
    timestamp = Column(Float, nullable=False, default=time.time)

    user = relationship("User", back_populates="activity")
