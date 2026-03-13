from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.db.session import get_db
from app.models import Problem, ProblemSource, Solution, Source, Tag
from app.schemas import (
    ProblemCreate,
    ProblemRead,
    ProblemUpdate,
    SolutionCreate,
    SolutionRead,
)

router = APIRouter(prefix="/problems", tags=["problems"])


def _problem_query():
    return select(Problem).options(
        selectinload(Problem.tags),
        selectinload(Problem.sources).selectinload(ProblemSource.source),
        selectinload(Problem.solutions),
    )


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


def _resolve_sources(source_links: list, db: Session) -> list[ProblemSource]:
    resolved_links: list[ProblemSource] = []
    for item in source_links:
        source = db.get(Source, item.source_id)
        if source is None:
            raise HTTPException(
                status_code=404, detail=f"Source {item.source_id} was not found"
            )
        resolved_links.append(
            ProblemSource(source=source, note=item.note, is_primary=item.is_primary)
        )
    return resolved_links


@router.get("", response_model=list[ProblemRead])
def list_problems(db: Session = Depends(get_db)) -> list[Problem]:
    problems = db.scalars(_problem_query().order_by(Problem.created_at.desc())).unique()
    return list(problems)


@router.post("", response_model=ProblemRead, status_code=status.HTTP_201_CREATED)
def create_problem(payload: ProblemCreate, db: Session = Depends(get_db)) -> Problem:
    problem = Problem(
        statement_text=payload.statement_text,
        statement_latex=payload.statement_latex,
        notes=payload.notes,
        moderation_status=payload.moderation_status,
    )
    problem.tags = _resolve_tags(payload.tag_ids, db)
    problem.sources = _resolve_sources(payload.sources, db)
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

    db.commit()
    return _get_problem_or_404(problem_id, db)


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
        moderation_status=payload.moderation_status,
    )
    db.add(solution)
    db.commit()
    db.refresh(solution)
    return solution
