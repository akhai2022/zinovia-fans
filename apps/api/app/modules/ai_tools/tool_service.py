"""Service functions for AI tool jobs and image refs."""

from __future__ import annotations

import secrets
import uuid
from datetime import datetime, timedelta, timezone
from uuid import UUID

from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.ai_tools.tool_models import AiImageRef, AiToolJob

IMAGE_REF_TTL_MINUTES = 10


async def create_tool_job(
    session: AsyncSession,
    user_id: UUID,
    tool: str,
    input_object_key: str,
    input_media_asset_id: UUID | None = None,
) -> AiToolJob:
    job = AiToolJob(
        id=uuid.uuid4(),
        user_id=user_id,
        tool=tool,
        status="pending",
        input_media_asset_id=input_media_asset_id,
        input_object_key=input_object_key,
    )
    session.add(job)
    await session.flush()
    return job


async def get_tool_job(
    session: AsyncSession, job_id: UUID, user_id: UUID
) -> AiToolJob | None:
    r = await session.execute(
        select(AiToolJob).where(
            AiToolJob.id == job_id,
            AiToolJob.user_id == user_id,
        )
    )
    return r.scalar_one_or_none()


async def update_tool_job_status(
    session: AsyncSession,
    job_id: UUID,
    status: str,
    result_object_key: str | None = None,
    error_message: str | None = None,
) -> None:
    await session.execute(
        update(AiToolJob)
        .where(AiToolJob.id == job_id)
        .values(
            status=status,
            result_object_key=result_object_key,
            error_message=error_message,
            updated_at=datetime.now(timezone.utc),
        )
    )


async def create_image_ref(
    session: AsyncSession, user_id: UUID, media_asset_id: UUID
) -> AiImageRef:
    ref = AiImageRef(
        id=uuid.uuid4(),
        token=secrets.token_urlsafe(32),
        user_id=user_id,
        media_asset_id=media_asset_id,
        expires_at=datetime.now(timezone.utc) + timedelta(minutes=IMAGE_REF_TTL_MINUTES),
    )
    session.add(ref)
    await session.flush()
    return ref


async def resolve_image_ref(
    session: AsyncSession, token: str, user_id: UUID
) -> AiImageRef | None:
    r = await session.execute(
        select(AiImageRef).where(
            AiImageRef.token == token,
            AiImageRef.user_id == user_id,
        )
    )
    return r.scalar_one_or_none()
