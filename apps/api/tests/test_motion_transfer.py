"""Tests for Motion Transfer / Character Replace feature.

Covers:
- Request validation
- Monthly quota enforcement (creator 2/month, super_admin unlimited)
- Consent requirement
- Job state transitions (submit, status, retry, cancel)
- Parameter validation
"""

from __future__ import annotations

import uuid
from datetime import datetime, timezone
from unittest.mock import patch

import pytest
from httpx import ASGITransport, AsyncClient
from sqlalchemy import update
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import async_session_factory
from app.main import app
from app.modules.ai_tools.tool_models import AiToolJob
from app.modules.auth.models import User
from app.modules.media.models import MediaObject
from tests.conftest import signup_verify_login


@pytest.fixture
async def async_client():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        yield client


async def _create_media_asset(session: AsyncSession, user_id: uuid.UUID, content_type: str = "video/mp4") -> uuid.UUID:
    """Create a test media asset owned by user."""
    asset_id = uuid.uuid4()
    asset = MediaObject(
        id=asset_id,
        owner_user_id=user_id,
        object_key=f"test/{asset_id}/file",
        content_type=content_type,
        size_bytes=1024,
    )
    session.add(asset)
    await session.flush()
    return asset_id


async def _get_user_id(email: str) -> uuid.UUID:
    async with async_session_factory() as session:
        from sqlalchemy import select
        r = await session.execute(select(User.id).where(User.email == email))
        return r.scalar_one()


async def _setup_creator(client: AsyncClient, email: str = "mt-creator@test.com") -> tuple[str, uuid.UUID]:
    """Create creator user, return (token, user_id)."""
    token = await signup_verify_login(client, email, role="creator")
    user_id = await _get_user_id(email)
    return token, user_id


async def _setup_super_admin(client: AsyncClient, email: str = "mt-admin@test.com") -> tuple[str, uuid.UUID]:
    """Create super_admin user, return (token, user_id)."""
    token = await signup_verify_login(client, email, role="creator")
    user_id = await _get_user_id(email)
    async with async_session_factory() as session:
        await session.execute(
            update(User).where(User.id == user_id).values(role="super_admin")
        )
        await session.commit()
    # Re-login to get token with correct role
    login_r = await client.post("/auth/login", json={"email": email, "password": "password123"})
    token = login_r.json()["access_token"]
    client.cookies.delete("csrf_token")
    return token, user_id


async def _create_assets_for_user(user_id: uuid.UUID) -> tuple[uuid.UUID, uuid.UUID]:
    """Create video + image assets, return (source_id, target_id)."""
    async with async_session_factory() as session:
        source_id = await _create_media_asset(session, user_id, "video/mp4")
        target_id = await _create_media_asset(session, user_id, "image/jpeg")
        await session.commit()
    return source_id, target_id


# --- Validation tests ---

@pytest.mark.asyncio
async def test_motion_transfer_requires_consent(async_client: AsyncClient):
    token, user_id = await _setup_creator(async_client, "mt-consent@test.com")
    source_id, target_id = await _create_assets_for_user(user_id)

    with patch("app.celery_client.enqueue_motion_transfer"):
        r = await async_client.post(
            "/ai-tools/motion-transfer",
            json={
                "source_video_asset_id": str(source_id),
                "target_asset_id": str(target_id),
                "consent_acknowledged": False,
            },
            headers={"Authorization": f"Bearer {token}"},
        )
    assert r.status_code == 422
    assert "consent" in r.text.lower()


@pytest.mark.asyncio
async def test_motion_transfer_invalid_resolution(async_client: AsyncClient):
    token, user_id = await _setup_creator(async_client, "mt-res@test.com")
    source_id, target_id = await _create_assets_for_user(user_id)

    with patch("app.celery_client.enqueue_motion_transfer"):
        r = await async_client.post(
            "/ai-tools/motion-transfer",
            json={
                "source_video_asset_id": str(source_id),
                "target_asset_id": str(target_id),
                "consent_acknowledged": True,
                "output_resolution": "2048",
            },
            headers={"Authorization": f"Bearer {token}"},
        )
    assert r.status_code == 422


@pytest.mark.asyncio
async def test_motion_transfer_invalid_fps(async_client: AsyncClient):
    token, user_id = await _setup_creator(async_client, "mt-fps@test.com")
    source_id, target_id = await _create_assets_for_user(user_id)

    with patch("app.celery_client.enqueue_motion_transfer"):
        r = await async_client.post(
            "/ai-tools/motion-transfer",
            json={
                "source_video_asset_id": str(source_id),
                "target_asset_id": str(target_id),
                "consent_acknowledged": True,
                "output_fps": 60,
            },
            headers={"Authorization": f"Bearer {token}"},
        )
    assert r.status_code == 422


# --- Happy path ---

@pytest.mark.asyncio
async def test_motion_transfer_submit_success(async_client: AsyncClient):
    token, user_id = await _setup_creator(async_client, "mt-happy@test.com")
    source_id, target_id = await _create_assets_for_user(user_id)

    with patch("app.celery_client.enqueue_motion_transfer"):
        r = await async_client.post(
            "/ai-tools/motion-transfer",
            json={
                "source_video_asset_id": str(source_id),
                "target_asset_id": str(target_id),
                "consent_acknowledged": True,
            },
            headers={"Authorization": f"Bearer {token}"},
        )
    assert r.status_code == 200
    data = r.json()
    assert "job_id" in data
    assert data["status"] == "pending"


@pytest.mark.asyncio
async def test_motion_transfer_status(async_client: AsyncClient):
    token, user_id = await _setup_creator(async_client, "mt-status@test.com")
    source_id, target_id = await _create_assets_for_user(user_id)

    with patch("app.celery_client.enqueue_motion_transfer"):
        r = await async_client.post(
            "/ai-tools/motion-transfer",
            json={
                "source_video_asset_id": str(source_id),
                "target_asset_id": str(target_id),
                "consent_acknowledged": True,
            },
            headers={"Authorization": f"Bearer {token}"},
        )
    job_id = r.json()["job_id"]

    r2 = await async_client.get(
        f"/ai-tools/motion-transfer/{job_id}",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert r2.status_code == 200
    data = r2.json()
    assert data["job_id"] == job_id
    assert data["status"] == "pending"


# --- Quota tests ---

@pytest.mark.asyncio
async def test_motion_transfer_quota_creator_limit(async_client: AsyncClient):
    token, user_id = await _setup_creator(async_client, "mt-quota@test.com")
    source_id, target_id = await _create_assets_for_user(user_id)

    with patch("app.celery_client.enqueue_motion_transfer"):
        # First use
        r1 = await async_client.post(
            "/ai-tools/motion-transfer",
            json={
                "source_video_asset_id": str(source_id),
                "target_asset_id": str(target_id),
                "consent_acknowledged": True,
            },
            headers={"Authorization": f"Bearer {token}"},
        )
        assert r1.status_code == 200

        # Second use
        r2 = await async_client.post(
            "/ai-tools/motion-transfer",
            json={
                "source_video_asset_id": str(source_id),
                "target_asset_id": str(target_id),
                "consent_acknowledged": True,
            },
            headers={"Authorization": f"Bearer {token}"},
        )
        assert r2.status_code == 200

        # Third use — should be blocked
        r3 = await async_client.post(
            "/ai-tools/motion-transfer",
            json={
                "source_video_asset_id": str(source_id),
                "target_asset_id": str(target_id),
                "consent_acknowledged": True,
            },
            headers={"Authorization": f"Bearer {token}"},
        )
        assert r3.status_code == 403
        assert "quota" in r3.text.lower()


@pytest.mark.asyncio
async def test_motion_transfer_quota_super_admin_unlimited(async_client: AsyncClient):
    token, user_id = await _setup_super_admin(async_client, "mt-admin-q@test.com")
    source_id, target_id = await _create_assets_for_user(user_id)

    with patch("app.celery_client.enqueue_motion_transfer"):
        # Super admin can submit more than 2
        for i in range(3):
            r = await async_client.post(
                "/ai-tools/motion-transfer",
                json={
                    "source_video_asset_id": str(source_id),
                    "target_asset_id": str(target_id),
                    "consent_acknowledged": True,
                },
                headers={"Authorization": f"Bearer {token}"},
            )
            assert r.status_code == 200, f"Request {i+1} failed: {r.text}"


@pytest.mark.asyncio
async def test_motion_transfer_usage_endpoint(async_client: AsyncClient):
    token, user_id = await _setup_creator(async_client, "mt-usage@test.com")

    r = await async_client.get(
        "/ai-tools/motion-transfer/usage",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert r.status_code == 200
    data = r.json()
    assert data["limit"] == 2
    assert data["used"] == 0
    assert data["remaining"] == 2
    assert data["unlimited"] is False


@pytest.mark.asyncio
async def test_motion_transfer_usage_super_admin(async_client: AsyncClient):
    token, user_id = await _setup_super_admin(async_client, "mt-usage-sa@test.com")

    r = await async_client.get(
        "/ai-tools/motion-transfer/usage",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert r.status_code == 200
    data = r.json()
    assert data["unlimited"] is True


# --- Retry / Cancel ---

@pytest.mark.asyncio
async def test_motion_transfer_retry_failed_job(async_client: AsyncClient):
    token, user_id = await _setup_creator(async_client, "mt-retry@test.com")
    source_id, target_id = await _create_assets_for_user(user_id)

    with patch("app.celery_client.enqueue_motion_transfer"):
        r = await async_client.post(
            "/ai-tools/motion-transfer",
            json={
                "source_video_asset_id": str(source_id),
                "target_asset_id": str(target_id),
                "consent_acknowledged": True,
            },
            headers={"Authorization": f"Bearer {token}"},
        )
        job_id = r.json()["job_id"]

    # Mark job as failed
    async with async_session_factory() as session:
        await session.execute(
            update(AiToolJob)
            .where(AiToolJob.id == uuid.UUID(job_id))
            .values(status="failed", error_message="Test failure")
        )
        await session.commit()

    with patch("app.celery_client.enqueue_motion_transfer"):
        r2 = await async_client.post(
            f"/ai-tools/motion-transfer/{job_id}/retry",
            headers={"Authorization": f"Bearer {token}"},
        )
    assert r2.status_code == 200
    assert r2.json()["status"] == "pending"


@pytest.mark.asyncio
async def test_motion_transfer_cancel_pending_job(async_client: AsyncClient):
    token, user_id = await _setup_creator(async_client, "mt-cancel@test.com")
    source_id, target_id = await _create_assets_for_user(user_id)

    with patch("app.celery_client.enqueue_motion_transfer"):
        r = await async_client.post(
            "/ai-tools/motion-transfer",
            json={
                "source_video_asset_id": str(source_id),
                "target_asset_id": str(target_id),
                "consent_acknowledged": True,
            },
            headers={"Authorization": f"Bearer {token}"},
        )
        job_id = r.json()["job_id"]

    r2 = await async_client.post(
        f"/ai-tools/motion-transfer/{job_id}/cancel",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert r2.status_code == 200
    assert r2.json()["status"] == "failed"


# --- Validation does not consume quota ---

@pytest.mark.asyncio
async def test_failed_validation_does_not_consume_quota(async_client: AsyncClient):
    token, user_id = await _setup_creator(async_client, "mt-val-noquota@test.com")
    source_id, target_id = await _create_assets_for_user(user_id)

    with patch("app.celery_client.enqueue_motion_transfer"):
        # Submit with invalid resolution (should fail validation, not consume quota)
        r = await async_client.post(
            "/ai-tools/motion-transfer",
            json={
                "source_video_asset_id": str(source_id),
                "target_asset_id": str(target_id),
                "consent_acknowledged": True,
                "output_resolution": "9999",
            },
            headers={"Authorization": f"Bearer {token}"},
        )
        assert r.status_code == 422

    # Check usage — should still be 0
    r2 = await async_client.get(
        "/ai-tools/motion-transfer/usage",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert r2.json()["used"] == 0
