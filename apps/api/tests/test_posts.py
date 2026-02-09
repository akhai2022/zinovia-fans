from __future__ import annotations

import uuid

import pytest
from httpx import AsyncClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.billing.models import Subscription
from app.modules.media.models import MediaObject


def _unique_email() -> str:
    return f"test-{uuid.uuid4().hex[:12]}@test.com"


@pytest.mark.asyncio
async def test_creator_can_create_text_post(
    async_client: AsyncClient,
) -> None:
    email = _unique_email()
    await async_client.post(
        "/auth/signup",
        json={"email": email, "password": "password123", "display_name": "Author"},
    )
    login = await async_client.post("/auth/login", json={"email": email, "password": "password123"})
    token = login.json()["access_token"]
    handle = f"author-{uuid.uuid4().hex[:8]}"
    await async_client.patch(
        "/creators/me",
        json={"handle": handle},
        headers={"Authorization": f"Bearer {token}"},
    )
    r = await async_client.post(
        "/posts",
        json={
            "type": "TEXT",
            "caption": "Hello world",
            "visibility": "PUBLIC",
            "nsfw": False,
            "asset_ids": [],
        },
        headers={"Authorization": f"Bearer {token}"},
    )
    assert r.status_code == 201, r.json()
    data = r.json()
    assert data["type"] == "TEXT"
    assert data["caption"] == "Hello world"
    assert data["visibility"] == "PUBLIC"
    assert data["asset_ids"] == []


@pytest.mark.asyncio
async def test_creator_can_create_image_post_with_media(
    async_client: AsyncClient,
    db_session: AsyncSession,
) -> None:
    email = _unique_email()
    await async_client.post(
        "/auth/signup",
        json={"email": email, "password": "password123", "display_name": "PhotoCreator"},
    )
    login = await async_client.post("/auth/login", json={"email": email, "password": "password123"})
    token = login.json()["access_token"]
    me = await async_client.get("/auth/me", headers={"Authorization": f"Bearer {token}"})
    user_id = uuid.UUID(me.json()["id"])
    handle = f"photo-{uuid.uuid4().hex[:8]}"
    await async_client.patch(
        "/creators/me",
        json={"handle": handle},
        headers={"Authorization": f"Bearer {token}"},
    )
    media = MediaObject(
        owner_user_id=user_id,
        object_key=f"test/{uuid.uuid4().hex}",
        content_type="image/jpeg",
        size_bytes=100,
    )
    db_session.add(media)
    await db_session.commit()
    await db_session.refresh(media)
    r = await async_client.post(
        "/posts",
        json={
            "type": "IMAGE",
            "caption": "A photo",
            "visibility": "PUBLIC",
            "nsfw": False,
            "asset_ids": [str(media.id)],
        },
        headers={"Authorization": f"Bearer {token}"},
    )
    assert r.status_code == 201, r.json()
    data = r.json()
    assert data["type"] == "IMAGE"
    assert data["asset_ids"] == [str(media.id)]


@pytest.mark.asyncio
async def test_creator_can_create_video_post_with_mp4_asset(
    async_client: AsyncClient,
    db_session: AsyncSession,
) -> None:
    email = _unique_email()
    await async_client.post(
        "/auth/signup",
        json={"email": email, "password": "password123", "display_name": "VideoCreator"},
    )
    login = await async_client.post("/auth/login", json={"email": email, "password": "password123"})
    token = login.json()["access_token"]
    me = await async_client.get("/auth/me", headers={"Authorization": f"Bearer {token}"})
    user_id = uuid.UUID(me.json()["id"])
    handle = f"video-{uuid.uuid4().hex[:8]}"
    await async_client.patch(
        "/creators/me",
        json={"handle": handle},
        headers={"Authorization": f"Bearer {token}"},
    )
    media = MediaObject(
        owner_user_id=user_id,
        object_key=f"test/{uuid.uuid4().hex}.mp4",
        content_type="video/mp4",
        size_bytes=1000,
    )
    db_session.add(media)
    await db_session.commit()
    await db_session.refresh(media)
    r = await async_client.post(
        "/posts",
        json={
            "type": "VIDEO",
            "caption": "A video",
            "visibility": "PUBLIC",
            "nsfw": False,
            "asset_ids": [str(media.id)],
        },
        headers={"Authorization": f"Bearer {token}"},
    )
    assert r.status_code == 201, r.json()
    data = r.json()
    assert data["type"] == "VIDEO"
    assert data["asset_ids"] == [str(media.id)]


@pytest.mark.asyncio
async def test_video_post_requires_mp4_asset(
    async_client: AsyncClient,
    db_session: AsyncSession,
) -> None:
    email = _unique_email()
    await async_client.post(
        "/auth/signup",
        json={"email": email, "password": "password123", "display_name": "Creator"},
    )
    login = await async_client.post("/auth/login", json={"email": email, "password": "password123"})
    token = login.json()["access_token"]
    me = await async_client.get("/auth/me", headers={"Authorization": f"Bearer {token}"})
    user_id = uuid.UUID(me.json()["id"])
    await async_client.patch(
        "/creators/me",
        json={"handle": f"c-{uuid.uuid4().hex[:8]}"},
        headers={"Authorization": f"Bearer {token}"},
    )
    media = MediaObject(
        owner_user_id=user_id,
        object_key=f"test/{uuid.uuid4().hex}.jpg",
        content_type="image/jpeg",
        size_bytes=100,
    )
    db_session.add(media)
    await db_session.commit()
    await db_session.refresh(media)
    r = await async_client.post(
        "/posts",
        json={
            "type": "VIDEO",
            "caption": "Not a video",
            "visibility": "PUBLIC",
            "nsfw": False,
            "asset_ids": [str(media.id)],
        },
        headers={"Authorization": f"Bearer {token}"},
    )
    assert r.status_code == 400, r.json()
    assert r.json().get("detail") == "video_post_requires_mp4_asset"


@pytest.mark.asyncio
async def test_non_creator_cannot_create_post(
    async_client: AsyncClient,
) -> None:
    email = _unique_email()
    await async_client.post(
        "/auth/signup",
        json={"email": email, "password": "password123", "display_name": "Fan"},
    )
    login = await async_client.post("/auth/login", json={"email": email, "password": "password123"})
    token = login.json()["access_token"]
    r = await async_client.post(
        "/posts",
        json={
            "type": "TEXT",
            "caption": "Nope",
            "visibility": "PUBLIC",
            "asset_ids": [],
        },
        headers={"Authorization": f"Bearer {token}"},
    )
    assert r.status_code == 403, r.json()


@pytest.mark.asyncio
async def test_visibility_public_visible_to_anon(
    async_client: AsyncClient,
) -> None:
    email = _unique_email()
    await async_client.post(
        "/auth/signup",
        json={"email": email, "password": "password123", "display_name": "PublicCreator"},
    )
    login = await async_client.post("/auth/login", json={"email": email, "password": "password123"})
    token = login.json()["access_token"]
    handle = f"pub-{uuid.uuid4().hex[:8]}"
    await async_client.patch(
        "/creators/me",
        json={"handle": handle},
        headers={"Authorization": f"Bearer {token}"},
    )
    await async_client.post(
        "/posts",
        json={"type": "TEXT", "caption": "Public post", "visibility": "PUBLIC", "asset_ids": []},
        headers={"Authorization": f"Bearer {token}"},
    )
    r = await async_client.get(f"/creators/{handle}/posts", params={"page": 1, "page_size": 10})
    assert r.status_code == 200, r.json()
    data = r.json()
    assert len(data["items"]) >= 1
    assert data["items"][0]["visibility"] == "PUBLIC"


@pytest.mark.asyncio
async def test_visibility_followers_visible_to_follower(
    async_client: AsyncClient,
) -> None:
    email_creator = _unique_email()
    email_fan = _unique_email()
    await async_client.post(
        "/auth/signup",
        json={"email": email_creator, "password": "password123", "display_name": "Creator"},
    )
    login_c = await async_client.post("/auth/login", json={"email": email_creator, "password": "password123"})
    token_c = login_c.json()["access_token"]
    handle = f"fol-{uuid.uuid4().hex[:8]}"
    await async_client.patch(
        "/creators/me",
        json={"handle": handle},
        headers={"Authorization": f"Bearer {token_c}"},
    )
    await async_client.post(
        "/posts",
        json={
            "type": "TEXT",
            "caption": "Followers only",
            "visibility": "FOLLOWERS",
            "asset_ids": [],
        },
        headers={"Authorization": f"Bearer {token_c}"},
    )
    # Anon with include_locked=false does not see FOLLOWERS posts
    async_client.cookies.clear()
    r = await async_client.get(
        f"/creators/{handle}/posts",
        params={"page": 1, "page_size": 10, "include_locked": False},
    )
    assert r.status_code == 200
    assert len(r.json()["items"]) == 0
    # Fan follows then can see
    await async_client.post(
        "/auth/signup",
        json={"email": email_fan, "password": "password123", "display_name": "Fan"},
    )
    login_f = await async_client.post("/auth/login", json={"email": email_fan, "password": "password123"})
    token_f = login_f.json()["access_token"]
    async_client.cookies.clear()  # so /auth/me uses Bearer only and returns creator
    me_c = await async_client.get("/auth/me", headers={"Authorization": f"Bearer {token_c}"})
    creator_id = me_c.json()["id"]
    await async_client.post(
        f"/creators/{creator_id}/follow",
        headers={"Authorization": f"Bearer {token_f}"},
    )
    r = await async_client.get(
        f"/creators/{handle}/posts",
        params={"page": 1, "page_size": 10},
        headers={"Authorization": f"Bearer {token_f}"},
    )
    assert r.status_code == 200
    assert len(r.json()["items"]) >= 1
    assert r.json()["items"][0]["visibility"] == "FOLLOWERS"


@pytest.mark.asyncio
async def test_visibility_subscribers_hidden_from_follower(
    async_client: AsyncClient,
) -> None:
    email_creator = _unique_email()
    email_fan = _unique_email()
    await async_client.post(
        "/auth/signup",
        json={"email": email_creator, "password": "password123", "display_name": "Creator"},
    )
    login_c = await async_client.post("/auth/login", json={"email": email_creator, "password": "password123"})
    token_c = login_c.json()["access_token"]
    handle = f"sub-{uuid.uuid4().hex[:8]}"
    await async_client.patch(
        "/creators/me",
        json={"handle": handle},
        headers={"Authorization": f"Bearer {token_c}"},
    )
    await async_client.post(
        "/posts",
        json={
            "type": "TEXT",
            "caption": "Subscribers only",
            "visibility": "SUBSCRIBERS",
            "asset_ids": [],
        },
        headers={"Authorization": f"Bearer {token_c}"},
    )
    await async_client.post(
        "/auth/signup",
        json={"email": email_fan, "password": "password123", "display_name": "Fan"},
    )
    login_f = await async_client.post("/auth/login", json={"email": email_fan, "password": "password123"})
    token_f = login_f.json()["access_token"]
    async_client.cookies.clear()  # so /auth/me uses Bearer only and returns creator
    me_c = await async_client.get("/auth/me", headers={"Authorization": f"Bearer {token_c}"})
    creator_id = me_c.json()["id"]
    await async_client.post(
        f"/creators/{creator_id}/follow",
        headers={"Authorization": f"Bearer {token_f}"},
    )
    r = await async_client.get(
        f"/creators/{handle}/posts",
        params={"page": 1, "page_size": 10, "include_locked": False},
        headers={"Authorization": f"Bearer {token_f}"},
    )
    assert r.status_code == 200
    assert len(r.json()["items"]) == 0


@pytest.mark.asyncio
async def test_include_locked_returns_teaser_for_non_subscriber(
    async_client: AsyncClient,
) -> None:
    """Non-subscriber with include_locked=true sees SUBSCRIBERS posts as locked teasers (no caption/asset_ids)."""
    email_creator = _unique_email()
    email_fan = _unique_email()
    await async_client.post(
        "/auth/signup",
        json={"email": email_creator, "password": "password123", "display_name": "Creator"},
    )
    login_c = await async_client.post("/auth/login", json={"email": email_creator, "password": "password123"})
    token_c = login_c.json()["access_token"]
    handle = f"tease-{uuid.uuid4().hex[:8]}"
    await async_client.patch(
        "/creators/me",
        json={"handle": handle},
        headers={"Authorization": f"Bearer {token_c}"},
    )
    await async_client.post(
        "/posts",
        json={
            "type": "TEXT",
            "caption": "Secret caption",
            "visibility": "SUBSCRIBERS",
            "asset_ids": [],
        },
        headers={"Authorization": f"Bearer {token_c}"},
    )
    await async_client.post(
        "/auth/signup",
        json={"email": email_fan, "password": "password123", "display_name": "Fan"},
    )
    login_f = await async_client.post("/auth/login", json={"email": email_fan, "password": "password123"})
    token_f = login_f.json()["access_token"]
    async_client.cookies.clear()
    me_c = await async_client.get("/auth/me", headers={"Authorization": f"Bearer {token_c}"})
    creator_id = me_c.json()["id"]
    await async_client.post(
        f"/creators/{creator_id}/follow",
        headers={"Authorization": f"Bearer {token_f}"},
    )
    r = await async_client.get(
        f"/creators/{handle}/posts",
        params={"page": 1, "page_size": 10, "include_locked": True},
        headers={"Authorization": f"Bearer {token_f}"},
    )
    assert r.status_code == 200, r.json()
    items = r.json()["items"]
    assert len(items) >= 1
    assert items[0]["is_locked"] is True
    assert items[0]["locked_reason"] == "SUBSCRIPTION_REQUIRED"
    assert items[0]["visibility"] == "SUBSCRIBERS"
    assert items[0]["caption"] is None
    assert items[0]["asset_ids"] == []


@pytest.mark.asyncio
async def test_include_locked_returns_teaser_for_non_follower(
    async_client: AsyncClient,
) -> None:
    """Non-follower with include_locked=true sees FOLLOWERS posts as locked teasers with FOLLOW_REQUIRED."""
    email_creator = _unique_email()
    email_fan = _unique_email()
    await async_client.post(
        "/auth/signup",
        json={"email": email_creator, "password": "password123", "display_name": "Creator"},
    )
    login_c = await async_client.post("/auth/login", json={"email": email_creator, "password": "password123"})
    token_c = login_c.json()["access_token"]
    handle = f"foltease-{uuid.uuid4().hex[:8]}"
    await async_client.patch(
        "/creators/me",
        json={"handle": handle},
        headers={"Authorization": f"Bearer {token_c}"},
    )
    await async_client.post(
        "/posts",
        json={
            "type": "TEXT",
            "caption": "Followers only caption",
            "visibility": "FOLLOWERS",
            "asset_ids": [],
        },
        headers={"Authorization": f"Bearer {token_c}"},
    )
    await async_client.post(
        "/auth/signup",
        json={"email": email_fan, "password": "password123", "display_name": "Fan"},
    )
    login_f = await async_client.post("/auth/login", json={"email": email_fan, "password": "password123"})
    token_f = login_f.json()["access_token"]
    async_client.cookies.clear()
    r = await async_client.get(
        f"/creators/{handle}/posts",
        params={"page": 1, "page_size": 10, "include_locked": True},
        headers={"Authorization": f"Bearer {token_f}"},
    )
    assert r.status_code == 200, r.json()
    items = r.json()["items"]
    assert len(items) >= 1
    assert items[0]["is_locked"] is True
    assert items[0]["locked_reason"] == "FOLLOW_REQUIRED"
    assert items[0]["visibility"] == "FOLLOWERS"
    assert items[0]["caption"] is None
    assert items[0]["asset_ids"] == []


@pytest.mark.asyncio
async def test_locked_teaser_image_post_redacts_asset_ids(
    async_client: AsyncClient,
    db_session: AsyncSession,
) -> None:
    """SUBSCRIBERS IMAGE post appears as locked teaser: is_locked true, caption null, asset_ids empty."""
    email_creator = _unique_email()
    email_fan = _unique_email()
    await async_client.post(
        "/auth/signup",
        json={"email": email_creator, "password": "password123", "display_name": "Creator"},
    )
    login_c = await async_client.post("/auth/login", json={"email": email_creator, "password": "password123"})
    token_c = login_c.json()["access_token"]
    me_c = await async_client.get("/auth/me", headers={"Authorization": f"Bearer {token_c}"})
    user_id = me_c.json()["id"]
    handle = f"imglock-{uuid.uuid4().hex[:8]}"
    await async_client.patch(
        "/creators/me",
        json={"handle": handle},
        headers={"Authorization": f"Bearer {token_c}"},
    )
    media = MediaObject(
        owner_user_id=uuid.UUID(user_id),
        object_key=f"test/{uuid.uuid4().hex}.jpg",
        content_type="image/jpeg",
        size_bytes=100,
    )
    db_session.add(media)
    await db_session.commit()
    await db_session.refresh(media)
    await async_client.post(
        "/posts",
        json={
            "type": "IMAGE",
            "caption": "Sub-only image",
            "visibility": "SUBSCRIBERS",
            "nsfw": False,
            "asset_ids": [str(media.id)],
        },
        headers={"Authorization": f"Bearer {token_c}"},
    )
    await async_client.post(
        "/auth/signup",
        json={"email": email_fan, "password": "password123", "display_name": "Fan"},
    )
    login_f = await async_client.post("/auth/login", json={"email": email_fan, "password": "password123"})
    token_f = login_f.json()["access_token"]
    async_client.cookies.clear()
    await async_client.get("/auth/me", headers={"Authorization": f"Bearer {token_c}"})
    creator_id = me_c.json()["id"]
    await async_client.post(
        f"/creators/{creator_id}/follow",
        headers={"Authorization": f"Bearer {token_f}"},
    )
    r = await async_client.get(
        f"/creators/{handle}/posts",
        params={"page": 1, "page_size": 10, "include_locked": True},
        headers={"Authorization": f"Bearer {token_f}"},
    )
    assert r.status_code == 200, r.json()
    items = r.json()["items"]
    sub_post = next((p for p in items if p.get("visibility") == "SUBSCRIBERS" and p.get("type") == "IMAGE"), None)
    assert sub_post is not None
    assert sub_post["is_locked"] is True
    assert sub_post["locked_reason"] == "SUBSCRIPTION_REQUIRED"
    assert sub_post["caption"] is None
    assert sub_post["asset_ids"] == []


@pytest.mark.asyncio
async def test_locked_teaser_video_post_redacts_asset_ids(
    async_client: AsyncClient,
    db_session: AsyncSession,
) -> None:
    """SUBSCRIBERS VIDEO post appears as locked teaser: is_locked true, caption null, asset_ids empty."""
    email_creator = _unique_email()
    email_fan = _unique_email()
    await async_client.post(
        "/auth/signup",
        json={"email": email_creator, "password": "password123", "display_name": "Creator"},
    )
    login_c = await async_client.post("/auth/login", json={"email": email_creator, "password": "password123"})
    token_c = login_c.json()["access_token"]
    me_c = await async_client.get("/auth/me", headers={"Authorization": f"Bearer {token_c}"})
    user_id = me_c.json()["id"]
    handle = f"vidlock-{uuid.uuid4().hex[:8]}"
    await async_client.patch(
        "/creators/me",
        json={"handle": handle},
        headers={"Authorization": f"Bearer {token_c}"},
    )
    media = MediaObject(
        owner_user_id=uuid.UUID(user_id),
        object_key=f"test/{uuid.uuid4().hex}.mp4",
        content_type="video/mp4",
        size_bytes=1000,
    )
    db_session.add(media)
    await db_session.commit()
    await db_session.refresh(media)
    await async_client.post(
        "/posts",
        json={
            "type": "VIDEO",
            "caption": "Sub-only video",
            "visibility": "SUBSCRIBERS",
            "nsfw": False,
            "asset_ids": [str(media.id)],
        },
        headers={"Authorization": f"Bearer {token_c}"},
    )
    await async_client.post(
        "/auth/signup",
        json={"email": email_fan, "password": "password123", "display_name": "Fan"},
    )
    login_f = await async_client.post("/auth/login", json={"email": email_fan, "password": "password123"})
    token_f = login_f.json()["access_token"]
    r = await async_client.get(
        f"/creators/{handle}/posts",
        params={"page": 1, "page_size": 10, "include_locked": True},
        headers={"Authorization": f"Bearer {token_f}"},
    )
    assert r.status_code == 200, r.json()
    items = r.json()["items"]
    sub_post = next((p for p in items if p.get("visibility") == "SUBSCRIBERS" and p.get("type") == "VIDEO"), None)
    assert sub_post is not None
    assert sub_post["is_locked"] is True
    assert sub_post["locked_reason"] == "SUBSCRIPTION_REQUIRED"
    assert sub_post["caption"] is None
    assert sub_post["asset_ids"] == []


@pytest.mark.asyncio
async def test_follower_sees_followers_post_unlocked_with_asset_ids(
    async_client: AsyncClient,
    db_session: AsyncSession,
) -> None:
    """After follow, FOLLOWERS IMAGE post returns is_locked false and includes asset_ids/caption."""
    email_creator = _unique_email()
    email_fan = _unique_email()
    await async_client.post(
        "/auth/signup",
        json={"email": email_creator, "password": "password123", "display_name": "Creator"},
    )
    login_c = await async_client.post("/auth/login", json={"email": email_creator, "password": "password123"})
    token_c = login_c.json()["access_token"]
    me_c = await async_client.get("/auth/me", headers={"Authorization": f"Bearer {token_c}"})
    user_id = me_c.json()["id"]
    handle = f"folunlock-{uuid.uuid4().hex[:8]}"
    await async_client.patch(
        "/creators/me",
        json={"handle": handle},
        headers={"Authorization": f"Bearer {token_c}"},
    )
    media = MediaObject(
        owner_user_id=uuid.UUID(user_id),
        object_key=f"test/{uuid.uuid4().hex}.jpg",
        content_type="image/jpeg",
        size_bytes=100,
    )
    db_session.add(media)
    await db_session.commit()
    await db_session.refresh(media)
    await async_client.post(
        "/posts",
        json={
            "type": "IMAGE",
            "caption": "Followers only",
            "visibility": "FOLLOWERS",
            "nsfw": False,
            "asset_ids": [str(media.id)],
        },
        headers={"Authorization": f"Bearer {token_c}"},
    )
    await async_client.post(
        "/auth/signup",
        json={"email": email_fan, "password": "password123", "display_name": "Fan"},
    )
    login_f = await async_client.post("/auth/login", json={"email": email_fan, "password": "password123"})
    token_f = login_f.json()["access_token"]
    r_before = await async_client.get(
        f"/creators/{handle}/posts",
        params={"page": 1, "page_size": 10, "include_locked": True},
        headers={"Authorization": f"Bearer {token_f}"},
    )
    assert r_before.status_code == 200
    items_before = r_before.json()["items"]
    fol_post_before = next((p for p in items_before if p.get("visibility") == "FOLLOWERS"), None)
    assert fol_post_before is not None
    assert fol_post_before["is_locked"] is True
    assert fol_post_before["asset_ids"] == []
    creator_id = me_c.json()["id"]
    await async_client.post(
        f"/creators/{creator_id}/follow",
        headers={"Authorization": f"Bearer {token_f}"},
    )
    r_after = await async_client.get(
        f"/creators/{handle}/posts",
        params={"page": 1, "page_size": 10},
        headers={"Authorization": f"Bearer {token_f}"},
    )
    assert r_after.status_code == 200
    items_after = r_after.json()["items"]
    fol_post_after = next((p for p in items_after if p.get("visibility") == "FOLLOWERS"), None)
    assert fol_post_after is not None
    assert fol_post_after["is_locked"] is False
    assert fol_post_after["caption"] == "Followers only"
    assert fol_post_after["asset_ids"] == [str(media.id)]


@pytest.mark.asyncio
async def test_visibility_subscribers_visible_to_creator(
    async_client: AsyncClient,
) -> None:
    email = _unique_email()
    await async_client.post(
        "/auth/signup",
        json={"email": email, "password": "password123", "display_name": "Me"},
    )
    login = await async_client.post("/auth/login", json={"email": email, "password": "password123"})
    token = login.json()["access_token"]
    handle = f"me-{uuid.uuid4().hex[:8]}"
    await async_client.patch(
        "/creators/me",
        json={"handle": handle},
        headers={"Authorization": f"Bearer {token}"},
    )
    await async_client.post(
        "/posts",
        json={
            "type": "TEXT",
            "caption": "My subscribers post",
            "visibility": "SUBSCRIBERS",
            "asset_ids": [],
        },
        headers={"Authorization": f"Bearer {token}"},
    )
    r = await async_client.get(
        f"/creators/{handle}/posts",
        params={"page": 1, "page_size": 10},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert r.status_code == 200
    assert len(r.json()["items"]) >= 1
    assert r.json()["items"][0]["visibility"] == "SUBSCRIBERS"
    assert r.json()["items"][0]["is_locked"] is False


@pytest.mark.asyncio
async def test_feed_returns_followed_creators_public_posts(
    async_client: AsyncClient,
) -> None:
    email_creator = _unique_email()
    email_fan = _unique_email()
    await async_client.post(
        "/auth/signup",
        json={"email": email_creator, "password": "password123", "display_name": "FeedCreator"},
    )
    login_c = await async_client.post("/auth/login", json={"email": email_creator, "password": "password123"})
    token_c = login_c.json()["access_token"]
    handle = f"feed-{uuid.uuid4().hex[:8]}"
    await async_client.patch(
        "/creators/me",
        json={"handle": handle},
        headers={"Authorization": f"Bearer {token_c}"},
    )
    await async_client.post(
        "/posts",
        json={
            "type": "TEXT",
            "caption": "Feed post",
            "visibility": "PUBLIC",
            "asset_ids": [],
        },
        headers={"Authorization": f"Bearer {token_c}"},
    )
    await async_client.post(
        "/auth/signup",
        json={"email": email_fan, "password": "password123", "display_name": "FeedFan"},
    )
    login_f = await async_client.post("/auth/login", json={"email": email_fan, "password": "password123"})
    token_f = login_f.json()["access_token"]
    async_client.cookies.clear()  # so /auth/me uses Bearer only and returns creator
    me_c = await async_client.get("/auth/me", headers={"Authorization": f"Bearer {token_c}"})
    creator_id = me_c.json()["id"]
    await async_client.post(
        f"/creators/{creator_id}/follow",
        headers={"Authorization": f"Bearer {token_f}"},
    )
    r = await async_client.get(
        "/feed",
        params={"page": 1, "page_size": 10},
        headers={"Authorization": f"Bearer {token_f}"},
    )
    assert r.status_code == 200, r.json()
    data = r.json()
    assert "items" in data
    assert len(data["items"]) >= 1
    assert data["items"][0]["creator"]["handle"] == handle
    assert data["items"][0]["caption"] == "Feed post"
    assert "asset_ids" in data["items"][0]
    assert data["items"][0]["creator"].get("display_name") is not None
    assert "avatar_asset_id" in data["items"][0]["creator"]


@pytest.mark.asyncio
async def test_feed_empty_when_following_none(async_client: AsyncClient) -> None:
    """Feed returns empty when user follows no creators."""
    email = _unique_email()
    await async_client.post(
        "/auth/signup",
        json={"email": email, "password": "password123", "display_name": "Nobody"},
    )
    login = await async_client.post("/auth/login", json={"email": email, "password": "password123"})
    token = login.json()["access_token"]
    r = await async_client.get(
        "/feed",
        params={"page": 1, "page_size": 10},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert r.status_code == 200, r.json()
    data = r.json()
    assert data["items"] == []
    assert data["total"] == 0


@pytest.mark.asyncio
async def test_feed_ordering_newest_first(async_client: AsyncClient) -> None:
    """Feed returns posts ordered by created_at desc."""
    email_creator = _unique_email()
    email_fan = _unique_email()
    await async_client.post(
        "/auth/signup",
        json={"email": email_creator, "password": "password123", "display_name": "OrderCreator"},
    )
    login_c = await async_client.post("/auth/login", json={"email": email_creator, "password": "password123"})
    token_c = login_c.json()["access_token"]
    handle = f"order-{uuid.uuid4().hex[:8]}"
    await async_client.patch(
        "/creators/me",
        json={"handle": handle},
        headers={"Authorization": f"Bearer {token_c}"},
    )
    await async_client.post(
        "/posts",
        json={"type": "TEXT", "caption": "First", "visibility": "PUBLIC", "asset_ids": []},
        headers={"Authorization": f"Bearer {token_c}"},
    )
    await async_client.post(
        "/posts",
        json={"type": "TEXT", "caption": "Second", "visibility": "PUBLIC", "asset_ids": []},
        headers={"Authorization": f"Bearer {token_c}"},
    )
    await async_client.post(
        "/auth/signup",
        json={"email": email_fan, "password": "password123", "display_name": "OrderFan"},
    )
    login_f = await async_client.post("/auth/login", json={"email": email_fan, "password": "password123"})
    token_f = login_f.json()["access_token"]
    async_client.cookies.clear()
    me_c = await async_client.get("/auth/me", headers={"Authorization": f"Bearer {token_c}"})
    creator_id = me_c.json()["id"]
    await async_client.post(
        f"/creators/{creator_id}/follow",
        headers={"Authorization": f"Bearer {token_f}"},
    )
    r = await async_client.get(
        "/feed",
        params={"page": 1, "page_size": 10},
        headers={"Authorization": f"Bearer {token_f}"},
    )
    assert r.status_code == 200, r.json()
    items = r.json()["items"]
    assert len(items) >= 2
    assert items[0]["caption"] == "Second"
    assert items[1]["caption"] == "First"


@pytest.mark.asyncio
async def test_feed_includes_followers_visibility_for_follower(async_client: AsyncClient) -> None:
    """Follower sees FOLLOWERS posts in feed."""
    email_creator = _unique_email()
    email_fan = _unique_email()
    await async_client.post(
        "/auth/signup",
        json={"email": email_creator, "password": "password123", "display_name": "FollCreator"},
    )
    login_c = await async_client.post("/auth/login", json={"email": email_creator, "password": "password123"})
    token_c = login_c.json()["access_token"]
    handle = f"foll-{uuid.uuid4().hex[:8]}"
    await async_client.patch(
        "/creators/me",
        json={"handle": handle},
        headers={"Authorization": f"Bearer {token_c}"},
    )
    await async_client.post(
        "/posts",
        json={
            "type": "TEXT",
            "caption": "Followers only",
            "visibility": "FOLLOWERS",
            "asset_ids": [],
        },
        headers={"Authorization": f"Bearer {token_c}"},
    )
    await async_client.post(
        "/auth/signup",
        json={"email": email_fan, "password": "password123", "display_name": "FollFan"},
    )
    login_f = await async_client.post("/auth/login", json={"email": email_fan, "password": "password123"})
    token_f = login_f.json()["access_token"]
    async_client.cookies.clear()
    me_c = await async_client.get("/auth/me", headers={"Authorization": f"Bearer {token_c}"})
    creator_id = me_c.json()["id"]
    await async_client.post(
        f"/creators/{creator_id}/follow",
        headers={"Authorization": f"Bearer {token_f}"},
    )
    r = await async_client.get(
        "/feed",
        params={"page": 1, "page_size": 10},
        headers={"Authorization": f"Bearer {token_f}"},
    )
    assert r.status_code == 200, r.json()
    items = r.json()["items"]
    assert len(items) >= 1
    assert items[0]["visibility"] == "FOLLOWERS"
    assert items[0]["caption"] == "Followers only"


@pytest.mark.asyncio
async def test_feed_excludes_subscribers_from_follower(async_client: AsyncClient) -> None:
    """Follower without subscription does not see SUBSCRIBERS posts in feed."""
    email_creator = _unique_email()
    email_fan = _unique_email()
    await async_client.post(
        "/auth/signup",
        json={"email": email_creator, "password": "password123", "display_name": "SubCreator"},
    )
    login_c = await async_client.post("/auth/login", json={"email": email_creator, "password": "password123"})
    token_c = login_c.json()["access_token"]
    handle = f"sub-{uuid.uuid4().hex[:8]}"
    await async_client.patch(
        "/creators/me",
        json={"handle": handle},
        headers={"Authorization": f"Bearer {token_c}"},
    )
    await async_client.post(
        "/posts",
        json={
            "type": "TEXT",
            "caption": "Subscribers only",
            "visibility": "SUBSCRIBERS",
            "asset_ids": [],
        },
        headers={"Authorization": f"Bearer {token_c}"},
    )
    await async_client.post(
        "/auth/signup",
        json={"email": email_fan, "password": "password123", "display_name": "SubFan"},
    )
    login_f = await async_client.post("/auth/login", json={"email": email_fan, "password": "password123"})
    token_f = login_f.json()["access_token"]
    async_client.cookies.clear()
    me_c = await async_client.get("/auth/me", headers={"Authorization": f"Bearer {token_c}"})
    creator_id = me_c.json()["id"]
    await async_client.post(
        f"/creators/{creator_id}/follow",
        headers={"Authorization": f"Bearer {token_f}"},
    )
    r = await async_client.get(
        "/feed",
        params={"page": 1, "page_size": 10},
        headers={"Authorization": f"Bearer {token_f}"},
    )
    assert r.status_code == 200, r.json()
    items = r.json()["items"]
    sub_posts = [p for p in items if p.get("visibility") == "SUBSCRIBERS"]
    assert len(sub_posts) == 0


@pytest.mark.asyncio
async def test_subscriber_sees_subscribers_posts_on_creator_page(
    async_client: AsyncClient, db_session: AsyncSession
) -> None:
    """Active subscriber can see SUBSCRIBERS posts on creator profile."""
    email_creator = _unique_email()
    email_fan = _unique_email()
    await async_client.post(
        "/auth/signup",
        json={"email": email_creator, "password": "password123", "display_name": "SubCreator"},
    )
    login_c = await async_client.post("/auth/login", json={"email": email_creator, "password": "password123"})
    token_c = login_c.json()["access_token"]
    handle = f"sub2-{uuid.uuid4().hex[:8]}"
    await async_client.patch(
        "/creators/me",
        json={"handle": handle},
        headers={"Authorization": f"Bearer {token_c}"},
    )
    async_client.cookies.clear()
    me_c = await async_client.get("/auth/me", headers={"Authorization": f"Bearer {token_c}"})
    creator_id = me_c.json()["id"]
    await async_client.post(
        "/posts",
        json={
            "type": "TEXT",
            "caption": "Sub-only post",
            "visibility": "SUBSCRIBERS",
            "asset_ids": [],
        },
        headers={"Authorization": f"Bearer {token_c}"},
    )
    await async_client.post(
        "/auth/signup",
        json={"email": email_fan, "password": "password123", "display_name": "SubFan"},
    )
    login_f = await async_client.post("/auth/login", json={"email": email_fan, "password": "password123"})
    token_f = login_f.json()["access_token"]
    me_f = await async_client.get("/auth/me", headers={"Authorization": f"Bearer {token_f}"})
    fan_id = me_f.json()["id"]
    sub = Subscription(
        fan_user_id=fan_id,
        creator_user_id=creator_id,
        status="active",
        stripe_subscription_id=f"sub_test_{uuid.uuid4().hex}",
    )
    db_session.add(sub)
    await db_session.commit()
    r = await async_client.get(
        f"/creators/{handle}/posts",
        params={"page": 1, "page_size": 10},
        headers={"Authorization": f"Bearer {token_f}"},
    )
    assert r.status_code == 200, r.json()
    items = r.json()["items"]
    assert len(items) >= 1
    assert items[0]["visibility"] == "SUBSCRIBERS"
    assert items[0]["caption"] == "Sub-only post"
    assert items[0]["is_locked"] is False


@pytest.mark.asyncio
async def test_feed_includes_subscribers_for_creator(async_client: AsyncClient) -> None:
    """Creator sees their own SUBSCRIBERS posts in feed (own posts always included)."""
    email = _unique_email()
    await async_client.post(
        "/auth/signup",
        json={"email": email, "password": "password123", "display_name": "SelfCreator"},
    )
    login = await async_client.post("/auth/login", json={"email": email, "password": "password123"})
    token = login.json()["access_token"]
    handle = f"self-{uuid.uuid4().hex[:8]}"
    await async_client.patch(
        "/creators/me",
        json={"handle": handle},
        headers={"Authorization": f"Bearer {token}"},
    )
    await async_client.post(
        "/posts",
        json={
            "type": "TEXT",
            "caption": "My subscribers post",
            "visibility": "SUBSCRIBERS",
            "asset_ids": [],
        },
        headers={"Authorization": f"Bearer {token}"},
    )
    r = await async_client.get(
        "/feed",
        params={"page": 1, "page_size": 10},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert r.status_code == 200, r.json()
    items = r.json()["items"]
    assert len(items) >= 1
    assert items[0]["visibility"] == "SUBSCRIBERS"
    assert items[0]["caption"] == "My subscribers post"
