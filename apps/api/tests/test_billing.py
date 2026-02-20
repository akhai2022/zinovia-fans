"""Billing tests: CCBill webhook idempotency, subscription visibility, checkout 501."""

from __future__ import annotations

import uuid
from uuid import UUID

import pytest
from httpx import AsyncClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from conftest import signup_verify_login

from app.core.settings import get_settings
from app.modules.billing.models import PaymentEvent, Subscription


def _unique_email() -> str:
    return f"test-{uuid.uuid4().hex[:12]}@test.com"


@pytest.mark.asyncio
async def test_checkout_returns_501_when_ccbill_not_configured(
    async_client: AsyncClient,
) -> None:
    """POST /billing/checkout/subscription returns 501 when CCBill not configured."""
    fan_email = _unique_email()
    creator_email = _unique_email()
    token_c = await signup_verify_login(async_client, creator_email, display_name="Creator")
    handle = f"chk-{uuid.uuid4().hex[:8]}"
    await async_client.patch(
        "/creators/me",
        json={"handle": handle},
        headers={"Authorization": f"Bearer {token_c}"},
    )
    token_f = await signup_verify_login(async_client, fan_email, display_name="Fan")
    r = await async_client.post(
        "/billing/checkout/subscription",
        json={"creator_handle": handle},
        headers={"Authorization": f"Bearer {token_f}"},
    )
    assert r.status_code == 501
    data = r.json()
    assert "detail" in data
    detail_msg = data["detail"]["message"] if isinstance(data["detail"], dict) else data["detail"]
    assert "configured" in detail_msg.lower() or "payment" in detail_msg.lower()


@pytest.mark.asyncio
async def test_webhook_ccbill_idempotent_duplicate_ignored(
    async_client: AsyncClient,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Same event sent twice: first processed, second returns duplicate_ignored (test bypass)."""
    monkeypatch.setenv("CCBILL_WEBHOOK_TEST_BYPASS", "true")
    get_settings.cache_clear()
    try:
        transaction_id = f"txn_{uuid.uuid4().hex[:12]}"
        body = {
            "eventType": "NewSaleFailure",
            "transactionId": transaction_id,
        }
        r1 = await async_client.post(
            "/billing/webhooks/ccbill",
            json=body,
        )
        assert r1.status_code == 200
        data1 = r1.json()
        assert data1["status"] in ("processed", "duplicate_ignored")

        r2 = await async_client.post(
            "/billing/webhooks/ccbill",
            json=body,
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
    """Creator + SUBSCRIBERS post; active subscription row: fan sees post."""
    email_creator = _unique_email()
    email_fan = _unique_email()
    token_c = await signup_verify_login(async_client, email_creator, display_name="Creator")
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
    token_f = await signup_verify_login(async_client, email_fan, display_name="Fan")
    me_f = await async_client.get("/auth/me", headers={"Authorization": f"Bearer {token_f}"})
    fan_id = me_f.json()["id"]

    sub = Subscription(
        fan_user_id=UUID(fan_id) if isinstance(fan_id, str) else fan_id,
        creator_user_id=UUID(creator_id) if isinstance(creator_id, str) else creator_id,
        status="active",
        ccbill_subscription_id=f"sub_{uuid.uuid4().hex}",
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
    """Creator + SUBSCRIBERS post; fan with no subscription does not see it (include_locked=false)."""
    email_creator = _unique_email()
    email_fan = _unique_email()
    token_c = await signup_verify_login(async_client, email_creator, display_name="Creator")
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
    token_f = await signup_verify_login(async_client, email_fan, display_name="Fan", role="fan")

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
    assert len(sub_in_feed) >= 1, "Feed shows SUBSCRIBERS posts as locked teasers"
    assert sub_in_feed[0]["is_locked"] is True
    assert sub_in_feed[0]["caption"] is None


@pytest.mark.asyncio
async def test_billing_status_returns_authenticated_fan_subscriptions(
    async_client: AsyncClient,
    db_session: AsyncSession,
) -> None:
    creator_email = _unique_email()
    fan_email = _unique_email()
    creator_token = await signup_verify_login(async_client, creator_email, display_name="Creator")
    creator_me = await async_client.get(
        "/auth/me",
        headers={"Authorization": f"Bearer {creator_token}"},
    )
    creator_id = creator_me.json()["id"]

    fan_token = await signup_verify_login(async_client, fan_email, display_name="Fan")
    fan_me = await async_client.get(
        "/auth/me",
        headers={"Authorization": f"Bearer {fan_token}"},
    )
    fan_id = fan_me.json()["id"]

    sub = Subscription(
        fan_user_id=UUID(fan_id),
        creator_user_id=UUID(creator_id),
        status="active",
        ccbill_subscription_id=f"sub_{uuid.uuid4().hex}",
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
async def test_webhook_missing_event_type_returns_400(
    async_client: AsyncClient,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """POST /billing/webhooks/ccbill without eventType returns 400."""
    monkeypatch.setenv("CCBILL_WEBHOOK_TEST_BYPASS", "true")
    get_settings.cache_clear()
    try:
        r = await async_client.post(
            "/billing/webhooks/ccbill",
            json={"transactionId": "txn_123"},
        )
        assert r.status_code == 400
    finally:
        get_settings.cache_clear()


@pytest.mark.asyncio
async def test_webhook_new_sale_success_creates_subscription(
    async_client: AsyncClient,
    db_session: AsyncSession,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """CCBill NewSaleSuccess webhook creates subscription."""
    monkeypatch.setenv("CCBILL_WEBHOOK_TEST_BYPASS", "true")
    get_settings.cache_clear()
    email_creator = _unique_email()
    email_fan = _unique_email()
    token_c = await signup_verify_login(async_client, email_creator, display_name="Creator")
    me_c = await async_client.get("/auth/me", headers={"Authorization": f"Bearer {token_c}"})
    creator_id = me_c.json()["id"]
    token_f = await signup_verify_login(async_client, email_fan, display_name="Fan")
    me_f = await async_client.get("/auth/me", headers={"Authorization": f"Bearer {token_f}"})
    fan_id = me_f.json()["id"]

    subscription_id = f"sub_{uuid.uuid4().hex[:12]}"
    transaction_id = f"txn_{uuid.uuid4().hex[:12]}"
    body = {
        "eventType": "NewSaleSuccess",
        "subscriptionId": subscription_id,
        "transactionId": transaction_id,
        "zv_fan_user_id": fan_id,
        "zv_creator_user_id": creator_id,
        "zv_payment_type": "SUBSCRIPTION",
        "billedInitialPrice": "4.99",
        "billedCurrencyCode": "978",
    }
    try:
        r = await async_client.post(
            "/billing/webhooks/ccbill",
            json=body,
        )
        assert r.status_code == 200
        assert r.json()["status"] == "processed"

        # Verify event was recorded
        event_key = f"NewSaleSuccess:{transaction_id}"
        result = await db_session.execute(select(PaymentEvent).where(PaymentEvent.event_id == event_key))
        ev = result.scalar_one_or_none()
        assert ev is not None

        # Verify subscription was created
        sub_result = await db_session.execute(
            select(Subscription).where(
                Subscription.fan_user_id == UUID(fan_id),
                Subscription.creator_user_id == UUID(creator_id),
            )
        )
        sub = sub_result.scalar_one_or_none()
        assert sub is not None
        assert sub.status == "active"
        assert sub.ccbill_subscription_id == subscription_id

        # Duplicate event is ignored
        r2 = await async_client.post(
            "/billing/webhooks/ccbill",
            json=body,
        )
        assert r2.status_code == 200
        assert r2.json()["status"] == "duplicate_ignored"
    finally:
        get_settings.cache_clear()


@pytest.mark.asyncio
async def test_webhook_renewal_failure_marks_subscription_past_due(
    async_client: AsyncClient,
    db_session: AsyncSession,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv("CCBILL_WEBHOOK_TEST_BYPASS", "true")
    get_settings.cache_clear()
    creator_email = _unique_email()
    fan_email = _unique_email()
    creator_token = await signup_verify_login(async_client, creator_email, display_name="Creator")
    creator_me = await async_client.get(
        "/auth/me",
        headers={"Authorization": f"Bearer {creator_token}"},
    )
    creator_id = UUID(creator_me.json()["id"])

    fan_token = await signup_verify_login(async_client, fan_email, display_name="Fan")
    fan_me = await async_client.get(
        "/auth/me",
        headers={"Authorization": f"Bearer {fan_token}"},
    )
    fan_id = UUID(fan_me.json()["id"])
    ccbill_sub_id = f"sub_{uuid.uuid4().hex[:12]}"
    sub = Subscription(
        fan_user_id=fan_id,
        creator_user_id=creator_id,
        status="active",
        ccbill_subscription_id=ccbill_sub_id,
    )
    db_session.add(sub)
    await db_session.commit()

    body = {
        "eventType": "RenewalFailure",
        "subscriptionId": ccbill_sub_id,
        "transactionId": f"txn_{uuid.uuid4().hex[:12]}",
    }
    try:
        response = await async_client.post(
            "/billing/webhooks/ccbill",
            json=body,
        )
        assert response.status_code == 200
        await db_session.refresh(sub)
        assert sub.status == "past_due"
    finally:
        get_settings.cache_clear()


@pytest.mark.asyncio
async def test_billing_health_reports_status(
    async_client: AsyncClient,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv("CCBILL_ACCOUNT_NUMBER", "900000")
    monkeypatch.setenv("CCBILL_SUB_ACCOUNT", "0000")
    monkeypatch.setenv("CCBILL_FLEX_FORM_ID", "test-form")
    monkeypatch.setenv("CCBILL_SALT", "test-salt")
    monkeypatch.setenv("ENVIRONMENT", "local")
    get_settings.cache_clear()
    try:
        response = await async_client.get("/billing/health")
        assert response.status_code == 200
        payload = response.json()
        assert payload["payment_provider"] == "ccbill"
        assert payload["configured"] is True
        assert payload["webhook_configured"] is True
    finally:
        get_settings.cache_clear()
