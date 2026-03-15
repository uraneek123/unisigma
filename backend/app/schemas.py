from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

from app.models import AccountRole, ModerationStatus


class BaseSchema(BaseModel):
    model_config = ConfigDict(from_attributes=True)


class AccountCreate(BaseModel):
    username: str = Field(min_length=1, max_length=120)
    password: str | None = Field(default=None, min_length=8, max_length=256)
    role: AccountRole = AccountRole.USER

    @field_validator("username")
    @classmethod
    def normalize_username(cls, value: str) -> str:
        normalized = value.strip()
        if not normalized:
            raise ValueError("username cannot be blank")
        return normalized

    @field_validator("password")
    @classmethod
    def normalize_password(cls, value: str | None) -> str | None:
        if value is None:
            return None
        normalized = value.strip()
        return normalized or None


class LoginRequest(BaseModel):
    username: str = Field(min_length=1, max_length=120)
    password: str = Field(min_length=1, max_length=256)


class AccountUpdate(BaseModel):
    role: AccountRole | None = None
    score: int | None = None
    is_active: bool | None = None
    password: str | None = Field(default=None, min_length=8, max_length=256)

    @field_validator("password")
    @classmethod
    def normalize_password(cls, value: str | None) -> str | None:
        if value is None:
            return None
        normalized = value.strip()
        return normalized or None


class AccountRead(BaseSchema):
    id: int
    username: str
    role: AccountRole
    questions_posted: int
    score: int
    is_active: bool
    created_at: datetime
    updated_at: datetime


class TagCreate(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    description: str | None = None

    @field_validator("name")
    @classmethod
    def normalize_name(cls, value: str) -> str:
        normalized = value.strip()
        if not normalized:
            raise ValueError("name cannot be blank")
        return normalized

    @field_validator("description")
    @classmethod
    def normalize_description(cls, value: str | None) -> str | None:
        if value is None:
            return None
        normalized = value.strip()
        return normalized or None


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

    @field_validator("title")
    @classmethod
    def normalize_title(cls, value: str) -> str:
        normalized = value.strip()
        if not normalized:
            raise ValueError("title cannot be blank")
        return normalized

    @field_validator("author", "notes")
    @classmethod
    def normalize_optional_text(cls, value: str | None) -> str | None:
        if value is None:
            return None
        normalized = value.strip()
        return normalized or None


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

    @field_validator("note")
    @classmethod
    def normalize_note(cls, value: str | None) -> str | None:
        if value is None:
            return None
        normalized = value.strip()
        return normalized or None


class ProblemSourceLinkRead(BaseSchema):
    note: str | None
    is_primary: bool
    source: SourceRead


class ProblemDiagramRead(BaseSchema):
    id: int
    image_path: str
    caption: str | None
    created_at: datetime
    updated_at: datetime


class SolutionCreate(BaseModel):
    body_text: str = Field(min_length=1)
    body_latex: str | None = None
    notes: str | None = None
    submitted_by: str | None = Field(default=None, max_length=120)
    moderation_status: ModerationStatus = ModerationStatus.PENDING

    @field_validator("body_text")
    @classmethod
    def normalize_body_text(cls, value: str) -> str:
        normalized = value.strip()
        if not normalized:
            raise ValueError("body_text cannot be blank")
        return normalized

    @field_validator("body_latex", "notes")
    @classmethod
    def normalize_solution_optional_text(cls, value: str | None) -> str | None:
        if value is None:
            return None
        normalized = value.strip()
        return normalized or None

    @field_validator("submitted_by")
    @classmethod
    def normalize_solution_submitter(cls, value: str | None) -> str | None:
        if value is None:
            return None
        normalized = value.strip()
        return normalized or None


class SolutionRead(BaseSchema):
    id: int
    body_text: str
    body_latex: str | None
    notes: str | None
    submitted_by: str | None
    moderation_status: ModerationStatus
    created_at: datetime
    updated_at: datetime


class ProblemCreate(BaseModel):
    statement_text: str | None = Field(default=None, min_length=1)
    statement_latex: str | None = None
    content_markdown: str | None = None
    notes: str | None = None
    author_id: int | None = None
    submitted_by: str | None = Field(default=None, max_length=120)
    auto_generate_latex: bool = True
    suggested_tag_names: list[str] = Field(default_factory=list)
    suggested_sources: list[SourceCreate] = Field(default_factory=list)
    moderation_status: ModerationStatus = ModerationStatus.PENDING
    tag_ids: list[int] = Field(default_factory=list)
    sources: list[ProblemSourceLinkCreate] = Field(default_factory=list)

    @field_validator("statement_text")
    @classmethod
    def normalize_statement_text(cls, value: str | None) -> str | None:
        if value is None:
            return None
        normalized = value.strip()
        if not normalized:
            raise ValueError("statement_text cannot be blank")
        return normalized

    @field_validator("statement_latex", "content_markdown", "notes", "submitted_by")
    @classmethod
    def normalize_problem_optional_text(cls, value: str | None) -> str | None:
        if value is None:
            return None
        normalized = value.strip()
        return normalized or None

    @field_validator("suggested_tag_names")
    @classmethod
    def normalize_suggested_tag_names(cls, value: list[str]) -> list[str]:
        normalized = [item.strip() for item in value if item.strip()]
        if len(normalized) != len(set(name.casefold() for name in normalized)):
            raise ValueError("suggested_tag_names must be unique")
        return normalized

    @field_validator("tag_ids")
    @classmethod
    def ensure_unique_tag_ids(cls, value: list[int]) -> list[int]:
        if len(value) != len(set(value)):
            raise ValueError("tag_ids must be unique")
        return value

    @model_validator(mode="after")
    def validate_sources(self) -> "ProblemCreate":
        if not self.statement_text and not self.content_markdown:
            raise ValueError(
                "At least one of statement_text or content_markdown must be provided"
            )
        source_ids = [source.source_id for source in self.sources]
        if len(source_ids) != len(set(source_ids)):
            raise ValueError("sources must not contain duplicate source_id values")
        if sum(1 for source in self.sources if source.is_primary) > 1:
            raise ValueError("at most one source can be marked as primary")
        return self


class ProblemUpdate(BaseModel):
    statement_text: str | None = Field(default=None, min_length=1)
    statement_latex: str | None = None
    content_markdown: str | None = None
    notes: str | None = None
    moderation_status: ModerationStatus | None = None
    tag_ids: list[int] | None = None
    sources: list[ProblemSourceLinkCreate] | None = None

    @field_validator("statement_text")
    @classmethod
    def normalize_statement_text(cls, value: str | None) -> str | None:
        if value is None:
            return None
        normalized = value.strip()
        if not normalized:
            raise ValueError("statement_text cannot be blank")
        return normalized

    @field_validator("statement_latex", "content_markdown", "notes")
    @classmethod
    def normalize_problem_update_optional_text(cls, value: str | None) -> str | None:
        if value is None:
            return None
        normalized = value.strip()
        return normalized or None

    @field_validator("tag_ids")
    @classmethod
    def ensure_unique_tag_ids(cls, value: list[int] | None) -> list[int] | None:
        if value is None:
            return None
        if len(value) != len(set(value)):
            raise ValueError("tag_ids must be unique")
        return value

    @model_validator(mode="after")
    def validate_sources(self) -> "ProblemUpdate":
        if self.sources is None:
            return self
        source_ids = [source.source_id for source in self.sources]
        if len(source_ids) != len(set(source_ids)):
            raise ValueError("sources must not contain duplicate source_id values")
        if sum(1 for source in self.sources if source.is_primary) > 1:
            raise ValueError("at most one source can be marked as primary")
        return self


class ProblemRead(BaseSchema):
    id: int
    statement_text: str
    statement_latex: str | None
    content_markdown: str | None
    notes: str | None
    author: AccountRead | None
    submitted_by: str | None
    moderation_status: ModerationStatus
    created_at: datetime
    updated_at: datetime
    tags: list[TagRead]
    sources: list[ProblemSourceLinkRead]
    solutions: list[SolutionRead]
    diagrams: list[ProblemDiagramRead]


class ProblemModerationUpdate(BaseModel):
    moderation_status: ModerationStatus
    canonical_source_id: int | None = None


class DiagramUploadResponse(BaseModel):
    id: int
    image_path: str
    caption: str | None


class EditorAssetUploadResponse(BaseModel):
    image_path: str
    image_url: str
    markdown_image: str


class OcrLatexResponse(BaseModel):
    latex: str
    markdown: str | None = None
    mode_used: str
    strategy: str


class OcrTextResponse(BaseModel):
    text: str
    strategy: str
