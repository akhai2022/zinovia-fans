"""Billing tests: webhook idempotency, subscription visibility, checkout 501 (no Stripe API calls)."""

from __future__ import annotations

import uuid
from uuid import UUID

import pytest
from httpx import AsyncClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.settings import get_settings
from app.modules.billing.models import StripeEvent, Subscription


def _unique_email() -> str:
    return f"test-{uuid.uuid4().hex[:12]}@test.com"


@pytest.mark.asyncio
async def test_checkout_returns_501_when_stripe_not_configured(
    async_client: AsyncClient,
) -> None:
    """POST /billing/checkout/subscription returns 501 with clear message when Stripe keys not configured."""
    fan_email = _unique_email()
    creator_email = _unique_email()
    await async_client.post(
        "/auth/signup",
        json={"email": fan_email, "password": "password123", "display_name": "Fan"},
    )
    await async_client.post(
        "/auth/signup",
        json={"email": creator_email, "password": "password123", "display_name": "Creator"},
    )
    login_c = await async_client.post(
        "/auth/login", json={"email": creator_email, "password": "password123"}
    )
    token_c = login_c.json()["access_token"]
    handle = f"chk-{uuid.uuid4().hex[:8]}"
    await async_client.patch(
        "/creators/me",
        json={"handle": handle},
        headers={"Authorization": f"Bearer {token_c}"},
    )
    login_f = await async_client.post(
        "/auth/login", json={"email": fan_email, "password": "password123"}
    )
    token_f = login_f.json()["access_token"]
    r = await async_client.post(
        "/billing/checkout/subscription",
        json={"creator_handle": handle},
        headers={"Authorization": f"Bearer {token_f}"},
    )
    assert r.status_code == 501
    data = r.json()
    assert "detail" in data
    assert "stripe" in data["detail"].lower() or "configured" in data["detail"].lower()


@pytest.mark.asyncio
async def test_webhook_stripe_idempotent_duplicate_ignored(
    async_client: AsyncClient,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Same event_id sent twice: first processed, second returns duplicate_ignored (test bypass)."""
    monkeypatch.setenv("STRIPE_WEBHOOK_TEST_BYPASS", "true")
    get_settings.cache_clear()
    try:
        event_id = f"evt_test_{uuid.uuid4().hex}"
        body = {
            "id": event_id,
            "type": "invoice.paid",
            "data": {"object": {"id": "in_xxx", "subscription": None, "amount_paid": 0}},
        }
        r1 = await async_client.post(
            "/billing/webhooks/stripe",
            json=body,
            headers={"Stripe-Signature": "bypass"},
        )
        assert r1.status_code == 200
        data1 = r1.json()
        assert data1["status"] in ("processed", "duplicate_ignored")

        r2 = await async_client.post(
            "/billing/webhooks/stripe",
            json=body,
            headers={"Stripe-Signature": "bypass"},
        )
        assert r2.status_code == 200
        assert r2.json()["status"] == "duplicate_ignored"
    finally:
        get_settings.cache_clear()


@pytest.mark.asyncio
async def test_subscriber_sees_subscribers_posts(
    async_client: AsyncClient,
    db_session: AsyncSession,
) -> None:
    """Creator + SUBSCRIBERS post; active subscription row: fan sees post (no Stripe API)."""
    email_creator = _unique_email()
    email_fan = _unique_email()
    await async_client.post(
        "/auth/signup",
        json={"email": email_creator, "password": "password123", "display_name": "Creator"},
    )
    login_c = await async_client.post(
        "/auth/login", json={"email": email_creator, "password": "password123"}
    )
    token_c = login_c.json()["access_token"]
    handle = f"sub-{uuid.uuid4().hex[:8]}"
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
            "caption": "Sub-only",
            "visibility": "SUBSCRIBERS",
            "asset_ids": [],
        },
        headers={"Authorization": f"Bearer {token_c}"},
    )
    await async_client.post(
        "/auth/signup",
        json={"email": email_fan, "password": "password123", "display_name": "Fan"},
    )
    login_f = await async_client.post(
        "/auth/login", json={"email": email_fan, "password": "password123"}
    )
    token_f = login_f.json()["access_token"]
    me_f = await async_client.get("/auth/me", headers={"Authorization": f"Bearer {token_f}"})
    fan_id = me_f.json()["id"]

    sub = Subscription(
        fan_user_id=UUID(fan_id) if isinstance(fan_id, str) else fan_id,
        creator_user_id=UUID(creator_id) if isinstance(creator_id, str) else creator_id,
        status="active",
        stripe_subscription_id=f"sub_{uuid.uuid4().hex}",
    )
    db_session.add(sub)
    await db_session.commit()

    r_fan = await async_client.get(
        f"/creators/{handle}/posts",
        params={"page": 1, "page_size": 10},
        headers={"Authorization": f"Bearer {token_f}"},
    )
    assert r_fan.status_code == 200
    items_fan = r_fan.json()["items"]
    assert len(items_fan) >= 1
    assert items_fan[0]["visibility"] == "SUBSCRIBERS"


@pytest.mark.asyncio
async def test_non_subscriber_cannot_see_subscribers_posts(
    async_client: AsyncClient,
) -> None:
    """Creator + SUBSCRIBERS post; fan with no subscription does not see it (creator page and feed)."""
    email_creator = _unique_email()
    email_fan = _unique_email()
    await async_client.post(
        "/auth/signup",
        json={"email": email_creator, "password": "password123", "display_name": "Creator"},
    )
    login_c = await async_client.post(
        "/auth/login", json={"email": email_creator, "password": "password123"}
    )
    token_c = login_c.json()["access_token"]
    handle = f"nosub-{uuid.uuid4().hex[:8]}"
    await async_client.patch(
        "/creators/me",
        json={"handle": handle},
        headers={"Authorization": f"Bearer {token_c}"},
    )
    await async_client.post(
        "/posts",
        json={
            "type": "TEXT",
            "caption": "Sub-only",
            "visibility": "SUBSCRIBERS",
            "asset_ids": [],
        },
        headers={"Authorization": f"Bearer {token_c}"},
    )
    await async_client.post(
        "/auth/signup",
        json={"email": email_fan, "password": "password123", "display_name": "Fan"},
    )
    login_f = await async_client.post(
        "/auth/login", json={"email": email_fan, "password": "password123"}
    )
    token_f = login_f.json()["access_token"]

    r_creator_page = await async_client.get(
        f"/creators/{handle}/posts",
        params={"page": 1, "page_size": 10, "include_locked": False},
        headers={"Authorization": f"Bearer {token_f}"},
    )
    assert r_creator_page.status_code == 200
    items_page = r_creator_page.json()["items"]
    assert len(items_page) == 0, "Non-subscriber with include_locked=false must not see SUBSCRIBERS posts"

    async_client.cookies.clear()
    me_c = await async_client.get("/auth/me", headers={"Authorization": f"Bearer {token_c}"})
    creator_id = me_c.json()["id"]
    await async_client.post(
        f"/creators/{creator_id}/follow",
        headers={"Authorization": f"Bearer {token_f}"},
    )
    r_feed = await async_client.get(
        "/feed",
        params={"page": 1, "page_size": 10},
        headers={"Authorization": f"Bearer {token_f}"},
    )
    assert r_feed.status_code == 200
    items_feed = r_feed.json()["items"]
    sub_in_feed = [p for p in items_feed if p.get("visibility") == "SUBSCRIBERS"]
    assert len(sub_in_feed) == 0, "Follower without subscription must not see SUBSCRIBERS posts in feed"


@pytest.mark.asyncio
async def test_webhook_missing_signature_returns_400(
    async_client: AsyncClient,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """POST /billing/webhooks/stripe without Stripe-Signature returns 400 when bypass is off."""
    monkeypatch.setenv("STRIPE_WEBHOOK_TEST_BYPASS", "false")
    monkeypatch.setenv("STRIPE_WEBHOOK_SECRET", "whsec_test")
    get_settings.cache_clear()
    try:
        r = await async_client.post(
            "/billing/webhooks/stripe",
            json={"id": "evt_1", "type": "checkout.session.completed"},
            headers={},
        )
        assert r.status_code == 400
        assert "missing_signature" in (r.json().get("detail") or "")
    finally:
        get_settings.cache_clear()


@pytest.mark.asyncio
async def test_webhook_no_secret_returns_501(
    async_client: AsyncClient,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """POST /billing/webhooks/stripe when STRIPE_WEBHOOK_SECRET is not set returns 501."""
    monkeypatch.setenv("STRIPE_WEBHOOK_TEST_BYPASS", "false")
    monkeypatch.setenv("STRIPE_WEBHOOK_SECRET", "")
    get_settings.cache_clear()
    try:
        r = await async_client.post(
            "/billing/webhooks/stripe",
            json={"id": "evt_1", "type": "ping"},
            headers={"Stripe-Signature": "x"},
        )
        assert r.status_code == 501
        assert "stripe" in (r.json().get("detail") or "").lower() or "configured" in (r.json().get("detail") or "").lower()
    finally:
        get_settings.cache_clear()


@pytest.mark.asyncio
async def test_webhook_checkout_session_completed_upserts_subscription(
    async_client: AsyncClient,
    db_session: AsyncSession,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """With bypass: valid checkout.session.completed creates event row and subscription (ACTIVE). No Stripe network."""
    monkeypatch.setenv("STRIPE_WEBHOOK_TEST_BYPASS", "true")
    get_settings.cache_clear()
    email_creator = _unique_email()
    email_fan = _unique_email()
    await async_client.post(
        "/auth/signup",
        json={"email": email_creator, "password": "password123", "display_name": "Creator"},
    )
    login_c = await async_client.post("/auth/login", json={"email": email_creator, "password": "password123"})
    me_c = await async_client.get("/auth/me", headers={"Authorization": f"Bearer {login_c.json()['access_token']}"})
    creator_id = me_c.json()["id"]
    await async_client.post(
        "/auth/signup",
        json={"email": email_fan, "password": "password123", "display_name": "Fan"},
    )
    login_f = await async_client.post("/auth/login", json={"email": email_fan, "password": "password123"})
    me_f = await async_client.get("/auth/me", headers={"Authorization": f"Bearer {login_f.json()['access_token']}"})
    fan_id = me_f.json()["id"]
    event_id = f"evt_cs_{uuid.uuid4().hex}"
    body = {
        "id": event_id,
        "type": "checkout.session.completed",
        "data": {
            "object": {
                "mode": "subscription",
                "subscription": None,
                "metadata": {"fan_user_id": fan_id, "creator_user_id": creator_id},
                "customer": "cus_mock",
            }
        },
    }
    try:
        r = await async_client.post(
            "/billing/webhooks/stripe",
            json=body,
            headers={"Stripe-Signature": "bypass"},
        )
        assert r.status_code == 200
        assert r.json()["status"] == "processed"

        result = await db_session.execute(select(StripeEvent).where(StripeEvent.event_id == event_id))
        ev = result.scalar_one_or_none()
        assert ev is not None

        result = await db_session.execute(
            select(Subscription).where(
                Subscription.fan_user_id == UUID(fan_id),
                Subscription.creator_user_id == UUID(creator_id),
            )
        )
        sub = result.scalar_one_or_none()
        assert sub is not None
        assert sub.status == "active"

        r2 = await async_client.post(
            "/billing/webhooks/stripe",
            json=body,
            headers={"Stripe-Signature": "bypass"},
        )
        assert r2.status_code == 200
        assert r2.json()["status"] == "duplicate_ignored"
    finally:
        get_settings.cache_clear()
