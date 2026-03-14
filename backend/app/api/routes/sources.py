from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.models import Source
from app.schemas import SourceCreate, SourceRead

router = APIRouter(prefix="/sources", tags=["sources"])


@router.get("", response_model=list[SourceRead])
def list_sources(db: Session = Depends(get_db)) -> list[Source]:
    return list(db.scalars(select(Source).order_by(Source.title)).all())


@router.post("", response_model=SourceRead, status_code=status.HTTP_201_CREATED)
def create_source(payload: SourceCreate, db: Session = Depends(get_db)) -> Source:
    title = payload.title.strip()
    if not title:
        raise HTTPException(status_code=400, detail="Source title cannot be empty")
    source = Source(
        title=payload.title,
        author=payload.author,
        year=payload.year,
        notes=payload.notes,
    )
    db.add(source)
    db.commit()
    db.refresh(source)
    return source
