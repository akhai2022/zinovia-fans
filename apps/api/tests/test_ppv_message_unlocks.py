from __future__ import annotations

import uuid
from uuid import UUID

import pytest
from httpx import AsyncClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.settings import get_settings
from app.modules.media.models import MediaObject
from app.modules.payments.models import PpvPurchase


def _email() -> str:
    return f"ppv-{uuid.uuid4().hex[:10]}@test.com"


async def _signup_and_login(client: AsyncClient, email: str, display_name: str) -> str:
    await client.post(
        "/auth/signup",
        json={"email": email, "password": "password123", "display_name": display_name},
    )
    res = await client.post("/auth/login", json={"email": email, "password": "password123"})
    return res.json()["access_token"]


@pytest.fixture(autouse=True)
def _enable_ppvm(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("ENABLE_PPVM", "true")
    monkeypatch.setenv("DEFAULT_CURRENCY", "eur")
    monkeypatch.setenv("MIN_PPV_CENTS", "100")
    monkeypatch.setenv("MAX_PPV_CENTS", "20000")
    monkeypatch.setenv("PPV_INTENT_RATE_LIMIT_PER_MIN", "10")
    monkeypatch.setenv("STRIPE_SECRET_KEY", "sk_test_123")
    get_settings.cache_clear()


@pytest.fixture(autouse=True)
def _mock_stripe(monkeypatch: pytest.MonkeyPatch) -> None:
    class _PI:
        @staticmethod
        def create(**kwargs):
            return type(
                "PI",
                (),
                {
                    "id": f"pi_{uuid.uuid4().hex[:10]}",
                    "client_secret": f"cs_{uuid.uuid4().hex}",
                    "metadata": kwargs.get("metadata", {}),
                },
            )()

    monkeypatch.setattr("app.modules.ppv.service.stripe.PaymentIntent", _PI)


async def _create_locked_media_message(
    async_client: AsyncClient,
    db_session: AsyncSession,
) -> tuple[str, str, str, str, str]:
    creator_token = await _signup_and_login(async_client, _email(), "Creator")
    fan_token = await _signup_and_login(async_client, _email(), "Fan")
    async_client.cookies.clear()
    creator_me = await async_client.get("/auth/me", headers={"Authorization": f"Bearer {creator_token}"})
    async_client.cookies.clear()
    fan_me = await async_client.get("/auth/me", headers={"Authorization": f"Bearer {fan_token}"})
    creator_id = creator_me.json()["id"]
    fan_id = fan_me.json()["id"]
    await async_client.patch(
        "/creators/me",
        json={"handle": f"ppv-{uuid.uuid4().hex[:8]}"},
        headers={"Authorization": f"Bearer {creator_token}"},
    )

    fan_conv = await async_client.post(
        "/dm/conversations",
        json={"creator_id": creator_id, "fan_id": fan_id},
        headers={"Authorization": f"Bearer {creator_token}"},
    )
    assert fan_conv.status_code == 200, fan_conv.json()
    conversation_id = fan_conv.json()["conversation_id"]

    media = MediaObject(
        owner_user_id=UUID(creator_id),
        object_key=f"dm/{uuid.uuid4().hex}.jpg",
        content_type="image/jpeg",
        size_bytes=123,
    )
    db_session.add(media)
    await db_session.commit()
    await db_session.refresh(media)

    sent = await async_client.post(
        f"/dm/conversations/{conversation_id}/messages",
        json={
            "type": "MEDIA",
            "media_ids": [str(media.id)],
            "lock": {"price_cents": 500, "currency": "usd"},
        },
        headers={"Authorization": f"Bearer {creator_token}"},
    )
    assert sent.status_code == 200, sent.json()
    message_media_id = sent.json()["media"][0]["id"]
    return creator_token, fan_token, conversation_id, str(media.id), message_media_id


async def _create_unlocked_media_message(
    async_client: AsyncClient,
    db_session: AsyncSession,
) -> tuple[str, str, str, str, str]:
    creator_token = await _signup_and_login(async_client, _email(), "Creator")
    fan_token = await _signup_and_login(async_client, _email(), "Fan")
    async_client.cookies.clear()
    creator_me = await async_client.get("/auth/me", headers={"Authorization": f"Bearer {creator_token}"})
    async_client.cookies.clear()
    fan_me = await async_client.get("/auth/me", headers={"Authorization": f"Bearer {fan_token}"})
    creator_id = creator_me.json()["id"]
    fan_id = fan_me.json()["id"]
    await async_client.patch(
        "/creators/me",
        json={"handle": f"ppv-{uuid.uuid4().hex[:8]}"},
        headers={"Authorization": f"Bearer {creator_token}"},
    )
    fan_conv = await async_client.post(
        "/dm/conversations",
        json={"creator_id": creator_id, "fan_id": fan_id},
        headers={"Authorization": f"Bearer {creator_token}"},
    )
    assert fan_conv.status_code == 200, fan_conv.json()
    conversation_id = fan_conv.json()["conversation_id"]
    media = MediaObject(
        owner_user_id=UUID(creator_id),
        object_key=f"dm/{uuid.uuid4().hex}.jpg",
        content_type="image/jpeg",
        size_bytes=123,
    )
    db_session.add(media)
    await db_session.commit()
    await db_session.refresh(media)
    sent = await async_client.post(
        f"/dm/conversations/{conversation_id}/messages",
        json={
            "type": "MEDIA",
            "media_ids": [str(media.id)],
        },
        headers={"Authorization": f"Bearer {creator_token}"},
    )
    assert sent.status_code == 200, sent.json()
    message_media_id = sent.json()["media"][0]["id"]
    return creator_token, fan_token, conversation_id, str(media.id), message_media_id


@pytest.mark.asyncio
async def test_fan_cannot_create_locked_message(
    async_client: AsyncClient,
    db_session: AsyncSession,
) -> None:
    _creator_token, fan_token, conversation_id, media_id, _message_media_id = await _create_locked_media_message(
        async_client, db_session
    )
    fan_me = await async_client.get("/auth/me", headers={"Authorization": f"Bearer {fan_token}"})
    fan_media = MediaObject(
        owner_user_id=UUID(fan_me.json()["id"]),
        object_key=f"dm/{uuid.uuid4().hex}.jpg",
        content_type="image/jpeg",
        size_bytes=123,
    )
    db_session.add(fan_media)
    await db_session.commit()
    await db_session.refresh(fan_media)
    res = await async_client.post(
        f"/dm/conversations/{conversation_id}/messages",
        json={
            "type": "MEDIA",
            "media_ids": [str(fan_media.id)],
            "lock": {"price_cents": 500, "currency": "usd"},
        },
        headers={"Authorization": f"Bearer {fan_token}"},
    )
    assert res.status_code == 403
    assert res.json()["detail"] == "ppv_creator_only"


@pytest.mark.asyncio
async def test_non_participant_cannot_create_intent(
    async_client: AsyncClient,
    db_session: AsyncSession,
) -> None:
    _creator_token, _fan_token, _conversation_id, _media_id, message_media_id = await _create_locked_media_message(
        async_client, db_session
    )
    other_token = await _signup_and_login(async_client, _email(), "Other")
    res = await async_client.post(
        f"/ppv/message-media/{message_media_id}/create-intent",
        headers={"Authorization": f"Bearer {other_token}"},
    )
    assert res.status_code == 403
    assert res.json()["detail"] == "ppv_not_participant"


@pytest.mark.asyncio
async def test_non_participant_cannot_read_or_send_messages(
    async_client: AsyncClient,
    db_session: AsyncSession,
) -> None:
    _creator_token, _fan_token, conversation_id, _media_id, _message_media_id = await _create_locked_media_message(
        async_client, db_session
    )
    outsider = await _signup_and_login(async_client, _email(), "Outsider")
    read_res = await async_client.get(
        f"/dm/conversations/{conversation_id}/messages",
        headers={"Authorization": f"Bearer {outsider}"},
    )
    assert read_res.status_code == 403
    send_res = await async_client.post(
        f"/dm/conversations/{conversation_id}/messages",
        json={"type": "TEXT", "text": "hello"},
        headers={"Authorization": f"Bearer {outsider}"},
    )
    assert send_res.status_code == 403


@pytest.mark.asyncio
async def test_cannot_create_intent_for_unlocked_media(
    async_client: AsyncClient,
    db_session: AsyncSession,
) -> None:
    _creator_token, fan_token, _conversation_id, _media_id, message_media_id = await _create_unlocked_media_message(
        async_client, db_session
    )
    res = await async_client.post(
        f"/ppv/message-media/{message_media_id}/create-intent",
        headers={"Authorization": f"Bearer {fan_token}"},
    )
    assert res.status_code == 400
    assert res.json()["detail"] == "ppv_not_locked"


@pytest.mark.asyncio
async def test_unique_purchase_prevents_double_unlock(
    async_client: AsyncClient,
    db_session: AsyncSession,
) -> None:
    creator_token, fan_token, _conversation_id, _media_id, message_media_id = await _create_locked_media_message(
        async_client, db_session
    )
    first = await async_client.post(
        f"/ppv/message-media/{message_media_id}/create-intent",
        headers={"Authorization": f"Bearer {fan_token}"},
    )
    assert first.status_code == 200
    assert first.json()["status"] == "REQUIRES_PAYMENT"

    purchase_id = first.json()["purchase_id"]
    purchase = (await db_session.execute(select(PpvPurchase).where(PpvPurchase.id == UUID(purchase_id)))).scalar_one()
    purchase.status = "SUCCEEDED"
    await db_session.commit()

    second = await async_client.post(
        f"/ppv/message-media/{message_media_id}/create-intent",
        headers={"Authorization": f"Bearer {fan_token}"},
    )
    assert second.status_code == 200
    assert second.json()["status"] == "ALREADY_UNLOCKED"
    assert second.json()["purchase_id"] == purchase_id

    creator_try = await async_client.post(
        f"/ppv/message-media/{message_media_id}/create-intent",
        headers={"Authorization": f"Bearer {creator_token}"},
    )
    assert creator_try.status_code == 403
    assert creator_try.json()["detail"] == "ppv_creator_only"


@pytest.mark.asyncio
async def test_webhook_idempotent_and_refund_transition(
    async_client: AsyncClient,
    db_session: AsyncSession,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv("STRIPE_WEBHOOK_TEST_BYPASS", "true")
    get_settings.cache_clear()
    _creator_token, fan_token, _conversation_id, _media_id, message_media_id = await _create_locked_media_message(
        async_client, db_session
    )
    created = await async_client.post(
        f"/ppv/message-media/{message_media_id}/create-intent",
        headers={"Authorization": f"Bearer {fan_token}"},
    )
    purchase_id = created.json()["purchase_id"]
    purchase = (await db_session.execute(select(PpvPurchase).where(PpvPurchase.id == UUID(purchase_id)))).scalar_one()
    purchase_uuid = purchase.id
    pi_id = purchase.stripe_payment_intent_id

    event = {
        "id": f"evt_{uuid.uuid4().hex}",
        "type": "payment_intent.succeeded",
        "data": {
            "object": {
                "id": pi_id,
                "amount": purchase.amount_cents,
                "currency": purchase.currency,
                "latest_charge": f"ch_{uuid.uuid4().hex[:12]}",
                "metadata": {
                    "type": "PPV_MESSAGE_UNLOCK",
                    "purchase_id": str(purchase.id),
                    "creator_id": str(purchase.creator_id),
                },
            }
        },
    }
    first = await async_client.post("/billing/webhooks/stripe", json=event, headers={"Stripe-Signature": "bypass"})
    assert first.status_code == 200
    second = await async_client.post("/billing/webhooks/stripe", json=event, headers={"Stripe-Signature": "bypass"})
    assert second.status_code == 200
    assert second.json()["status"] == "duplicate_ignored"

    db_session.expire_all()
    refreshed = (await db_session.execute(select(PpvPurchase).where(PpvPurchase.id == purchase_uuid))).scalar_one()
    assert refreshed.status == "SUCCEEDED"
    assert refreshed.stripe_charge_id is not None

    refund_event = {
        "id": f"evt_{uuid.uuid4().hex}",
        "type": "charge.refunded",
        "data": {"object": {"id": refreshed.stripe_charge_id}},
    }
    refunded = await async_client.post(
        "/billing/webhooks/stripe",
        json=refund_event,
        headers={"Stripe-Signature": "bypass"},
    )
    assert refunded.status_code == 200
    db_session.expire_all()
    updated = (await db_session.execute(select(PpvPurchase).where(PpvPurchase.id == purchase_uuid))).scalar_one()
    assert updated.status == "REFUNDED"


@pytest.mark.asyncio
async def test_webhook_payment_failed_transitions_to_canceled(
    async_client: AsyncClient,
    db_session: AsyncSession,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv("STRIPE_WEBHOOK_TEST_BYPASS", "true")
    get_settings.cache_clear()
    _creator_token, fan_token, _conversation_id, _media_id, message_media_id = await _create_locked_media_message(
        async_client, db_session
    )
    created = await async_client.post(
        f"/ppv/message-media/{message_media_id}/create-intent",
        headers={"Authorization": f"Bearer {fan_token}"},
    )
    purchase_id = created.json()["purchase_id"]
    purchase = (await db_session.execute(select(PpvPurchase).where(PpvPurchase.id == UUID(purchase_id)))).scalar_one()
    event = {
        "id": f"evt_{uuid.uuid4().hex}",
        "type": "payment_intent.payment_failed",
        "data": {
            "object": {
                "id": purchase.stripe_payment_intent_id,
                "metadata": {
                    "type": "PPV_MESSAGE_UNLOCK",
                    "purchase_id": str(purchase.id),
                },
            }
        },
    }
    failed = await async_client.post(
        "/billing/webhooks/stripe",
        json=event,
        headers={"Stripe-Signature": "bypass"},
    )
    assert failed.status_code == 200
    db_session.expire_all()
    updated = (await db_session.execute(select(PpvPurchase).where(PpvPurchase.id == UUID(purchase_id)))).scalar_one()
    assert updated.status == "CANCELED"


@pytest.mark.asyncio
async def test_locked_media_download_url_access_control(
    async_client: AsyncClient,
    db_session: AsyncSession,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    creator_token, fan_token, _conversation_id, _media_id, message_media_id = await _create_locked_media_message(
        async_client, db_session
    )
    third_token = await _signup_and_login(async_client, _email(), "Third")

    monkeypatch.setattr("app.modules.messaging.router.get_storage_client", lambda: object())
    monkeypatch.setattr(
        "app.modules.messaging.router.generate_signed_download",
        lambda _storage, _object_key: "https://signed.example.com/file",
    )

    blocked = await async_client.get(
        f"/dm/message-media/{message_media_id}/download-url",
        headers={"Authorization": f"Bearer {fan_token}"},
    )
    assert blocked.status_code == 403

    async_client.cookies.clear()
    creator_allowed = await async_client.get(
        f"/dm/message-media/{message_media_id}/download-url",
        headers={"Authorization": f"Bearer {creator_token}"},
    )
    assert creator_allowed.status_code == 200
    assert creator_allowed.json()["download_url"].startswith("https://signed.example.com/")

    async_client.cookies.clear()
    outsider = await async_client.get(
        f"/dm/message-media/{message_media_id}/download-url",
        headers={"Authorization": f"Bearer {third_token}"},
    )
    assert outsider.status_code == 403

    created = await async_client.post(
        f"/ppv/message-media/{message_media_id}/create-intent",
        headers={"Authorization": f"Bearer {fan_token}"},
    )
    purchase_id = created.json()["purchase_id"]
    purchase = (await db_session.execute(select(PpvPurchase).where(PpvPurchase.id == UUID(purchase_id)))).scalar_one()
    purchase.status = "SUCCEEDED"
    await db_session.commit()

    async_client.cookies.clear()
    fan_allowed = await async_client.get(
        f"/dm/message-media/{message_media_id}/download-url",
        headers={"Authorization": f"Bearer {fan_token}"},
    )
    assert fan_allowed.status_code == 200

