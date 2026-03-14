import re
from pathlib import Path
from uuid import uuid4

from fastapi import (
    APIRouter,
    Depends,
    File,
    Form,
    HTTPException,
    Query,
    Request,
    UploadFile,
    status,
)
from sqlalchemy import func, select
from sqlalchemy.orm import Session, selectinload

from app.core.config import get_settings
from app.db.session import get_db
from app.models import (
    Account,
    AccountRole,
    Problem,
    ProblemDiagram,
    ProblemSource,
    Solution,
    Source,
    Tag,
)
from app.schemas import (
    DiagramUploadResponse,
    EditorAssetUploadResponse,
    OcrLatexResponse,
    OcrTextResponse,
    ProblemCreate,
    ProblemModerationUpdate,
    ProblemRead,
    ProblemSourceLinkCreate,
    ProblemUpdate,
    SolutionCreate,
    SolutionRead,
    SourceCreate,
)
from app.services.embedding_service import embedding_service
from app.services.pix2text_ocr import extract_latex_from_image
from app.services.similarity_service import find_similar
from app.services.text_ocr import extract_text_from_image

router = APIRouter(prefix="/problems", tags=["problems"])
DIAGRAMS_DIR = Path("uploads") / "diagrams"
EDITOR_ASSETS_DIR = Path("uploads") / "editor-assets"
OCR_ALLOWED_IMAGE_CONTENT_TYPES = {
    "image/png",
    "image/jpeg",
    "image/jpg",
    "image/webp",
}
OCR_ENGINE_VALUES = {"default", "local", "cloud"}
OCR_SERVER_TYPE_VALUES = {"pro", "plus", "ultra"}
TEXT_OCR_TOOL_VALUES = {"auto", "tesseract", "pix2text"}
ASSET_ALLOWED_IMAGE_CONTENT_TYPES = OCR_ALLOWED_IMAGE_CONTENT_TYPES | {"image/gif"}
ASSET_ALLOWED_EXTENSIONS = {".png", ".jpg", ".jpeg", ".webp", ".gif"}


def _problem_query():
    return select(Problem).options(
        selectinload(Problem.author),
        selectinload(Problem.tags),
        selectinload(Problem.sources).selectinload(ProblemSource.source),
        selectinload(Problem.solutions),
        selectinload(Problem.diagrams),
    )


def problem_to_text(problem: Problem) -> str:
    tags_str = ", ".join(tag.name for tag in problem.tags) if problem.tags else ""
    body = problem.content_markdown or ""
    notes = problem.notes or ""
    return (
        f"Title: {problem.statement_text}\n"
        f"Tags: {tags_str}\n"
        f"Description: {notes}\n"
        f"Body: {body}"
    )


def _derive_statement_text(content_markdown: str | None) -> str:
    if not content_markdown:
        return "Untitled problem"

    without_images = re.sub(r"!\[[^\]]*]\([^)]+\)", " ", content_markdown)
    without_markdown_links = re.sub(r"\[([^\]]+)]\([^)]+\)", r"\1", without_images)
    without_inline_code = re.sub(r"`([^`]+)`", r"\1", without_markdown_links)
    plain = re.sub(r"\s+", " ", without_inline_code).strip()
    if not plain:
        return "Untitled problem"
    return plain[:220]


def _to_public_upload_path(path: Path) -> str:
    normalized = path.as_posix().lstrip("./")
    return f"/{normalized}" if not normalized.startswith("/") else normalized


def _strip_wrapping_math_delimiters(latex: str) -> str:
    stripped = latex.strip()
    patterns = (
        (r"^\$\$(.*)\$\$$", re.DOTALL),
        (r"^\$(.*)\$$", re.DOTALL),
        (r"^\\\((.*)\\\)$", re.DOTALL),
        (r"^\\\[(.*)\\\]$", re.DOTALL),
    )
    for pattern, flags in patterns:
        match = re.match(pattern, stripped, flags=flags)
        if match:
            return match.group(1).strip()
    return stripped


def _auto_generate_latex(statement_text: str) -> str:
    # This keeps a safe text-mode fallback until a richer parser is added.
    escaped = (
        statement_text.replace("\\", r"\\textbackslash{}")
        .replace("{", r"\{")
        .replace("}", r"\}")
        .replace("%", r"\%")
        .replace("_", r"\_")
        .replace("#", r"\#")
        .replace("&", r"\&")
    )
    return rf"\text{{{escaped}}}"


def _get_problem_or_404(problem_id: int, db: Session) -> Problem:
    problem = db.scalar(_problem_query().where(Problem.id == problem_id))
    if problem is None:
        raise HTTPException(status_code=404, detail="Problem not found")
    return problem


def _get_account_or_404(account_id: int, db: Session) -> Account:
    account = db.get(Account, account_id)
    if account is None:
        raise HTTPException(status_code=404, detail="Account not found")
    return account


def _find_account_by_username(username: str, db: Session) -> Account | None:
    return db.scalar(
        select(Account).where(func.lower(Account.username) == username.casefold())
    )


def _resolve_problem_author(
    author_id: int | None,
    submitted_by: str | None,
    db: Session,
) -> Account | None:
    if author_id is not None:
        author = _get_account_or_404(author_id, db)
        if not author.is_active:
            raise HTTPException(status_code=403, detail="Author account is inactive")
        return author

    if submitted_by is None:
        return None

    existing = _find_account_by_username(submitted_by, db)
    if existing is not None:
        if not existing.is_active:
            raise HTTPException(status_code=403, detail="Author account is inactive")
        return existing

    author = Account(username=submitted_by, role=AccountRole.USER)
    db.add(author)
    db.flush()
    return author


def _get_actor_or_401(actor_user_id: int | None, db: Session) -> Account:
    if actor_user_id is None:
        raise HTTPException(
            status_code=401,
            detail="actor_user_id is required for this operation",
        )
    actor = db.get(Account, actor_user_id)
    if actor is None or not actor.is_active:
        raise HTTPException(status_code=401, detail="Invalid actor account")
    return actor


def _ensure_actor_can_set_author(actor: Account | None, author: Account | None) -> None:
    if actor is None or author is None:
        return
    if actor.role in {AccountRole.ADMIN, AccountRole.MODERATOR}:
        return
    if actor.id == author.id:
        return
    raise HTTPException(
        status_code=403,
        detail="Insufficient permissions to submit for another account",
    )


def _ensure_can_edit_problem(actor: Account, problem: Problem) -> None:
    if actor.role in {AccountRole.ADMIN, AccountRole.MODERATOR}:
        return
    if problem.author_id is not None and problem.author_id == actor.id:
        return
    raise HTTPException(status_code=403, detail="Insufficient permissions to edit")


def _ensure_can_moderate(actor: Account) -> None:
    if actor.role in {AccountRole.ADMIN, AccountRole.MODERATOR}:
        return
    raise HTTPException(status_code=403, detail="Moderator or admin role is required")


def _resolve_tags(tag_ids: list[int], db: Session) -> list[Tag]:
    if not tag_ids:
        return []
    tags = list(db.scalars(select(Tag).where(Tag.id.in_(tag_ids))).all())
    if len(tags) != len(set(tag_ids)):
        raise HTTPException(status_code=404, detail="One or more tags were not found")
    return tags


def _resolve_sources(
    source_links: list[ProblemSourceLinkCreate], db: Session
) -> list[ProblemSource]:
    if not source_links:
        return []

    source_ids = [item.source_id for item in source_links]
    sources = list(db.scalars(select(Source).where(Source.id.in_(source_ids))).all())
    sources_by_id = {source.id: source for source in sources}

    missing_source_ids = sorted(set(source_ids) - set(sources_by_id))
    if missing_source_ids:
        missing_list = ", ".join(str(source_id) for source_id in missing_source_ids)
        raise HTTPException(
            status_code=404,
            detail=f"Sources not found: {missing_list}",
        )

    return [
        ProblemSource(
            source=sources_by_id[item.source_id],
            note=item.note,
            is_primary=item.is_primary,
        )
        for item in source_links
    ]


def _resolve_or_create_suggested_tags(tag_names: list[str], db: Session) -> list[Tag]:
    if not tag_names:
        return []

    lookup = {name.casefold(): name for name in tag_names}
    existing_tags = list(
        db.scalars(select(Tag).where(func.lower(Tag.name).in_(list(lookup)))).all()
    )
    existing_names = {tag.name.casefold() for tag in existing_tags}

    for normalized_name in sorted(set(lookup) - existing_names):
        new_tag = Tag(name=lookup[normalized_name])
        db.add(new_tag)
        existing_tags.append(new_tag)

    return existing_tags


def _resolve_or_create_suggested_sources(
    suggested_sources: list[SourceCreate], db: Session
) -> list[ProblemSource]:
    if not suggested_sources:
        return []

    links: list[ProblemSource] = []
    for source_payload in suggested_sources:
        existing_source = db.scalar(
            select(Source).where(
                func.lower(Source.title) == source_payload.title.casefold()
            )
        )
        source = existing_source
        if source is None:
            source = Source(
                title=source_payload.title,
                author=source_payload.author,
                year=source_payload.year,
                notes=source_payload.notes,
            )
            db.add(source)

        links.append(ProblemSource(source=source, is_primary=False))

    return links


def _merge_unique_tags(*tag_groups: list[Tag]) -> list[Tag]:
    unique: list[Tag] = []
    seen_keys: set[str] = set()
    for group in tag_groups:
        for tag in group:
            key = (
                f"id:{tag.id}" if tag.id is not None else f"name:{tag.name.casefold()}"
            )
            if key in seen_keys:
                continue
            unique.append(tag)
            seen_keys.add(key)
    return unique


def _merge_unique_source_links(
    *source_groups: list[ProblemSource],
) -> list[ProblemSource]:
    unique: list[ProblemSource] = []
    seen_source_ids: set[int] = set()
    seen_titles: set[str] = set()

    for group in source_groups:
        for link in group:
            source_id = link.source.id
            source_title = link.source.title.casefold()
            if source_id is not None and source_id in seen_source_ids:
                continue
            if source_title in seen_titles:
                continue
            unique.append(link)
            if source_id is not None:
                seen_source_ids.add(source_id)
            seen_titles.add(source_title)
    return unique


def _reconcile_primary_source(links: list[ProblemSource]) -> None:
    if not links:
        return

    for link in links:
        link.is_primary = False

    ranked = sorted(
        links,
        key=lambda link: (
            link.source.year is None,
            9999 if link.source.year is None else link.source.year,
            link.source.id or 0,
        ),
    )
    ranked[0].is_primary = True


def _attach_to_existing_problem(
    existing_problem: Problem,
    payload: ProblemCreate,
    db: Session,
) -> Problem:
    existing_tag_ids = {tag.id for tag in existing_problem.tags}
    for tag in _resolve_tags(payload.tag_ids, db):
        if tag.id not in existing_tag_ids:
            existing_problem.tags.append(tag)
            existing_tag_ids.add(tag.id)

    for tag in _resolve_or_create_suggested_tags(payload.suggested_tag_names, db):
        if tag.id not in existing_tag_ids:
            existing_problem.tags.append(tag)
            existing_tag_ids.add(tag.id)

    existing_source_ids = {link.source_id for link in existing_problem.sources}
    for link in _resolve_sources(payload.sources, db):
        if link.source.id not in existing_source_ids:
            existing_problem.sources.append(link)
            existing_source_ids.add(link.source.id)

    for link in _resolve_or_create_suggested_sources(payload.suggested_sources, db):
        existing_titles = {
            existing_link.source.title.casefold()
            for existing_link in existing_problem.sources
        }
        if link.source.title.casefold() not in existing_titles:
            existing_problem.sources.append(link)

    _reconcile_primary_source(existing_problem.sources)
    db.commit()
    return _get_problem_or_404(existing_problem.id, db)


@router.get("", response_model=list[ProblemRead])
def list_problems(db: Session = Depends(get_db)) -> list[Problem]:
    problems = db.scalars(_problem_query().order_by(Problem.created_at.desc())).unique()
    return list(problems)


@router.post("", response_model=ProblemRead, status_code=status.HTTP_201_CREATED)
def create_problem(
    payload: ProblemCreate,
    db: Session = Depends(get_db),
    actor_user_id: int | None = Query(default=None),
) -> Problem:
    actor = _get_actor_or_401(actor_user_id, db) if actor_user_id is not None else None
    statement_text = payload.statement_text or _derive_statement_text(
        payload.content_markdown
    )

    existing_problem = None
    if payload.statement_text:
        existing_problem = db.scalar(
            _problem_query().where(
                func.lower(Problem.statement_text) == payload.statement_text.casefold()
            )
        )
    if existing_problem is not None:
        return _attach_to_existing_problem(existing_problem, payload, db)

    author = _resolve_problem_author(payload.author_id, payload.submitted_by, db)
    if author is None and actor is not None:
        author = actor
    _ensure_actor_can_set_author(actor, author)

    statement_latex = payload.statement_latex
    if (
        statement_latex is None
        and payload.auto_generate_latex
        and payload.statement_text
    ):
        statement_latex = _auto_generate_latex(statement_text)

    problem = Problem(
        statement_text=statement_text,
        statement_latex=statement_latex,
        content_markdown=payload.content_markdown,
        notes=payload.notes,
        author=author,
        submitted_by=author.username if author is not None else payload.submitted_by,
        moderation_status=payload.moderation_status,
    )
    problem.tags = _merge_unique_tags(
        _resolve_tags(payload.tag_ids, db),
        _resolve_or_create_suggested_tags(payload.suggested_tag_names, db),
    )
    problem.sources = _merge_unique_source_links(
        _resolve_sources(payload.sources, db),
        _resolve_or_create_suggested_sources(payload.suggested_sources, db),
    )
    _reconcile_primary_source(problem.sources)
    problem.embedding = embedding_service.embed_problem(problem_to_text(problem))
    if author is not None:
        author.questions_posted += 1
    db.add(problem)
    db.commit()
    return _get_problem_or_404(problem.id, db)


@router.get("/{problem_id}", response_model=ProblemRead)
def get_problem(problem_id: int, db: Session = Depends(get_db)) -> Problem:
    return _get_problem_or_404(problem_id, db)


@router.patch("/{problem_id}", response_model=ProblemRead)
def update_problem(
    problem_id: int,
    payload: ProblemUpdate,
    db: Session = Depends(get_db),
    actor_user_id: int | None = Query(default=None),
) -> Problem:
    problem = _get_problem_or_404(problem_id, db)
    actor = _get_actor_or_401(actor_user_id, db)
    _ensure_can_edit_problem(actor, problem)
    updates = payload.model_dump(exclude_unset=True)

    if "moderation_status" in updates and actor.role not in {
        AccountRole.ADMIN,
        AccountRole.MODERATOR,
    }:
        raise HTTPException(
            status_code=403,
            detail="Moderator or admin role is required to change moderation status",
        )

    for field in (
        "statement_text",
        "statement_latex",
        "content_markdown",
        "notes",
        "moderation_status",
    ):
        if field in updates:
            setattr(problem, field, updates[field])

    if (
        "content_markdown" in updates
        and "statement_text" not in updates
        and (not problem.statement_text or problem.statement_text == "Untitled problem")
    ):
        problem.statement_text = _derive_statement_text(problem.content_markdown)

    if payload.tag_ids is not None:
        problem.tags = _resolve_tags(payload.tag_ids, db)

    if payload.sources is not None:
        problem.sources.clear()
        problem.sources.extend(_resolve_sources(payload.sources, db))
        _reconcile_primary_source(problem.sources)

    problem.embedding = embedding_service.embed_problem(problem_to_text(problem))

    db.commit()
    return _get_problem_or_404(problem_id, db)


@router.patch("/{problem_id}/moderation", response_model=ProblemRead)
def moderate_problem(
    problem_id: int,
    payload: ProblemModerationUpdate,
    db: Session = Depends(get_db),
    actor_user_id: int | None = Query(default=None),
) -> Problem:
    problem = _get_problem_or_404(problem_id, db)
    actor = _get_actor_or_401(actor_user_id, db)
    _ensure_can_moderate(actor)
    problem.moderation_status = payload.moderation_status

    if payload.canonical_source_id is not None:
        target_source = db.get(Source, payload.canonical_source_id)
        if target_source is None:
            raise HTTPException(status_code=404, detail="Canonical source not found")

        existing_source_ids = {link.source_id for link in problem.sources}
        if target_source.id not in existing_source_ids:
            problem.sources.append(ProblemSource(source=target_source, is_primary=True))

        _reconcile_primary_source(problem.sources)
        for link in problem.sources:
            if link.source_id == target_source.id:
                link.is_primary = True
            elif link.source.year is not None and target_source.year is not None:
                if link.source.year > target_source.year:
                    link.is_primary = False

    db.commit()
    return _get_problem_or_404(problem_id, db)


@router.post(
    "/assets",
    response_model=EditorAssetUploadResponse,
    status_code=status.HTTP_201_CREATED,
)
async def upload_editor_asset(
    request: Request,
    file: UploadFile = File(...),
    alt_text: str | None = Form(default=None),
) -> EditorAssetUploadResponse:
    content_type = (file.content_type or "").lower()
    file_name = (file.filename or "").lower()
    if content_type not in ASSET_ALLOWED_IMAGE_CONTENT_TYPES and not file_name.endswith(
        tuple(ASSET_ALLOWED_EXTENSIONS)
    ):
        raise HTTPException(
            status_code=400,
            detail="Only PNG/JPG/JPEG/WEBP/GIF snippet images are supported",
        )

    extension = Path(file_name).suffix.lower()
    if extension not in ASSET_ALLOWED_EXTENSIONS:
        extension = {
            "image/png": ".png",
            "image/jpeg": ".jpg",
            "image/jpg": ".jpg",
            "image/webp": ".webp",
            "image/gif": ".gif",
        }.get(content_type, ".png")

    payload = await file.read()
    if not payload:
        raise HTTPException(status_code=400, detail="Uploaded image is empty")

    EDITOR_ASSETS_DIR.mkdir(parents=True, exist_ok=True)
    asset_path = EDITOR_ASSETS_DIR / f"{uuid4().hex}{extension}"
    asset_path.write_bytes(payload)

    public_path = _to_public_upload_path(asset_path)
    image_url = f"{str(request.base_url).rstrip('/')}{public_path}"
    normalized_alt = alt_text.strip() if alt_text and alt_text.strip() else "snippet"
    return EditorAssetUploadResponse(
        image_path=public_path,
        image_url=image_url,
        markdown_image=f"![{normalized_alt}]({image_url})",
    )


@router.post(
    "/ocr-latex",
    response_model=OcrLatexResponse,
)
async def extract_problem_latex(
    file: UploadFile = File(...),
    ocr_mode: str = Form(default="auto"),
    ocr_engine: str = Form(default="default"),
    ocr_server_type: str | None = Form(default=None),
    ocr_language: str | None = Form(default=None),
    strip_math_delimiters: bool = Form(default=False),
) -> OcrLatexResponse:
    requested_engine = ocr_engine.strip().lower()
    if requested_engine not in OCR_ENGINE_VALUES:
        raise HTTPException(
            status_code=400,
            detail="ocr_engine must be one of: default, local, cloud",
        )

    content_type = (file.content_type or "").lower()
    file_name = (file.filename or "image").lower()
    is_pdf = content_type == "application/pdf" or file_name.endswith(".pdf")
    is_supported_image = (
        content_type in OCR_ALLOWED_IMAGE_CONTENT_TYPES
        or file_name.endswith((".png", ".jpg", ".jpeg", ".webp"))
    )
    if not is_supported_image and not is_pdf:
        raise HTTPException(
            status_code=400,
            detail=(
                "Only PNG/JPG/JPEG/WEBP images are supported (PDF requires cloud OCR)."
            ),
        )
    if is_pdf and requested_engine not in {"cloud", "default"}:
        raise HTTPException(
            status_code=400,
            detail="PDF OCR requires ocr_engine=cloud (or default mapped to cloud).",
        )

    image_bytes = await file.read()
    if not image_bytes:
        raise HTTPException(status_code=400, detail="Uploaded image is empty")

    requested_mode = ocr_mode.strip().lower()
    if requested_mode not in {"auto", "formula", "text_formula", "page"}:
        raise HTTPException(
            status_code=400,
            detail="ocr_mode must be one of: auto, formula, text_formula, page",
        )

    requested_server_type: str | None = None
    if ocr_server_type is not None and ocr_server_type.strip():
        requested_server_type = ocr_server_type.strip().lower()
        if requested_server_type not in OCR_SERVER_TYPE_VALUES:
            raise HTTPException(
                status_code=400,
                detail="ocr_server_type must be one of: pro, plus, ultra",
            )

    settings = get_settings()
    effective_engine = (
        settings.pix2text_provider
        if requested_engine == "default"
        else requested_engine
    )
    if is_pdf and effective_engine != "cloud":
        raise HTTPException(
            status_code=400,
            detail=(
                "PDF OCR requires cloud engine. "
                "Set ocr_engine=cloud or PIX2TEXT_PROVIDER=cloud."
            ),
        )

    effective_server_type = (
        settings.pix2text_cloud_server_type
        if requested_server_type is None
        else requested_server_type
    )
    if is_pdf and effective_server_type != "ultra":
        raise HTTPException(
            status_code=400,
            detail="PDF OCR requires server_type=ultra.",
        )

    try:
        result = await extract_latex_from_image(
            image_bytes=image_bytes,
            filename=file.filename or "image.png",
            settings=settings,
            mode_override=requested_mode,
            ocr_engine_override=requested_engine,
            ocr_server_type_override=requested_server_type,
            ocr_language_override=ocr_language.strip() if ocr_language else None,
        )
    except RuntimeError as exc:
        detail = str(exc)
        status_code = 503
        if "(401)" in detail:
            status_code = 401
        elif "(403)" in detail:
            status_code = 403
        elif "(400)" in detail:
            status_code = 400
        raise HTTPException(status_code=status_code, detail=detail) from exc
    except Exception as exc:
        raise HTTPException(
            status_code=502,
            detail=f"OCR failed: {exc}",
        ) from exc

    latex = result.latex
    if strip_math_delimiters and result.mode_used in {"formula", "text_formula"}:
        latex = _strip_wrapping_math_delimiters(latex)

    return OcrLatexResponse(
        latex=latex,
        markdown=result.markdown,
        mode_used=result.mode_used,
        strategy=result.strategy,
    )


@router.post(
    "/ocr-text",
    response_model=OcrTextResponse,
)
async def extract_problem_text(
    file: UploadFile = File(...),
    ocr_engine: str = Form(default="default"),
    ocr_server_type: str | None = Form(default=None),
    ocr_language: str | None = Form(default=None),
    text_tool: str = Form(default="auto"),
    strip_cjk: bool = Form(default=False),
) -> OcrTextResponse:
    requested_engine = ocr_engine.strip().lower()
    if requested_engine not in OCR_ENGINE_VALUES:
        raise HTTPException(
            status_code=400,
            detail="ocr_engine must be one of: default, local, cloud",
        )

    requested_tool = text_tool.strip().lower()
    if requested_tool not in TEXT_OCR_TOOL_VALUES:
        raise HTTPException(
            status_code=400,
            detail="text_tool must be one of: auto, tesseract, pix2text",
        )

    content_type = (file.content_type or "").lower()
    file_name = (file.filename or "image").lower()
    is_pdf = content_type == "application/pdf" or file_name.endswith(".pdf")
    is_supported_image = (
        content_type in OCR_ALLOWED_IMAGE_CONTENT_TYPES
        or file_name.endswith((".png", ".jpg", ".jpeg", ".webp"))
    )
    if not is_supported_image and not is_pdf:
        raise HTTPException(
            status_code=400,
            detail=(
                "Only PNG/JPG/JPEG/WEBP images are supported "
                "(PDF requires cloud OCR via pix2text)."
            ),
        )
    if is_pdf and requested_tool == "tesseract":
        raise HTTPException(
            status_code=400,
            detail="PDF OCR is not supported with text_tool=tesseract.",
        )
    if is_pdf and requested_engine not in {"cloud", "default"}:
        raise HTTPException(
            status_code=400,
            detail="PDF OCR requires ocr_engine=cloud (or default mapped to cloud).",
        )

    requested_server_type: str | None = None
    if ocr_server_type is not None and ocr_server_type.strip():
        requested_server_type = ocr_server_type.strip().lower()
        if requested_server_type not in OCR_SERVER_TYPE_VALUES:
            raise HTTPException(
                status_code=400,
                detail="ocr_server_type must be one of: pro, plus, ultra",
            )

    settings = get_settings()
    effective_engine = (
        settings.pix2text_provider
        if requested_engine == "default"
        else requested_engine
    )
    if is_pdf and effective_engine != "cloud":
        raise HTTPException(
            status_code=400,
            detail=(
                "PDF OCR requires cloud engine. "
                "Set ocr_engine=cloud or PIX2TEXT_PROVIDER=cloud."
            ),
        )

    effective_server_type = (
        settings.pix2text_cloud_server_type
        if requested_server_type is None
        else requested_server_type
    )
    if is_pdf and effective_server_type != "ultra":
        raise HTTPException(
            status_code=400,
            detail="PDF OCR requires server_type=ultra.",
        )

    image_bytes = await file.read()
    if not image_bytes:
        raise HTTPException(status_code=400, detail="Uploaded image is empty")

    try:
        result = await extract_text_from_image(
            image_bytes=image_bytes,
            filename=file.filename or "image.png",
            settings=settings,
            text_tool_override=requested_tool,
            ocr_engine_override=requested_engine,
            ocr_server_type_override=requested_server_type,
            ocr_language_override=ocr_language.strip() if ocr_language else None,
            strip_cjk=strip_cjk,
        )
    except RuntimeError as exc:
        detail = str(exc)
        status_code = 503
        if "(401)" in detail:
            status_code = 401
        elif "(403)" in detail:
            status_code = 403
        elif "(400)" in detail:
            status_code = 400
        raise HTTPException(status_code=status_code, detail=detail) from exc
    except Exception as exc:
        raise HTTPException(
            status_code=502,
            detail=f"Text OCR failed: {exc}",
        ) from exc

    return OcrTextResponse(text=result.text, strategy=result.strategy)


@router.post(
    "/{problem_id}/diagrams",
    response_model=DiagramUploadResponse,
    status_code=status.HTTP_201_CREATED,
)
async def upload_problem_diagram(
    problem_id: int,
    file: UploadFile = File(...),
    caption: str | None = Form(default=None),
    db: Session = Depends(get_db),
) -> DiagramUploadResponse:
    problem = _get_problem_or_404(problem_id, db)
    content_type = (file.content_type or "").lower()
    file_name = (file.filename or "").lower()
    if content_type != "image/png" and not file_name.endswith(".png"):
        raise HTTPException(status_code=400, detail="Only PNG diagrams are supported")

    DIAGRAMS_DIR.mkdir(parents=True, exist_ok=True)
    diagram_name = f"{uuid4().hex}.png"
    diagram_path = DIAGRAMS_DIR / diagram_name

    contents = await file.read()
    if not contents:
        raise HTTPException(status_code=400, detail="Uploaded file is empty")

    diagram_path.write_bytes(contents)

    diagram = ProblemDiagram(
        problem=problem,
        image_path=_to_public_upload_path(diagram_path),
        caption=caption.strip() if caption else None,
    )
    db.add(diagram)
    db.commit()
    db.refresh(diagram)
    return DiagramUploadResponse.model_validate(diagram, from_attributes=True)


@router.post(
    "/{problem_id}/solutions",
    response_model=SolutionRead,
    status_code=status.HTTP_201_CREATED,
)
def create_solution(
    problem_id: int, payload: SolutionCreate, db: Session = Depends(get_db)
) -> Solution:
    problem = _get_problem_or_404(problem_id, db)
    solution = Solution(
        problem=problem,
        body_text=payload.body_text,
        body_latex=payload.body_latex,
        notes=payload.notes,
        submitted_by=payload.submitted_by,
        moderation_status=payload.moderation_status,
    )
    db.add(solution)
    db.commit()
    db.refresh(solution)
    return solution


@router.get("/{problem_id}/similar", response_model=list[ProblemRead])
def get_similar_problems(
    problem_id: int, db: Session = Depends(get_db)
) -> list[Problem]:
    problem = _get_problem_or_404(problem_id, db)
    all_problems = db.scalars(_problem_query()).all()
    similar = find_similar(problem, all_problems, k=5)
    return similar
