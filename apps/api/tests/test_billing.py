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
async def test_billing_status_returns_authenticated_fan_subscriptions(
    async_client: AsyncClient,
    db_session: AsyncSession,
) -> None:
    creator_email = _unique_email()
    fan_email = _unique_email()
    await async_client.post(
        "/auth/signup",
        json={"email": creator_email, "password": "password123", "display_name": "Creator"},
    )
    creator_login = await async_client.post(
        "/auth/login", json={"email": creator_email, "password": "password123"}
    )
    creator_token = creator_login.json()["access_token"]
    creator_me = await async_client.get(
        "/auth/me",
        headers={"Authorization": f"Bearer {creator_token}"},
    )
    creator_id = creator_me.json()["id"]

    await async_client.post(
        "/auth/signup",
        json={"email": fan_email, "password": "password123", "display_name": "Fan"},
    )
    fan_login = await async_client.post(
        "/auth/login", json={"email": fan_email, "password": "password123"}
    )
    fan_token = fan_login.json()["access_token"]
    fan_me = await async_client.get(
        "/auth/me",
        headers={"Authorization": f"Bearer {fan_token}"},
    )
    fan_id = fan_me.json()["id"]

    sub = Subscription(
        fan_user_id=UUID(fan_id),
        creator_user_id=UUID(creator_id),
        status="active",
        stripe_subscription_id=f"sub_{uuid.uuid4().hex}",
    )
    db_session.add(sub)
    await db_session.commit()

    response = await async_client.get(
        "/billing/status",
        headers={"Authorization": f"Bearer {fan_token}"},
    )
    assert response.status_code == 200
    payload = response.json()
    assert payload["fan_user_id"] == fan_id
    assert any(item["creator_user_id"] == creator_id for item in payload["items"])


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
async def test_webhook_valid_signature_accepted_with_mock_construct_event(
    async_client: AsyncClient,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    class _Evt:
        def __init__(self, event_id: str, event_type: str) -> None:
            self.id = event_id
            self.type = event_type

        def get(self, key: str, default: object = None) -> object:
            if key == "id":
                return self.id
            if key == "type":
                return self.type
            return default

    def _construct_event(*, payload: bytes, sig_header: str, secret: str) -> _Evt:
        assert payload
        assert sig_header
        assert secret == "whsec_primary"
        return _Evt(f"evt_{uuid.uuid4().hex}", "unknown.event.type")

    monkeypatch.setenv("STRIPE_WEBHOOK_TEST_BYPASS", "false")
    monkeypatch.setenv("STRIPE_WEBHOOK_SECRET", "whsec_primary")
    monkeypatch.setattr(
        "app.modules.billing.service.stripe.Webhook.construct_event",
        _construct_event,
    )
    get_settings.cache_clear()
    try:
        response = await async_client.post(
            "/billing/webhooks/stripe",
            content=b'{"ok":true}',
            headers={"Stripe-Signature": "t=1,v1=fakesig"},
        )
        assert response.status_code == 200
        assert response.json()["status"] == "ignored"
    finally:
        get_settings.cache_clear()


@pytest.mark.asyncio
async def test_webhook_invalid_signature_rejected(
    async_client: AsyncClient,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    import stripe

    def _construct_event(*, payload: bytes, sig_header: str, secret: str):
        raise stripe.error.SignatureVerificationError(
            message="bad sig",
            sig_header=sig_header,
            http_body=payload.decode("utf-8", errors="ignore"),
        )

    monkeypatch.setenv("STRIPE_WEBHOOK_TEST_BYPASS", "false")
    monkeypatch.setenv("STRIPE_WEBHOOK_SECRET", "whsec_primary")
    monkeypatch.setattr(
        "app.modules.billing.service.stripe.Webhook.construct_event",
        _construct_event,
    )
    get_settings.cache_clear()
    try:
        response = await async_client.post(
            "/billing/webhooks/stripe",
            content=b'{"ok":true}',
            headers={"Stripe-Signature": "t=1,v1=bad"},
        )
        assert response.status_code == 400
        assert response.json().get("detail") == "invalid_signature"
    finally:
        get_settings.cache_clear()


@pytest.mark.asyncio
async def test_webhook_duplicate_event_noop_no_side_effects(
    async_client: AsyncClient,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    event_id = f"evt_duplicate_{uuid.uuid4().hex}"

    class _Evt:
        id = event_id
        type = "unknown.event.type"

        def get(self, key: str, default: object = None) -> object:
            if key == "id":
                return self.id
            if key == "type":
                return self.type
            return default

    async def _handle(*args, **kwargs):
        _handle.calls += 1
        return "ignored"

    _handle.calls = 0

    monkeypatch.setenv("STRIPE_WEBHOOK_TEST_BYPASS", "false")
    monkeypatch.setenv("STRIPE_WEBHOOK_SECRET", "whsec_primary")
    monkeypatch.setattr(
        "app.modules.billing.service.stripe.Webhook.construct_event",
        lambda **kwargs: _Evt(),
    )
    monkeypatch.setattr("app.modules.billing.router.handle_stripe_event", _handle)
    get_settings.cache_clear()
    try:
        first = await async_client.post(
            "/billing/webhooks/stripe",
            content=b'{"ok":true}',
            headers={"Stripe-Signature": "t=1,v1=ok"},
        )
        second = await async_client.post(
            "/billing/webhooks/stripe",
            content=b'{"ok":true}',
            headers={"Stripe-Signature": "t=1,v1=ok"},
        )
        assert first.status_code == 200
        assert second.status_code == 200
        assert second.json()["status"] == "duplicate_ignored"
        assert _handle.calls == 1
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

        sub_result = await db_session.execute(
            select(Subscription).where(
                Subscription.fan_user_id == UUID(fan_id),
                Subscription.creator_user_id == UUID(creator_id),
            )
        )
        sub = sub_result.scalar_one_or_none()
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


@pytest.mark.asyncio
async def test_webhook_invoice_payment_failed_marks_subscription_past_due(
    async_client: AsyncClient,
    db_session: AsyncSession,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv("STRIPE_WEBHOOK_TEST_BYPASS", "true")
    get_settings.cache_clear()
    creator_email = _unique_email()
    fan_email = _unique_email()
    await async_client.post(
        "/auth/signup",
        json={"email": creator_email, "password": "password123", "display_name": "Creator"},
    )
    creator_login = await async_client.post(
        "/auth/login", json={"email": creator_email, "password": "password123"}
    )
    creator_me = await async_client.get(
        "/auth/me",
        headers={"Authorization": f"Bearer {creator_login.json()['access_token']}"},
    )
    creator_id = UUID(creator_me.json()["id"])

    await async_client.post(
        "/auth/signup",
        json={"email": fan_email, "password": "password123", "display_name": "Fan"},
    )
    fan_login = await async_client.post(
        "/auth/login", json={"email": fan_email, "password": "password123"}
    )
    fan_me = await async_client.get(
        "/auth/me",
        headers={"Authorization": f"Bearer {fan_login.json()['access_token']}"},
    )
    fan_id = UUID(fan_me.json()["id"])
    stripe_sub_id = f"sub_{uuid.uuid4().hex}"
    sub = Subscription(
        fan_user_id=fan_id,
        creator_user_id=creator_id,
        status="active",
        stripe_subscription_id=stripe_sub_id,
    )
    db_session.add(sub)
    await db_session.commit()

    body = {
        "id": f"evt_fail_{uuid.uuid4().hex}",
        "type": "invoice.payment_failed",
        "data": {"object": {"id": "in_failed", "subscription": stripe_sub_id}},
    }
    try:
        response = await async_client.post(
            "/billing/webhooks/stripe",
            json=body,
            headers={"Stripe-Signature": "bypass"},
        )
        assert response.status_code == 200
        await db_session.refresh(sub)
        assert sub.status == "past_due"
    finally:
        get_settings.cache_clear()


@pytest.mark.asyncio
async def test_billing_health_reports_test_mode(
    async_client: AsyncClient,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv("STRIPE_SECRET_KEY", "sk_test_123")
    monkeypatch.setenv("STRIPE_WEBHOOK_SECRET", "whsec_test")
    monkeypatch.setenv("STRIPE_WEBHOOK_SECRET_PREVIOUS", "whsec_old")
    monkeypatch.setenv("ENVIRONMENT", "local")
    get_settings.cache_clear()
    try:
        response = await async_client.get("/billing/health")
        assert response.status_code == 200
        payload = response.json()
        assert payload["stripe_mode"] == "test"
        assert payload["stripe_configured"] is True
        assert payload["webhook_configured"] is True
        assert payload["webhook_previous_configured"] is True
    finally:
        get_settings.cache_clear()
