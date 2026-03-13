from fastapi import APIRouter

from app.api.routes.health import router as health_router
from app.api.routes.problems import router as problems_router
from app.api.routes.sources import router as sources_router
from app.api.routes.tags import router as tags_router

api_router = APIRouter()
api_router.include_router(health_router)
api_router.include_router(tags_router)
api_router.include_router(sources_router)
api_router.include_router(problems_router)
