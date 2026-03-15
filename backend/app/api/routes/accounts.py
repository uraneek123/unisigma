from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.models import Account, AccountRole
from app.schemas import AccountCreate, AccountRead, AccountUpdate, LoginRequest
from app.services.passwords import hash_password, verify_password

router = APIRouter(prefix="/accounts", tags=["accounts"])


def _normalize_username_lookup(username: str) -> str:
    return username.casefold()


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


def _require_admin(actor: Account) -> None:
    if actor.role != AccountRole.ADMIN:
        raise HTTPException(status_code=403, detail="Admin role is required")


def _find_account_by_username(username: str, db: Session) -> Account | None:
    return db.scalar(
        select(Account).where(
            func.lower(Account.username) == _normalize_username_lookup(username)
        )
    )


@router.post("/login", response_model=AccountRead)
def login(
    payload: LoginRequest,
    db: Session = Depends(get_db),
) -> Account:
    username = payload.username.strip()
    if not username:
        raise HTTPException(
            status_code=400,
            detail="username is required",
        )
    account = _find_account_by_username(username, db)
    if account is None:
        raise HTTPException(status_code=401, detail="Invalid username or password")
    if not account.is_active:
        raise HTTPException(status_code=401, detail="Account is inactive")
    if account.password_hash is None:
        raise HTTPException(status_code=401, detail="Invalid username or password")
    if not payload.password or not verify_password(
        payload.password, account.password_hash
    ):
        raise HTTPException(status_code=401, detail="Invalid username or password")
    return account


@router.post("", response_model=AccountRead, status_code=status.HTTP_201_CREATED)
def create_account(
    payload: AccountCreate,
    db: Session = Depends(get_db),
    actor_user_id: int | None = Query(default=None),
) -> Account:
    if _find_account_by_username(payload.username, db) is not None:
        raise HTTPException(status_code=409, detail="Account username already exists")

    account_count = db.scalar(select(func.count(Account.id))) or 0
    role = payload.role

    if account_count == 0:
        role = AccountRole.ADMIN
    elif role != AccountRole.USER:
        actor = _get_actor_or_401(actor_user_id, db)
        _require_admin(actor)

    account = Account(
        username=payload.username,
        role=role,
        password_hash=hash_password(payload.password) if payload.password else None,
    )
    db.add(account)
    try:
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(
            status_code=409, detail="Account username already exists"
        ) from exc
    db.refresh(account)
    return account


@router.get("", response_model=list[AccountRead])
def list_accounts(
    db: Session = Depends(get_db),
    actor_user_id: int | None = Query(default=None),
) -> list[Account]:
    actor = _get_actor_or_401(actor_user_id, db)
    _require_admin(actor)
    return list(db.scalars(select(Account).order_by(Account.username)).all())


@router.get("/{account_id}", response_model=AccountRead)
def get_account(
    account_id: int,
    db: Session = Depends(get_db),
    actor_user_id: int | None = Query(default=None),
) -> Account:
    actor = _get_actor_or_401(actor_user_id, db)
    account = db.get(Account, account_id)
    if account is None:
        raise HTTPException(status_code=404, detail="Account not found")
    if actor.role != AccountRole.ADMIN and actor.id != account.id:
        raise HTTPException(status_code=403, detail="Insufficient permissions")
    return account


@router.patch("/{account_id}", response_model=AccountRead)
def update_account(
    account_id: int,
    payload: AccountUpdate,
    db: Session = Depends(get_db),
    actor_user_id: int | None = Query(default=None),
) -> Account:
    actor = _get_actor_or_401(actor_user_id, db)
    _require_admin(actor)

    account = db.get(Account, account_id)
    if account is None:
        raise HTTPException(status_code=404, detail="Account not found")

    updates = payload.model_dump(exclude_unset=True)
    if "role" in updates:
        account.role = updates["role"]
    if "score" in updates:
        account.score = updates["score"]
    if "is_active" in updates:
        account.is_active = updates["is_active"]
    if "password" in updates:
        account.password_hash = (
            hash_password(updates["password"]) if updates["password"] else None
        )

    db.commit()
    db.refresh(account)
    return account
