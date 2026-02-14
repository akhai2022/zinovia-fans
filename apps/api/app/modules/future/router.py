from __future__ import annotations

from fastapi import APIRouter

from app.core.errors import AppError
from app.core.settings import get_settings

router = APIRouter(prefix="/future", tags=["future"])


def _feature_guard(enabled: bool) -> None:
    if not enabled:
        raise AppError(status_code=404, detail="feature_disabled")


@router.get("/promotions/schema")
async def promotions_schema() -> dict:
    _feature_guard(get_settings().enable_promotions)
    return {
        "feature": "promotions",
        "status": "scaffold",
        "fields": ["creator_id", "percent_off", "duration_months", "active", "starts_at", "ends_at"],
    }


@router.get("/broadcast/schema")
async def broadcast_schema() -> dict:
    _feature_guard(get_settings().enable_dm_broadcast)
    return {
        "feature": "broadcast",
        "status": "scaffold",
        "fields": ["creator_id", "filters", "body", "batch_size"],
    }


@router.get("/ppv-posts/schema")
async def ppv_posts_schema() -> dict:
    _feature_guard(get_settings().enable_ppv_posts)
    return {"feature": "ppv_posts", "status": "scaffold", "fields": ["post_id", "price_cents", "currency"]}


@router.get("/moderation/schema")
async def moderation_schema() -> dict:
    _feature_guard(get_settings().enable_moderation)
    return {
        "feature": "moderation",
        "status": "scaffold",
        "fields": ["report_id", "target_type", "target_id", "reason"],
    }


@router.get("/analytics/schema")
async def analytics_schema() -> dict:
    _feature_guard(get_settings().enable_analytics)
    return {
        "feature": "analytics",
        "status": "scaffold",
        "kpis": ["subs", "churn", "revenue", "top_posts", "top_fans"],
    }

