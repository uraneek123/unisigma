from pathlib import Path
from uuid import uuid4

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, status
from sqlalchemy import func, select
from sqlalchemy.orm import Session, selectinload

from app.core.config import get_settings
from app.db.session import get_db
from app.models import Problem, ProblemDiagram, ProblemSource, Solution, Source, Tag
from app.schemas import (
    DiagramUploadResponse,
    OcrLatexResponse,
    ProblemCreate,
    ProblemModerationUpdate,
    ProblemRead,
    ProblemSourceLinkCreate,
    ProblemUpdate,
    SolutionCreate,
    SolutionRead,
    SourceCreate,
)
from app.services.pix2text_ocr import extract_latex_from_image

router = APIRouter(prefix="/problems", tags=["problems"])
DIAGRAMS_DIR = Path("uploads") / "diagrams"
OCR_ALLOWED_IMAGE_CONTENT_TYPES = {
    "image/png",
    "image/jpeg",
    "image/jpg",
    "image/webp",
}
OCR_ENGINE_VALUES = {"default", "local", "cloud"}
OCR_SERVER_TYPE_VALUES = {"pro", "plus", "ultra"}


def _problem_query():
    return select(Problem).options(
        selectinload(Problem.tags),
        selectinload(Problem.sources).selectinload(ProblemSource.source),
        selectinload(Problem.solutions),
        selectinload(Problem.diagrams),
    )


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
def create_problem(payload: ProblemCreate, db: Session = Depends(get_db)) -> Problem:
    existing_problem = db.scalar(
        _problem_query().where(
            func.lower(Problem.statement_text) == payload.statement_text.casefold()
        )
    )
    if existing_problem is not None:
        return _attach_to_existing_problem(existing_problem, payload, db)

    statement_latex = payload.statement_latex
    if statement_latex is None and payload.auto_generate_latex:
        statement_latex = _auto_generate_latex(payload.statement_text)

    problem = Problem(
        statement_text=payload.statement_text,
        statement_latex=statement_latex,
        notes=payload.notes,
        submitted_by=payload.submitted_by,
        moderation_status=payload.moderation_status,
    )
    problem.tags = _resolve_tags(
        payload.tag_ids,
        db,
    ) + _resolve_or_create_suggested_tags(payload.suggested_tag_names, db)
    problem.sources = _resolve_sources(
        payload.sources,
        db,
    ) + _resolve_or_create_suggested_sources(payload.suggested_sources, db)
    _reconcile_primary_source(problem.sources)
    db.add(problem)
    db.commit()
    return _get_problem_or_404(problem.id, db)


@router.get("/{problem_id}", response_model=ProblemRead)
def get_problem(problem_id: int, db: Session = Depends(get_db)) -> Problem:
    return _get_problem_or_404(problem_id, db)


@router.patch("/{problem_id}", response_model=ProblemRead)
def update_problem(
    problem_id: int, payload: ProblemUpdate, db: Session = Depends(get_db)
) -> Problem:
    problem = _get_problem_or_404(problem_id, db)
    updates = payload.model_dump(exclude_unset=True)

    for field in ("statement_text", "statement_latex", "notes", "moderation_status"):
        if field in updates:
            setattr(problem, field, updates[field])

    if payload.tag_ids is not None:
        problem.tags = _resolve_tags(payload.tag_ids, db)

    if payload.sources is not None:
        problem.sources.clear()
        problem.sources.extend(_resolve_sources(payload.sources, db))
        _reconcile_primary_source(problem.sources)

    db.commit()
    return _get_problem_or_404(problem_id, db)


@router.patch("/{problem_id}/moderation", response_model=ProblemRead)
def moderate_problem(
    problem_id: int,
    payload: ProblemModerationUpdate,
    db: Session = Depends(get_db),
) -> Problem:
    problem = _get_problem_or_404(problem_id, db)
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
    "/ocr-latex",
    response_model=OcrLatexResponse,
)
async def extract_problem_latex(
    file: UploadFile = File(...),
    ocr_mode: str = Form(default="auto"),
    ocr_engine: str = Form(default="default"),
    ocr_server_type: str | None = Form(default=None),
    ocr_language: str | None = Form(default=None),
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

    return OcrLatexResponse(
        latex=result.latex,
        markdown=result.markdown,
        mode_used=result.mode_used,
        strategy=result.strategy,
    )


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
        image_path=diagram_path.as_posix(),
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
