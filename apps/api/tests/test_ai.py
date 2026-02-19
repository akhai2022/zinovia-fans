"""AI image generation and apply endpoint tests."""

from __future__ import annotations

import uuid

import pytest
from httpx import AsyncClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from conftest import signup_verify_login

from app.modules.ai.models import AiImageJob
from app.modules.auth.models import Profile


def _unique_email() -> str:
    return f"test-{uuid.uuid4().hex[:12]}@test.com"


class _MockStorage:
    def create_signed_upload_url(self, object_key: str, content_type: str) -> str:
        return f"https://mock-upload.example/{object_key}"

    def create_signed_download_url(self, object_key: str) -> str:
        return f"https://mock-download.example/{object_key}"


@pytest.fixture(autouse=True)
def _mock_storage(monkeypatch: pytest.MonkeyPatch) -> None:
    from app.modules.media import storage as storage_module
    monkeypatch.setattr(storage_module, "get_storage_client", lambda: _MockStorage())


@pytest.mark.asyncio
async def test_ai_images_generate_creates_job(
    async_client: AsyncClient,
) -> None:
    """POST /ai/images/generate creates QUEUED job and returns job_id."""
    email = _unique_email()
    token = await signup_verify_login(async_client, email, display_name="Creator")
    headers = {"Authorization": f"Bearer {token}"}

    r = await async_client.post(
        "/ai/images/generate",
        json={
            "image_type": "AVATAR",
            "preset": "creator_avatar",
            "subject": "portrait",
            "count": 1,
        },
        headers=headers,
    )
    assert r.status_code == 200, r.text
    data = r.json()
    job_id = data.get("job_id")
    assert job_id


@pytest.mark.asyncio
async def test_ai_images_apply_creator_avatar(
    async_client: AsyncClient,
    db_session: AsyncSession,
) -> None:
    """POST /ai/images/{job_id}/apply with creator.avatar updates profile."""
    email = _unique_email()
    token = await signup_verify_login(async_client, email, display_name="Creator")
    headers = {"Authorization": f"Bearer {token}"}
    me = await async_client.get("/auth/me", headers=headers)
    user_id = uuid.UUID(me.json()["id"])

    job_id = uuid.uuid4()
    object_key = f"ai/{user_id}/{job_id}/0.png"
    job = AiImageJob(
        id=job_id,
        user_id=user_id,
        status="READY",
        image_type="AVATAR",
        preset="creator_avatar",
        prompt="test prompt",
        negative_prompt="blur",
        result_object_keys=[object_key],
    )
    db_session.add(job)
    await db_session.commit()

    r = await async_client.post(
        f"/ai/images/{job_id}/apply",
        json={"apply_to": "creator.avatar", "result_index": 0},
        headers=headers,
    )
    assert r.status_code == 200, r.text
    data = r.json()
    assert data["applied_to"] == "creator.avatar"
    assert "public_url" in data

    result = await db_session.execute(
        select(Profile).where(Profile.user_id == user_id)
    )
    profile = result.scalar_one()
    assert profile.avatar_asset_id is not None


@pytest.mark.asyncio
async def test_ai_images_apply_creator_banner(
    async_client: AsyncClient,
    db_session: AsyncSession,
) -> None:
    """POST /ai/images/{job_id}/apply with creator.banner updates profile."""
    email = _unique_email()
    token = await signup_verify_login(async_client, email, display_name="Creator")
    headers = {"Authorization": f"Bearer {token}"}
    me = await async_client.get("/auth/me", headers=headers)
    user_id = uuid.UUID(me.json()["id"])

    job_id = uuid.uuid4()
    object_key = f"ai/{user_id}/{job_id}/0.png"
    job = AiImageJob(
        id=job_id,
        user_id=user_id,
        status="READY",
        image_type="BANNER",
        preset="creator_banner",
        prompt="test",
        negative_prompt="blur",
        result_object_keys=[object_key],
    )
    db_session.add(job)
    await db_session.commit()

    r = await async_client.post(
        f"/ai/images/{job_id}/apply",
        json={"apply_to": "creator.banner", "result_index": 0},
        headers=headers,
    )
    assert r.status_code == 200, r.text
    data = r.json()
    assert data["applied_to"] == "creator.banner"

    result = await db_session.execute(
        select(Profile).where(Profile.user_id == user_id)
    )
    profile = result.scalar_one()
    assert profile.banner_asset_id is not None


@pytest.mark.asyncio
async def test_ai_images_apply_landing_hero_rejects_non_admin(
    async_client: AsyncClient,
    db_session: AsyncSession,
) -> None:
    """Applying to landing.hero returns 403 for non-admin (unless ALLOW_BRAND_ASSET_WRITE)."""
    email = _unique_email()
    token = await signup_verify_login(async_client, email, display_name="Creator")
    headers = {"Authorization": f"Bearer {token}"}
    me = await async_client.get("/auth/me", headers=headers)
    user_id = uuid.UUID(me.json()["id"])

    job_id = uuid.uuid4()
    object_key = f"ai/{user_id}/{job_id}/0.png"
    job = AiImageJob(
        id=job_id,
        user_id=user_id,
        status="READY",
        image_type="HERO",
        preset="hero_marketing",
        prompt="test",
        negative_prompt="blur",
        result_object_keys=[object_key],
    )
    db_session.add(job)
    await db_session.commit()

    r = await async_client.post(
        f"/ai/images/{job_id}/apply",
        json={"apply_to": "landing.hero", "result_index": 0},
        headers=headers,
    )
    assert r.status_code == 403, r.text


@pytest.mark.asyncio
async def test_brand_assets_get_returns_landing_hero(
    async_client: AsyncClient,
) -> None:
    """GET /brand/assets returns landing_hero (null when not set)."""
    r = await async_client.get("/brand/assets")
    assert r.status_code == 200
    data = r.json()
    assert "landing_hero" in data
    assert data["landing_hero"] is None or isinstance(data["landing_hero"], str)
