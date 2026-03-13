from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field

from app.models import ModerationStatus


class BaseSchema(BaseModel):
    model_config = ConfigDict(from_attributes=True)


class TagCreate(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    description: str | None = None


class TagRead(BaseSchema):
    id: int
    name: str
    description: str | None
    created_at: datetime
    updated_at: datetime


class SourceCreate(BaseModel):
    title: str = Field(min_length=1, max_length=255)
    author: str | None = Field(default=None, max_length=255)
    year: int | None = Field(default=None, ge=0, le=3000)
    notes: str | None = None


class SourceRead(BaseSchema):
    id: int
    title: str
    author: str | None
    year: int | None
    notes: str | None
    created_at: datetime
    updated_at: datetime


class ProblemSourceLinkCreate(BaseModel):
    source_id: int
    note: str | None = None
    is_primary: bool = False


class ProblemSourceLinkRead(BaseSchema):
    note: str | None
    is_primary: bool
    source: SourceRead


class SolutionCreate(BaseModel):
    body_text: str = Field(min_length=1)
    body_latex: str | None = None
    notes: str | None = None
    moderation_status: ModerationStatus = ModerationStatus.PENDING


class SolutionRead(BaseSchema):
    id: int
    body_text: str
    body_latex: str | None
    notes: str | None
    moderation_status: ModerationStatus
    created_at: datetime
    updated_at: datetime


class ProblemCreate(BaseModel):
    statement_text: str = Field(min_length=1)
    statement_latex: str | None = None
    notes: str | None = None
    moderation_status: ModerationStatus = ModerationStatus.PENDING
    tag_ids: list[int] = Field(default_factory=list)
    sources: list[ProblemSourceLinkCreate] = Field(default_factory=list)


class ProblemUpdate(BaseModel):
    statement_text: str | None = Field(default=None, min_length=1)
    statement_latex: str | None = None
    notes: str | None = None
    moderation_status: ModerationStatus | None = None
    tag_ids: list[int] | None = None
    sources: list[ProblemSourceLinkCreate] | None = None


class ProblemRead(BaseSchema):
    id: int
    statement_text: str
    statement_latex: str | None
    notes: str | None
    moderation_status: ModerationStatus
    created_at: datetime
    updated_at: datetime
    tags: list[TagRead]
    sources: list[ProblemSourceLinkRead]
    solutions: list[SolutionRead]

