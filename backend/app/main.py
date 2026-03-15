from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app import models  # noqa: F401
from app.api.router import api_router
from app.core.config import get_settings
from app.db.base import Base
from app.db.bootstrap import run_sqlite_compat_migrations
from app.db.session import engine


def _uploads_dir() -> Path:
    return Path(get_settings().uploads_dir)


@asynccontextmanager
async def lifespan(_: FastAPI):
    Base.metadata.create_all(bind=engine)
    run_sqlite_compat_migrations(get_settings().database_url)
    _uploads_dir().mkdir(parents=True, exist_ok=True)
    yield


def create_app() -> FastAPI:
    settings = get_settings()
    app = FastAPI(title=settings.app_name, lifespan=lifespan)
    _uploads_dir().mkdir(parents=True, exist_ok=True)

    allow_origins = [
        "http://127.0.0.1:5501",
        "http://localhost:5501",
        "http://127.0.0.1:5173",
        "http://localhost:5173",
        "http://127.0.0.1:4173",
        "http://localhost:4173",
    ]
    if settings.frontend_origin:
        allow_origins.append(settings.frontend_origin.rstrip("/"))

    app.add_middleware(
        CORSMiddleware,
        allow_origins=allow_origins,
        allow_origin_regex=r"^https?://(localhost|127\.0\.0\.1)(:\d+)?$",
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
        expose_headers=["*"],
    )

    app.include_router(api_router)
    app.mount("/uploads", StaticFiles(directory=str(_uploads_dir())), name="uploads")
    return app


app = create_app()
