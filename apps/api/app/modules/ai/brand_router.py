"""Public brand assets API (landing hero, etc.)."""

from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_async_session
from app.modules.ai.schemas import BrandAssetsOut
from app.modules.ai.service import get_brand_assets_urls

router = APIRouter()


@router.get("", response_model=BrandAssetsOut, operation_id="brand_assets_get")
async def get_assets(
    session: AsyncSession = Depends(get_async_session),
) -> BrandAssetsOut:
    """Public: presigned URLs for brand assets (e.g. landing hero). No auth required."""
    urls = await get_brand_assets_urls(session)
    return BrandAssetsOut(
        landing_hero=urls.get("landing.hero"),
    )
