from __future__ import annotations

from datetime import datetime
from enum import StrEnum

from sqlalchemy import DateTime, Enum, ForeignKey, String, Text, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class ModerationStatus(StrEnum):
    PENDING = "pending"
    APPROVED = "approved"
    REJECTED = "rejected"


class TimestampMixin:
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )


class ProblemTag(Base):
    __tablename__ = "problem_tags"

    problem_id: Mapped[int] = mapped_column(ForeignKey("problems.id"), primary_key=True)
    tag_id: Mapped[int] = mapped_column(ForeignKey("tags.id"), primary_key=True)


class ProblemSource(Base):
    __tablename__ = "problem_sources"

    problem_id: Mapped[int] = mapped_column(ForeignKey("problems.id"), primary_key=True)
    source_id: Mapped[int] = mapped_column(ForeignKey("sources.id"), primary_key=True)
    note: Mapped[str | None] = mapped_column(Text, default=None)
    is_primary: Mapped[bool] = mapped_column(default=False)

    problem: Mapped["Problem"] = relationship(back_populates="sources")
    source: Mapped["Source"] = relationship(back_populates="problems")


class Problem(Base, TimestampMixin):
    __tablename__ = "problems"

    id: Mapped[int] = mapped_column(primary_key=True)
    statement_text: Mapped[str] = mapped_column(Text)
    statement_latex: Mapped[str | None] = mapped_column(Text, default=None)
    notes: Mapped[str | None] = mapped_column(Text, default=None)
    submitted_by: Mapped[str | None] = mapped_column(String(120), default=None)
    moderation_status: Mapped[ModerationStatus] = mapped_column(
        Enum(ModerationStatus, native_enum=False), default=ModerationStatus.PENDING
    )

    tags: Mapped[list["Tag"]] = relationship(
        secondary="problem_tags", back_populates="problems"
    )
    sources: Mapped[list[ProblemSource]] = relationship(
        back_populates="problem", cascade="all, delete-orphan"
    )
    solutions: Mapped[list["Solution"]] = relationship(
        back_populates="problem", cascade="all, delete-orphan"
    )
    diagrams: Mapped[list["ProblemDiagram"]] = relationship(
        back_populates="problem", cascade="all, delete-orphan"
    )


class Tag(Base, TimestampMixin):
    __tablename__ = "tags"
    __table_args__ = (UniqueConstraint("name", name="uq_tags_name"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(100))
    description: Mapped[str | None] = mapped_column(Text, default=None)

    problems: Mapped[list[Problem]] = relationship(
        secondary="problem_tags", back_populates="tags"
    )


class Source(Base, TimestampMixin):
    __tablename__ = "sources"

    id: Mapped[int] = mapped_column(primary_key=True)
    title: Mapped[str] = mapped_column(String(255))
    author: Mapped[str | None] = mapped_column(String(255), default=None)
    year: Mapped[int | None] = mapped_column(default=None)
    notes: Mapped[str | None] = mapped_column(Text, default=None)

    problems: Mapped[list[ProblemSource]] = relationship(
        back_populates="source", cascade="all, delete-orphan"
    )


class Solution(Base, TimestampMixin):
    __tablename__ = "solutions"

    id: Mapped[int] = mapped_column(primary_key=True)
    problem_id: Mapped[int] = mapped_column(ForeignKey("problems.id"))
    body_text: Mapped[str] = mapped_column(Text)
    body_latex: Mapped[str | None] = mapped_column(Text, default=None)
    notes: Mapped[str | None] = mapped_column(Text, default=None)
    submitted_by: Mapped[str | None] = mapped_column(String(120), default=None)
    moderation_status: Mapped[ModerationStatus] = mapped_column(
        Enum(ModerationStatus, native_enum=False), default=ModerationStatus.PENDING
    )

    problem: Mapped[Problem] = relationship(back_populates="solutions")


class ProblemDiagram(Base, TimestampMixin):
    __tablename__ = "problem_diagrams"

    id: Mapped[int] = mapped_column(primary_key=True)
    problem_id: Mapped[int] = mapped_column(ForeignKey("problems.id"))
    image_path: Mapped[str] = mapped_column(String(500))
    caption: Mapped[str | None] = mapped_column(String(255), default=None)

    problem: Mapped[Problem] = relationship(back_populates="diagrams")

