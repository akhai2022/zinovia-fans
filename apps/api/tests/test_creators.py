from __future__ import annotations

import uuid

import pytest
from httpx import AsyncClient
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.auth.models import User
from conftest import signup_verify_login


def _unique_email() -> str:
    return f"test-{uuid.uuid4().hex[:12]}@test.com"


@pytest.mark.asyncio
async def test_create_creator_profile_and_get_by_handle(
    async_client: AsyncClient,
) -> None:
    email = _unique_email()
    token = await signup_verify_login(async_client, email, display_name="Alice")
    handle = f"alice-{uuid.uuid4().hex[:8]}"
    headers = {"Authorization": f"Bearer {token}"}
    r = await async_client.patch(
        "/creators/me",
        json={"handle": handle},
        headers=headers,
    )
    assert r.status_code == 200, r.json()
    data = r.json()
    assert data["handle"] == handle
    assert data["followers_count"] == 0
    r = await async_client.get(f"/creators/{handle}")
    assert r.status_code == 200
    assert r.json()["handle"] == handle
    assert r.json()["display_name"] == "Alice"


@pytest.mark.asyncio
async def test_follow_unfollow_idempotency(
    async_client: AsyncClient,
) -> None:
    email_bob = _unique_email()
    email_fan = _unique_email()
    token2 = await signup_verify_login(async_client, email_bob, display_name="Bob")
    handle_bob = f"bob-{uuid.uuid4().hex[:8]}"
    await async_client.patch("/creators/me", json={"handle": handle_bob}, headers={"Authorization": f"Bearer {token2}"})
    token_fan = await signup_verify_login(async_client, email_fan, display_name="Fan")
    headers_fan = {"Authorization": f"Bearer {token_fan}"}
    async_client.cookies.clear()  # so /auth/me uses Bearer only and returns Bob
    me_bob = await async_client.get("/auth/me", headers={"Authorization": f"Bearer {token2}"})
    bob_id = me_bob.json()["id"]
    r = await async_client.post(f"/creators/{bob_id}/follow", headers=headers_fan)
    assert r.status_code == 200
    assert r.json()["status"] == "following"
    r2 = await async_client.post(f"/creators/{bob_id}/follow", headers=headers_fan)
    assert r2.status_code == 200
    assert r2.json()["status"] == "already_following"
    r = await async_client.get(f"/creators/{handle_bob}", headers=headers_fan)
    assert r.json()["is_following"] is True
    r = await async_client.delete(f"/creators/{bob_id}/follow", headers=headers_fan)
    assert r.status_code == 200
    assert r.json()["status"] == "unfollowed"
    r = await async_client.delete(f"/creators/{bob_id}/follow", headers=headers_fan)
    assert r.status_code == 200
    assert r.json()["status"] == "not_following"
    r = await async_client.get(f"/creators/{handle_bob}", headers=headers_fan)
    assert r.json()["is_following"] is False


@pytest.mark.asyncio
async def test_self_follow_rejected(
    async_client: AsyncClient,
) -> None:
    email = _unique_email()
    token = await signup_verify_login(async_client, email, display_name="Self")
    me = await async_client.get("/auth/me", headers={"Authorization": f"Bearer {token}"})
    user_id = me.json()["id"]
    r = await async_client.post(f"/creators/{user_id}/follow", headers={"Authorization": f"Bearer {token}"})
    assert r.status_code == 400
    assert r.json()["detail"]["code"] == "cannot_follow_self"


@pytest.mark.asyncio
async def test_reserved_handle_rejected(
    async_client: AsyncClient,
) -> None:
    email = _unique_email()
    token = await signup_verify_login(async_client, email, display_name="Reserved")
    r = await async_client.patch(
        "/creators/me",
        json={"handle": "admin"},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert r.status_code == 400
    assert r.json()["detail"]["code"] == "handle_reserved"


@pytest.mark.asyncio
async def test_handle_format_invalid(
    async_client: AsyncClient,
) -> None:
    email = _unique_email()
    token = await signup_verify_login(async_client, email, display_name="Format")
    r = await async_client.patch(
        "/creators/me",
        json={"handle": "a"},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert r.status_code in (400, 422)
    if r.status_code == 400:
        assert r.json()["detail"]["code"] in ("handle_length_invalid", "handle_format_invalid")


@pytest.mark.asyncio
async def test_non_creator_cannot_patch_me(
    async_client: AsyncClient,
    db_session: AsyncSession,
) -> None:
    email = _unique_email()
    token = await signup_verify_login(async_client, email, display_name="FanRole")
    result = await db_session.execute(select(User).where(User.email == email))
    user = result.scalar_one()
    await db_session.execute(update(User).where(User.id == user.id).values(role="fan"))
    await db_session.commit()
    r = await async_client.patch(
        "/creators/me",
        json={"handle": "fanuser"},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert r.status_code == 403
    assert r.json()["detail"]["code"] == "creator_only"


@pytest.mark.asyncio
async def test_creators_get_me_creator_returns_200(
    async_client: AsyncClient,
) -> None:
    """GET /creators/me returns 200 and profile for creator; route is before /{handle}."""
    email = _unique_email()
    token = await signup_verify_login(async_client, email, display_name="MeCreator")
    handle = f"mecre-{uuid.uuid4().hex[:8]}"
    await async_client.patch(
        "/creators/me",
        json={"handle": handle, "bio": "My bio"},
        headers={"Authorization": f"Bearer {token}"},
    )
    r = await async_client.get("/creators/me", headers={"Authorization": f"Bearer {token}"})
    assert r.status_code == 200, r.json()
    data = r.json()
    assert data["handle"] == handle
    assert data["display_name"] == "MeCreator"
    assert data["bio"] == "My bio"
    assert "followers_count" in data
    assert "posts_count" in data


@pytest.mark.asyncio
async def test_creators_get_me_route_before_handle(
    async_client: AsyncClient,
) -> None:
    """GET /creators/me without auth returns 401 (proves /me is matched, not /{handle})."""
    async_client.cookies.clear()
    r = await async_client.get("/creators/me")
    assert r.status_code == 401, "unauthenticated /creators/me must hit /me route (401), not /{handle} (404)"


@pytest.mark.asyncio
async def test_creators_get_me_fan_returns_403(
    async_client: AsyncClient,
    db_session: AsyncSession,
) -> None:
    """GET /creators/me returns 403 for fan user."""
    email = _unique_email()
    token = await signup_verify_login(async_client, email, display_name="Fan")
    result = await db_session.execute(select(User).where(User.email == email))
    user = result.scalar_one()
    await db_session.execute(update(User).where(User.id == user.id).values(role="fan"))
    await db_session.commit()
    r = await async_client.get("/creators/me", headers={"Authorization": f"Bearer {token}"})
    assert r.status_code == 403
    assert r.json()["detail"]["code"] == "creator_only"


@pytest.mark.asyncio
async def test_me_following_paginated(
    async_client: AsyncClient,
) -> None:
    email = _unique_email()
    token = await signup_verify_login(async_client, email, display_name="ListFan")
    r = await async_client.get("/creators/me/following", headers={"Authorization": f"Bearer {token}"}, params={"page": 1, "page_size": 10})
    assert r.status_code == 200
    data = r.json()
    assert "items" in data
    assert "total" in data
    assert data["page"] == 1
    assert data["page_size"] == 10


@pytest.mark.asyncio
async def test_discoverable_enforcement(
    async_client: AsyncClient,
) -> None:
    email = _unique_email()
    token = await signup_verify_login(async_client, email, display_name="Hidden")
    handle = f"hidden-{uuid.uuid4().hex[:8]}"
    await async_client.patch(
        "/creators/me",
        json={"handle": handle, "discoverable": False},
        headers={"Authorization": f"Bearer {token}"},
    )
    r = await async_client.get(f"/creators/{handle}")
    assert r.status_code == 404
    await async_client.patch(
        "/creators/me",
        json={"discoverable": True},
        headers={"Authorization": f"Bearer {token}"},
    )
    r = await async_client.get(f"/creators/{handle}")
    assert r.status_code == 200
    assert r.json()["handle"] == handle


@pytest.mark.asyncio
async def test_followers_count_correct(
    async_client: AsyncClient,
) -> None:
    email_creator = _unique_email()
    email_fan = _unique_email()
    token_c = await signup_verify_login(async_client, email_creator, display_name="CountCreator")
    handle = f"count-{uuid.uuid4().hex[:8]}"
    await async_client.patch(
        "/creators/me",
        json={"handle": handle},
        headers={"Authorization": f"Bearer {token_c}"},
    )
    r = await async_client.get(f"/creators/{handle}")
    assert r.status_code == 200
    assert r.json()["followers_count"] == 0
    token_f = await signup_verify_login(async_client, email_fan, display_name="CountFan")
    async_client.cookies.clear()  # so /auth/me uses Bearer only and returns creator
    me_c = await async_client.get("/auth/me", headers={"Authorization": f"Bearer {token_c}"})
    creator_id = me_c.json()["id"]
    await async_client.post(
        f"/creators/{creator_id}/follow",
        headers={"Authorization": f"Bearer {token_f}"},
    )
    r = await async_client.get(f"/creators/{handle}")
    assert r.status_code == 200
    assert r.json()["followers_count"] == 1
    await async_client.delete(
        f"/creators/{creator_id}/follow",
        headers={"Authorization": f"Bearer {token_f}"},
    )
    r = await async_client.get(f"/creators/{handle}")
    assert r.status_code == 200
    assert r.json()["followers_count"] == 0


@pytest.mark.asyncio
async def test_creator_profile_posts_count(
    async_client: AsyncClient,
) -> None:
    """GET /creators/{handle} and PATCH /creators/me return posts_count from posts table."""
    email = _unique_email()
    token = await signup_verify_login(async_client, email, display_name="Author")
    headers = {"Authorization": f"Bearer {token}"}
    handle = f"author-{uuid.uuid4().hex[:8]}"
    await async_client.patch("/creators/me", json={"handle": handle}, headers=headers)

    for _ in range(2):
        await async_client.post(
            "/posts",
            json={
                "type": "TEXT",
                "caption": "A post",
                "visibility": "PUBLIC",
                "nsfw": False,
                "asset_ids": [],
            },
            headers=headers,
        )

    r = await async_client.get(f"/creators/{handle}")
    assert r.status_code == 200, r.json()
    assert r.json()["posts_count"] == 2

    r = await async_client.patch("/creators/me", json={}, headers=headers)
    assert r.status_code == 200, r.json()
    assert r.json()["posts_count"] == 2


@pytest.mark.asyncio
async def test_creators_list_discoverable_only(
    async_client: AsyncClient,
) -> None:
    """GET /creators returns only discoverable creators; non-discoverable excluded."""
    r0 = await async_client.get("/creators", params={"page": 1, "page_size": 100})
    assert r0.status_code == 200
    total_before = r0.json()["total"]
    handles_before = {item["handle"] for item in r0.json()["items"]}

    email_hid = _unique_email()
    token_hid = await signup_verify_login(async_client, email_hid, display_name="Hidden")
    handle_hid = f"hid-{uuid.uuid4().hex[:8]}"
    await async_client.patch(
        "/creators/me",
        json={"handle": handle_hid, "discoverable": False},
        headers={"Authorization": f"Bearer {token_hid}"},
    )
    r = await async_client.get("/creators", params={"page": 1, "page_size": 100})
    assert r.status_code == 200, r.json()
    data = r.json()
    assert data["total"] == total_before, "adding non-discoverable should not increase list total"
    handles = {item["handle"] for item in data["items"]}
    assert handle_hid not in handles, "non-discoverable creator must not be in list"

    email_vis = _unique_email()
    token_vis = await signup_verify_login(async_client, email_vis, display_name="Visible")
    handle_vis = f"vis-{uuid.uuid4().hex[:8]}"
    await async_client.patch(
        "/creators/me",
        json={"handle": handle_vis, "discoverable": True},
        headers={"Authorization": f"Bearer {token_vis}"},
    )
    r2 = await async_client.get("/creators", params={"page": 1, "page_size": 100})
    assert r2.status_code == 200
    data2 = r2.json()
    assert data2["total"] == total_before + 1, "adding discoverable should increase total by 1"
    # Find handle_vis in paginated results (order is created_at desc; may span pages if total > 100)
    found_vis = False
    page = 1
    while True:
        r_page = await async_client.get("/creators", params={"page": page, "page_size": 100})
        assert r_page.status_code == 200
        items = r_page.json()["items"]
        if not items:
            break
        for item in items:
            if item["handle"] == handle_vis:
                found_vis = True
                break
            assert item["handle"] != handle_hid, "non-discoverable creator must not appear"
        if found_vis:
            break
        page += 1
        if page * 100 >= data2["total"]:
            break
    assert found_vis, "discoverable creator should be in list"


@pytest.mark.asyncio
async def test_creators_list_pagination(
    async_client: AsyncClient,
) -> None:
    """GET /creators pagination works; counts are integers >= 0."""
    for i in range(3):
        email = _unique_email()
        token = await signup_verify_login(async_client, email, display_name=f"Creator{i}")
        await async_client.patch(
            "/creators/me",
            json={"handle": f"pag-{uuid.uuid4().hex[:8]}"},
            headers={"Authorization": f"Bearer {token}"},
        )
    r = await async_client.get("/creators", params={"page": 1, "page_size": 2})
    assert r.status_code == 200, r.json()
    data = r.json()
    assert data["total"] >= 3
    assert len(data["items"]) == 2
    assert data["page"] == 1
    assert data["page_size"] == 2
    for item in data["items"]:
        assert isinstance(item["followers_count"], int)
        assert item["followers_count"] >= 0
        assert isinstance(item["posts_count"], int)
        assert item["posts_count"] >= 0
    r2 = await async_client.get("/creators", params={"page": 2, "page_size": 2})
    assert r2.status_code == 200
    assert len(r2.json()["items"]) >= 1


async def _signup_creator(
    async_client: AsyncClient,
    handle: str,
    display_name: str,
    discoverable: bool = True,
) -> str:
    """Create a creator with given handle and display_name; returns handle."""
    email = _unique_email()
    token = await signup_verify_login(async_client, email, display_name=display_name)
    await async_client.patch(
        "/creators/me",
        json={"handle": handle, "discoverable": discoverable},
        headers={"Authorization": f"Bearer {token}"},
    )
    return handle


@pytest.mark.asyncio
async def test_creators_list_search(
    async_client: AsyncClient,
) -> None:
    """GET /creators?q= filters by handle or display_name (ILIKE); discoverable-only; pagination."""
    suffix = uuid.uuid4().hex[:8]
    handle_alice = f"alice-{suffix}"
    handle_bob = f"bob-{suffix}"
    handle_charlie = f"charlie-{suffix}"
    handle_charlie2 = f"charlie-two-{suffix}"
    await _signup_creator(async_client, handle_alice, "Alice", discoverable=True)
    await _signup_creator(async_client, handle_bob, "Bob", discoverable=True)
    await _signup_creator(async_client, handle_charlie, "Charlie", discoverable=True)
    await _signup_creator(async_client, handle_charlie2, "Charlie Two", discoverable=True)

    r = await async_client.get("/creators", params={"page": 1, "page_size": 10, "q": "ali"})
    assert r.status_code == 200, r.json()
    data = r.json()
    assert data["total"] >= 1
    handles = [item["handle"] for item in data["items"]]
    assert handle_alice in handles
    assert handle_bob not in handles
    assert handle_charlie not in handles

    r2 = await async_client.get("/creators", params={"page": 1, "page_size": 10, "q": "BO"})
    assert r2.status_code == 200
    data2 = r2.json()
    assert data2["total"] >= 1
    handles2 = [item["handle"] for item in data2["items"]]
    assert handle_bob in handles2
    assert handle_alice not in handles2

    handle_hidden = f"bob-hidden-{suffix}"
    await _signup_creator(async_client, handle_hidden, "Bob Hidden", discoverable=False)
    r3 = await async_client.get("/creators", params={"page": 1, "page_size": 100, "q": "bob"})
    assert r3.status_code == 200
    handles3 = [item["handle"] for item in r3.json()["items"]]
    assert handle_bob in handles3
    assert handle_hidden not in handles3

    r4 = await async_client.get("/creators", params={"page": 1, "page_size": 1, "q": "charlie"})
    assert r4.status_code == 200
    data4 = r4.json()
    assert data4["total"] >= 2
    assert len(data4["items"]) == 1
    assert data4["page"] == 1
    assert data4["page_size"] == 1
    r5 = await async_client.get("/creators", params={"page": 2, "page_size": 1, "q": "charlie"})
    assert r5.status_code == 200
    data5 = r5.json()
    assert len(data5["items"]) >= 1
    assert data5["page"] == 2
