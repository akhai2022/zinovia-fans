from __future__ import annotations

import uuid
from datetime import datetime, timedelta, timezone

import pytest
from httpx import AsyncClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.settings import get_settings
from app.modules.media.models import MediaObject
from app.modules.notifications.models import Notification
from app.modules.posts.constants import POST_STATUS_PUBLISHED, POST_STATUS_SCHEDULED
from app.modules.posts.models import Post
from app.modules.posts.service import publish_due_scheduled_posts


def _email() -> str:
    return f"eng-{uuid.uuid4().hex[:10]}@test.com"


async def _signup_login(client: AsyncClient, email: str, display_name: str) -> str:
    await client.post(
        "/auth/signup",
        json={"email": email, "password": "password123", "display_name": display_name},
    )
    login = await client.post("/auth/login", json={"email": email, "password": "password123"})
    return login.json()["access_token"]


@pytest.fixture(autouse=True)
def enable_phase1_flags(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("ENABLE_LIKES", "true")
    monkeypatch.setenv("ENABLE_COMMENTS", "true")
    monkeypatch.setenv("ENABLE_NOTIFICATIONS", "true")
    monkeypatch.setenv("ENABLE_VAULT", "true")
    monkeypatch.setenv("ENABLE_SCHEDULED_POSTS", "true")
    get_settings.cache_clear()


@pytest.mark.asyncio
async def test_like_comment_and_permissions(async_client: AsyncClient) -> None:
    creator_token = await _signup_login(async_client, _email(), "Creator")
    fan_token = await _signup_login(async_client, _email(), "Fan")
    await async_client.patch(
        "/creators/me",
        json={"handle": f"eng-{uuid.uuid4().hex[:8]}"},
        headers={"Authorization": f"Bearer {creator_token}"},
    )
    created = await async_client.post(
        "/posts",
        json={"type": "TEXT", "caption": "hello", "visibility": "PUBLIC", "asset_ids": []},
        headers={"Authorization": f"Bearer {creator_token}"},
    )
    post_id = created.json()["id"]

    like_res = await async_client.post(
        f"/posts/{post_id}/like",
        headers={"Authorization": f"Bearer {fan_token}"},
    )
    assert like_res.status_code == 200
    summary = await async_client.get(
        f"/posts/{post_id}/likes",
        headers={"Authorization": f"Bearer {fan_token}"},
    )
    assert summary.status_code == 200
    assert summary.json()["count"] == 1
    assert summary.json()["viewer_liked"] is True

    comment_res = await async_client.post(
        f"/posts/{post_id}/comments",
        json={"body": "great post"},
        headers={"Authorization": f"Bearer {fan_token}"},
    )
    assert comment_res.status_code == 200
    comment_id = comment_res.json()["id"]

    list_res = await async_client.get(
        f"/posts/{post_id}/comments",
        headers={"Authorization": f"Bearer {creator_token}"},
    )
    assert list_res.status_code == 200
    assert len(list_res.json()["items"]) == 1

    delete_by_creator = await async_client.delete(
        f"/posts/comments/{comment_id}",
        headers={"Authorization": f"Bearer {creator_token}"},
    )
    assert delete_by_creator.status_code == 200


@pytest.mark.asyncio
async def test_notifications_read_flow(async_client: AsyncClient, db_session: AsyncSession) -> None:
    token = await _signup_login(async_client, _email(), "User")
    me = await async_client.get("/auth/me", headers={"Authorization": f"Bearer {token}"})
    user_id = uuid.UUID(me.json()["id"])
    db_session.add(
        Notification(
            user_id=user_id,
            type="NEW_DM_MESSAGE",
            payload_json={"conversation_id": str(uuid.uuid4())},
            created_at=datetime.now(timezone.utc),
        )
    )
    await db_session.commit()

    listed = await async_client.get("/notifications", headers={"Authorization": f"Bearer {token}"})
    assert listed.status_code == 200
    assert listed.json()["unread_count"] >= 1
    nid = listed.json()["items"][0]["id"]

    marked = await async_client.post(
        f"/notifications/{nid}/read",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert marked.status_code == 200

    read_all = await async_client.post("/notifications/read-all", headers={"Authorization": f"Bearer {token}"})
    assert read_all.status_code == 200


@pytest.mark.asyncio
async def test_vault_and_scheduled_publish(async_client: AsyncClient, db_session: AsyncSession) -> None:
    creator_token = await _signup_login(async_client, _email(), "Creator")
    await async_client.patch(
        "/creators/me",
        json={"handle": f"vault-{uuid.uuid4().hex[:8]}"},
        headers={"Authorization": f"Bearer {creator_token}"},
    )
    me = await async_client.get("/auth/me", headers={"Authorization": f"Bearer {creator_token}"})
    creator_id = uuid.UUID(me.json()["id"])
    media = MediaObject(
        owner_user_id=creator_id,
        object_key=f"vault/{uuid.uuid4().hex}.jpg",
        content_type="image/jpeg",
        size_bytes=32,
    )
    db_session.add(media)
    await db_session.commit()

    vault = await async_client.get("/media/mine", headers={"Authorization": f"Bearer {creator_token}"})
    assert vault.status_code == 200
    assert len(vault.json()["items"]) >= 1

    publish_at = (datetime.now(timezone.utc) + timedelta(minutes=5)).isoformat()
    scheduled = await async_client.post(
        "/posts",
        json={
            "type": "TEXT",
            "caption": "later",
            "visibility": "PUBLIC",
            "asset_ids": [],
            "publish_at": publish_at,
        },
        headers={"Authorization": f"Bearer {creator_token}"},
    )
    assert scheduled.status_code == 201, scheduled.json()
    assert scheduled.json()["status"] == POST_STATUS_SCHEDULED
    post_id = scheduled.json()["id"]

    post_uuid = uuid.UUID(post_id)
    post = (await db_session.execute(select(Post).where(Post.id == post_uuid))).scalar_one()
    post.publish_at = datetime.now(timezone.utc) - timedelta(seconds=1)
    await db_session.commit()

    published_count = await publish_due_scheduled_posts(db_session)
    assert published_count >= 1
    updated = (await db_session.execute(select(Post).where(Post.id == post_uuid))).scalar_one()
    assert updated.status == POST_STATUS_PUBLISHED

