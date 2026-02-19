"""Collections CRUD: create, list, get, update, delete, add/remove posts."""

from __future__ import annotations

import uuid

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.media.models import MediaObject
from conftest import signup_verify_login


def _email() -> str:
    return f"col-{uuid.uuid4().hex[:12]}@test.com"


async def _creator_with_handle(
    client: AsyncClient, email: str | None = None
) -> tuple[str, str]:
    """Create a verified creator with handle. Returns (token, handle)."""
    email = email or _email()
    token = await signup_verify_login(client, email, display_name="Creator")
    handle = f"col-{uuid.uuid4().hex[:8]}"
    await client.patch(
        "/creators/me",
        json={"handle": handle},
        headers={"Authorization": f"Bearer {token}"},
    )
    return token, handle


@pytest.mark.asyncio
async def test_create_collection(async_client: AsyncClient) -> None:
    """POST /collections returns 201 with title and visibility."""
    token, _ = await _creator_with_handle(async_client)
    r = await async_client.post(
        "/collections",
        json={"title": "Best Pics", "visibility": "PUBLIC"},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert r.status_code == 201, r.json()
    data = r.json()
    assert data["title"] == "Best Pics"
    assert data["visibility"] == "PUBLIC"
    assert data["post_count"] == 0
    assert "id" in data


@pytest.mark.asyncio
async def test_list_collections(async_client: AsyncClient) -> None:
    """GET /collections returns items and total."""
    token, _ = await _creator_with_handle(async_client)
    await async_client.post(
        "/collections",
        json={"title": "A"},
        headers={"Authorization": f"Bearer {token}"},
    )
    await async_client.post(
        "/collections",
        json={"title": "B"},
        headers={"Authorization": f"Bearer {token}"},
    )
    r = await async_client.get(
        "/collections",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert r.status_code == 200, r.json()
    data = r.json()
    assert data["total"] >= 2
    titles = [c["title"] for c in data["items"]]
    assert "A" in titles
    assert "B" in titles


@pytest.mark.asyncio
async def test_get_collection(async_client: AsyncClient) -> None:
    """GET /collections/{id} returns 200."""
    token, _ = await _creator_with_handle(async_client)
    created = await async_client.post(
        "/collections",
        json={"title": "Single"},
        headers={"Authorization": f"Bearer {token}"},
    )
    cid = created.json()["id"]
    r = await async_client.get(
        f"/collections/{cid}",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert r.status_code == 200
    assert r.json()["title"] == "Single"


@pytest.mark.asyncio
async def test_update_collection(async_client: AsyncClient) -> None:
    """PATCH /collections/{id} updates title."""
    token, _ = await _creator_with_handle(async_client)
    created = await async_client.post(
        "/collections",
        json={"title": "Old Title"},
        headers={"Authorization": f"Bearer {token}"},
    )
    cid = created.json()["id"]
    r = await async_client.patch(
        f"/collections/{cid}",
        json={"title": "New Title"},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert r.status_code == 200
    assert r.json()["title"] == "New Title"


@pytest.mark.asyncio
async def test_delete_collection(async_client: AsyncClient) -> None:
    """DELETE /collections/{id} returns 204."""
    token, _ = await _creator_with_handle(async_client)
    created = await async_client.post(
        "/collections",
        json={"title": "ToDelete"},
        headers={"Authorization": f"Bearer {token}"},
    )
    cid = created.json()["id"]
    r = await async_client.delete(
        f"/collections/{cid}",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert r.status_code == 204

    r2 = await async_client.get(
        f"/collections/{cid}",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert r2.status_code == 404


@pytest.mark.asyncio
async def test_add_post_to_collection(
    async_client: AsyncClient, db_session: AsyncSession
) -> None:
    """POST /collections/{id}/posts adds a post → 201."""
    token, _ = await _creator_with_handle(async_client)
    col = await async_client.post(
        "/collections",
        json={"title": "With Posts"},
        headers={"Authorization": f"Bearer {token}"},
    )
    cid = col.json()["id"]

    post_r = await async_client.post(
        "/posts",
        json={"type": "TEXT", "caption": "Hello", "visibility": "PUBLIC", "asset_ids": []},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert post_r.status_code == 201, post_r.json()
    pid = post_r.json()["id"]

    r = await async_client.post(
        f"/collections/{cid}/posts",
        json={"post_id": pid},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert r.status_code == 201, r.json()
    assert r.json()["post_id"] == pid


@pytest.mark.asyncio
async def test_list_collection_posts(async_client: AsyncClient) -> None:
    """GET /collections/{id}/posts returns ordered posts."""
    token, _ = await _creator_with_handle(async_client)
    col = await async_client.post(
        "/collections",
        json={"title": "Ordered"},
        headers={"Authorization": f"Bearer {token}"},
    )
    cid = col.json()["id"]

    for caption in ("First", "Second"):
        p = await async_client.post(
            "/posts",
            json={"type": "TEXT", "caption": caption, "visibility": "PUBLIC", "asset_ids": []},
            headers={"Authorization": f"Bearer {token}"},
        )
        await async_client.post(
            f"/collections/{cid}/posts",
            json={"post_id": p.json()["id"]},
            headers={"Authorization": f"Bearer {token}"},
        )

    r = await async_client.get(
        f"/collections/{cid}/posts",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert r.status_code == 200
    assert len(r.json()) == 2


@pytest.mark.asyncio
async def test_remove_post_from_collection(async_client: AsyncClient) -> None:
    """DELETE /collections/{id}/posts/{post_id} returns 204."""
    token, _ = await _creator_with_handle(async_client)
    col = await async_client.post(
        "/collections",
        json={"title": "RemoveTest"},
        headers={"Authorization": f"Bearer {token}"},
    )
    cid = col.json()["id"]
    post_r = await async_client.post(
        "/posts",
        json={"type": "TEXT", "caption": "Remove me", "visibility": "PUBLIC", "asset_ids": []},
        headers={"Authorization": f"Bearer {token}"},
    )
    pid = post_r.json()["id"]
    await async_client.post(
        f"/collections/{cid}/posts",
        json={"post_id": pid},
        headers={"Authorization": f"Bearer {token}"},
    )

    r = await async_client.delete(
        f"/collections/{cid}/posts/{pid}",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert r.status_code == 204

    posts = await async_client.get(
        f"/collections/{cid}/posts",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert len(posts.json()) == 0


@pytest.mark.asyncio
async def test_collections_require_auth(async_client: AsyncClient) -> None:
    """Collections endpoints return 401 without auth."""
    r = await async_client.get("/collections")
    assert r.status_code == 401

    r = await async_client.post("/collections", json={"title": "X"})
    assert r.status_code == 401
