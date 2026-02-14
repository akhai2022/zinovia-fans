"""Media: download URL variant resolution; original object_key is never modified."""

from __future__ import annotations

import uuid

import pytest
from httpx import AsyncClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.errors import AppError
from app.modules.auth.models import Profile, User
from app.modules.creators.constants import CREATOR_ROLE
from app.modules.media.models import MediaDerivedAsset, MediaObject
from app.modules.posts.constants import VISIBILITY_PUBLIC
from app.modules.posts.models import Post, PostMedia
from app.modules.media.service import resolve_download_object_key, validate_media_upload


@pytest.mark.asyncio
async def test_resolve_download_object_key_no_variant_returns_original(
    db_session: AsyncSession,
) -> None:
    """When variant is None or invalid, returned key is the original."""
    media_id = uuid.uuid4()
    original_key = "uploads/original.png"
    key = await resolve_download_object_key(db_session, media_id, original_key, None)
    assert key == original_key
    key = await resolve_download_object_key(db_session, media_id, original_key, "invalid")
    assert key == original_key


@pytest.mark.asyncio
async def test_resolve_download_object_key_variant_missing_returns_original(
    db_session: AsyncSession,
) -> None:
    """When variant is requested but no derived row exists, return original (original unchanged)."""
    media_id = uuid.uuid4()
    original_key = "uploads/foo.jpg"
    key = await resolve_download_object_key(db_session, media_id, original_key, "grid")
    assert key == original_key


@pytest.mark.asyncio
async def test_resolve_download_object_key_variant_exists_returns_derived(
    async_client: AsyncClient,
    db_session: AsyncSession,
) -> None:
    """When variant is requested and derived exists, return derived key; original key unchanged."""
    email = f"media-{uuid.uuid4().hex[:12]}@test.com"
    await async_client.post(
        "/auth/signup",
        json={"email": email, "password": "password123", "display_name": "Media Owner"},
    )
    login = await async_client.post("/auth/login", json={"email": email, "password": "password123"})
    me = await async_client.get(
        "/auth/me",
        headers={"Authorization": f"Bearer {login.json()['access_token']}"},
    )
    user_id = uuid.UUID(me.json()["id"])

    media_id = uuid.uuid4()
    unique = uuid.uuid4().hex[:8]
    original_key = f"uploads/foo_{unique}.jpg"
    derived_key = f"derived/uploads/foo_{unique}_grid.jpg"
    media = MediaObject(
        id=media_id,
        owner_user_id=user_id,
        object_key=original_key,
        content_type="image/jpeg",
        size_bytes=1000,
    )
    db_session.add(media)
    db_session.add(
        MediaDerivedAsset(
            id=uuid.uuid4(),
            parent_asset_id=media_id,
            variant="grid",
            object_key=derived_key,
        )
    )
    await db_session.commit()

    key = await resolve_download_object_key(db_session, media_id, original_key, "grid")
    assert key == derived_key
    # Original asset object_key is never overwritten (stored in media_assets row)
    await db_session.refresh(media)
    assert media.object_key == original_key


@pytest.mark.asyncio
async def test_resolve_download_object_key_poster_missing_returns_none(
    db_session: AsyncSession,
) -> None:
    """When variant=poster and no derived row, return None (no fallback to video)."""
    media_id = uuid.uuid4()
    original_key = "uploads/video.mp4"
    key = await resolve_download_object_key(db_session, media_id, original_key, "poster")
    assert key is None


def test_validate_media_upload_accepts_image() -> None:
    validate_media_upload("image/jpeg", 1000)
    validate_media_upload("image/png", 1)


def test_validate_media_upload_rejects_non_mp4_video() -> None:
    with pytest.raises(AppError) as exc_info:
        validate_media_upload("video/webm", 1000)
    assert exc_info.value.detail == "unsupported_media_type"


def test_validate_media_upload_accepts_mp4_when_allowed() -> None:
    validate_media_upload("video/mp4", 100)
    validate_media_upload("video/mp4", 199_000_000)


def test_validate_media_upload_rejects_oversize_video() -> None:
    with pytest.raises(AppError) as exc_info:
        validate_media_upload("video/mp4", 200_000_001)
    assert exc_info.value.detail == "video_exceeds_max_size"


# ---------------------------------------------------------------------------
# Integration: GET /media/{id}/download-url (mock storage to avoid MinIO)
# ---------------------------------------------------------------------------

class _MockStorage:
    """Returns deterministic URLs without calling MinIO/GCS."""

    def create_signed_upload_url(self, object_key: str, content_type: str) -> str:
        return f"https://mock-upload.example/{object_key}"

    def create_signed_download_url(self, object_key: str) -> str:
        return f"https://mock-download.example/{object_key}"


@pytest.mark.asyncio
async def test_download_url_returns_200_with_url_when_authorized(
    async_client: AsyncClient,
    db_session: AsyncSession,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """GET /media/{asset_id}/download-url returns 200 and a URL when user can access (owner)."""
    from app.modules.media import router as media_router
    monkeypatch.setattr(media_router, "get_storage_client", lambda: _MockStorage())

    email = f"dl-{uuid.uuid4().hex[:12]}@test.com"
    await async_client.post(
        "/auth/signup",
        json={"email": email, "password": "password123", "display_name": "User"},
    )
    login = await async_client.post("/auth/login", json={"email": email, "password": "password123"})
    token = login.json()["access_token"]
    me = await async_client.get("/auth/me", headers={"Authorization": f"Bearer {token}"})
    user_id = uuid.UUID(me.json()["id"])
    media_id = uuid.uuid4()
    object_key = f"uploads/{uuid.uuid4().hex}.jpg"
    media = MediaObject(
        id=media_id,
        owner_user_id=user_id,
        object_key=object_key,
        content_type="image/jpeg",
        size_bytes=100,
    )
    db_session.add(media)
    await db_session.commit()

    r = await async_client.get(
        f"/media/{media_id}/download-url",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert r.status_code == 200, r.json()
    data = r.json()
    assert "download_url" in data
    assert data["download_url"] == f"https://mock-download.example/{object_key}"


@pytest.mark.asyncio
async def test_download_url_variant_grid_returns_derived_when_present(
    async_client: AsyncClient,
    db_session: AsyncSession,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """GET /media/{id}/download-url?variant=grid returns derived asset URL when row exists."""
    from app.modules.media import router as media_router
    monkeypatch.setattr(media_router, "get_storage_client", lambda: _MockStorage())

    email = f"vg-{uuid.uuid4().hex[:12]}@test.com"
    await async_client.post(
        "/auth/signup",
        json={"email": email, "password": "password123", "display_name": "User"},
    )
    login = await async_client.post("/auth/login", json={"email": email, "password": "password123"})
    token = login.json()["access_token"]
    me = await async_client.get("/auth/me", headers={"Authorization": f"Bearer {token}"})
    user_id = uuid.UUID(me.json()["id"])
    media_id = uuid.uuid4()
    unique = uuid.uuid4().hex[:8]
    original_key = f"uploads/img_{unique}.jpg"
    derived_key = f"derived/uploads/img_{unique}_grid.jpg"
    media = MediaObject(
        id=media_id,
        owner_user_id=user_id,
        object_key=original_key,
        content_type="image/jpeg",
        size_bytes=100,
    )
    db_session.add(media)
    db_session.add(
        MediaDerivedAsset(
            id=uuid.uuid4(),
            parent_asset_id=media_id,
            variant="grid",
            object_key=derived_key,
        )
    )
    await db_session.commit()

    r = await async_client.get(
        f"/media/{media_id}/download-url",
        params={"variant": "grid"},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert r.status_code == 200, r.json()
    assert r.json()["download_url"] == f"https://mock-download.example/{derived_key}"


@pytest.mark.asyncio
async def test_download_url_variant_poster_returns_404_when_missing(
    async_client: AsyncClient,
    db_session: AsyncSession,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """GET /media/{id}/download-url?variant=poster returns 404 when no poster derived (no fallback to video)."""
    from app.modules.media import router as media_router
    monkeypatch.setattr(media_router, "get_storage_client", lambda: _MockStorage())

    email = f"vp-{uuid.uuid4().hex[:12]}@test.com"
    await async_client.post(
        "/auth/signup",
        json={"email": email, "password": "password123", "display_name": "User"},
    )
    login = await async_client.post("/auth/login", json={"email": email, "password": "password123"})
    token = login.json()["access_token"]
    me = await async_client.get("/auth/me", headers={"Authorization": f"Bearer {token}"})
    user_id = uuid.UUID(me.json()["id"])
    media_id = uuid.uuid4()
    media = MediaObject(
        id=media_id,
        owner_user_id=user_id,
        object_key=f"uploads/{uuid.uuid4().hex}.mp4",
        content_type="video/mp4",
        size_bytes=1000,
    )
    db_session.add(media)
    await db_session.commit()

    r = await async_client.get(
        f"/media/{media_id}/download-url",
        params={"variant": "poster"},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert r.status_code == 404
    assert r.json().get("detail") == "variant_not_found"


@pytest.mark.asyncio
async def test_download_url_returns_200_for_public_post_media_without_auth(
    async_client: AsyncClient,
    db_session: AsyncSession,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """GET /media/{id}/download-url without auth returns 200 when media is in a PUBLIC post."""
    from app.modules.media import router as media_router

    monkeypatch.setattr(media_router, "get_storage_client", lambda: _MockStorage())

    email = f"anon-{uuid.uuid4().hex[:12]}@test.com"
    await async_client.post(
        "/auth/signup",
        json={"email": email, "password": "password123", "display_name": "Creator"},
    )
    login = await async_client.post("/auth/login", json={"email": email, "password": "password123"})
    token = login.json()["access_token"]
    me = await async_client.get("/auth/me", headers={"Authorization": f"Bearer {token}"})
    user_id = uuid.UUID(me.json()["id"])

    user = await db_session.get(User, user_id)
    assert user is not None
    user.role = CREATOR_ROLE
    result = await db_session.execute(select(Profile).where(Profile.user_id == user_id))
    profile = result.scalar_one()
    unique_handle = f"testcreator-{uuid.uuid4().hex[:8]}"
    profile.handle = unique_handle
    profile.handle_normalized = unique_handle
    profile.discoverable = True
    await db_session.commit()

    media_id = uuid.uuid4()
    object_key = f"uploads/public_{uuid.uuid4().hex}.jpg"
    media = MediaObject(
        id=media_id,
        owner_user_id=user_id,
        object_key=object_key,
        content_type="image/jpeg",
        size_bytes=100,
    )
    db_session.add(media)
    await db_session.flush()
    post = Post(
        creator_user_id=user_id,
        type="IMAGE",
        visibility=VISIBILITY_PUBLIC,
        nsfw=False,
    )
    db_session.add(post)
    await db_session.flush()
    db_session.add(PostMedia(post_id=post.id, media_asset_id=media_id, position=0))
    await db_session.commit()

    r = await async_client.get(f"/media/{media_id}/download-url")
    assert r.status_code == 200, r.json()
    assert r.json().get("download_url") == f"https://mock-download.example/{object_key}"
