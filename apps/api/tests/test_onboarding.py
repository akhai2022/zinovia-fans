"""Creator onboarding tests (Feature 1): register, verify-email, KYC, webhook, idempotency."""

from __future__ import annotations

import uuid

import pytest
from httpx import AsyncClient

from sqlalchemy import select

from app.db.session import async_session_factory
from app.modules.auth.models import User
from app.modules.onboarding.models import EmailVerificationToken


def _unique_email() -> str:
    return f"creator-{uuid.uuid4().hex[:12]}@test.com"


def _idempotency_key() -> str:
    return str(uuid.uuid4())


async def _latest_verification_token_for_email(email: str) -> str:
    async with async_session_factory() as session:
        result = await session.execute(select(User.id).where(User.email == email))
        user_id = result.scalar_one()
        tok = await session.execute(
            select(EmailVerificationToken.token)
            .where(EmailVerificationToken.user_id == user_id)
            .order_by(EmailVerificationToken.created_at.desc())
            .limit(1)
        )
        return tok.scalar_one()


@pytest.mark.asyncio
async def test_register_returns_201_and_creator_id(async_client: AsyncClient) -> None:
    """POST /auth/register returns 201 with creator_id (no token returned)."""
    email = _unique_email()
    payload = {"email": email, "password": "password123456"}
    r = await async_client.post(
        "/auth/register",
        json=payload,
        headers={"Idempotency-Key": _idempotency_key()},
    )
    assert r.status_code == 201, r.json()
    data = r.json()
    assert "creator_id" in data
    assert data["creator_id"]
    assert "verification_token" not in data


@pytest.mark.asyncio
async def test_register_rejects_short_password(async_client: AsyncClient) -> None:
    """POST /auth/register rejects password < 10 chars."""
    r = await async_client.post(
        "/auth/register",
        json={"email": _unique_email(), "password": "short"},
        headers={"Idempotency-Key": _idempotency_key()},
    )
    assert r.status_code == 422, r.json()


@pytest.mark.asyncio
async def test_register_requires_idempotency_key(async_client: AsyncClient) -> None:
    """POST /auth/register returns 400 without Idempotency-Key."""
    r = await async_client.post(
        "/auth/register",
        json={"email": _unique_email(), "password": "password123456"},
    )
    assert r.status_code == 400, r.json()


@pytest.mark.asyncio
async def test_register_idempotency_returns_same(async_client: AsyncClient) -> None:
    """Same Idempotency-Key returns cached response."""
    email = _unique_email()
    key = _idempotency_key()
    payload = {"email": email, "password": "password123456"}
    r1 = await async_client.post(
        "/auth/register",
        json=payload,
        headers={"Idempotency-Key": key},
    )
    assert r1.status_code == 201
    creator_id_1 = r1.json()["creator_id"]
    r2 = await async_client.post(
        "/auth/register",
        json=payload,
        headers={"Idempotency-Key": key},
    )
    assert r2.status_code == 201
    assert r2.json()["creator_id"] == creator_id_1


@pytest.mark.asyncio
async def test_verify_email_transitions_to_email_verified(async_client: AsyncClient) -> None:
    """POST /auth/verify-email transitions CREATED -> EMAIL_VERIFIED."""
    email = _unique_email()
    await async_client.post(
        "/auth/register",
        json={"email": email, "password": "password123456"},
        headers={"Idempotency-Key": _idempotency_key()},
    )
    token = await _latest_verification_token_for_email(email)
    r = await async_client.post(
        "/auth/verify-email",
        json={"token": token},
        headers={"Idempotency-Key": _idempotency_key()},
    )
    assert r.status_code == 200, r.json()
    data = r.json()
    assert data["state"] == "EMAIL_VERIFIED"


@pytest.mark.asyncio
async def test_verify_email_idempotent(async_client: AsyncClient) -> None:
    """Same Idempotency-Key on verify-email returns cached."""
    email = _unique_email()
    await async_client.post(
        "/auth/register",
        json={"email": email, "password": "password123456"},
        headers={"Idempotency-Key": _idempotency_key()},
    )
    token = await _latest_verification_token_for_email(email)
    key = _idempotency_key()
    r1 = await async_client.post(
        "/auth/verify-email",
        json={"token": token},
        headers={"Idempotency-Key": key},
    )
    assert r1.status_code == 200
    r2 = await async_client.post(
        "/auth/verify-email",
        json={"token": token},
        headers={"Idempotency-Key": key},
    )
    assert r2.status_code == 200
    assert r2.json()["state"] == "EMAIL_VERIFIED"


@pytest.mark.asyncio
async def test_login_blocked_for_unverified_creator(async_client: AsyncClient) -> None:
    """POST /auth/login returns 401 for creator who hasn't verified email (onboarding_state=CREATED)."""
    email = _unique_email()
    await async_client.post(
        "/auth/register",
        json={"email": email, "password": "password123456"},
        headers={"Idempotency-Key": _idempotency_key()},
    )
    login = await async_client.post(
        "/auth/login",
        json={"email": email, "password": "password123456"},
    )
    assert login.status_code == 401
    assert login.json()["detail"]["code"] == "email_not_verified"


@pytest.mark.asyncio
async def test_kyc_session_after_verify(async_client: AsyncClient) -> None:
    """POST /kyc/session returns redirect_url when email verified."""
    email = _unique_email()
    await async_client.post(
        "/auth/register",
        json={"email": email, "password": "password123456"},
        headers={"Idempotency-Key": _idempotency_key()},
    )
    token = await _latest_verification_token_for_email(email)
    await async_client.post(
        "/auth/verify-email",
        json={"token": token},
        headers={"Idempotency-Key": _idempotency_key()},
    )
    await async_client.post(
        "/auth/login",
        json={"email": email, "password": "password123456"},
    )
    async_client.cookies.delete("csrf_token")
    r = await async_client.post(
        "/kyc/session",
        json={},
        headers={"Idempotency-Key": _idempotency_key()},
    )
    assert r.status_code == 200, r.json()
    data = r.json()
    assert "redirect_url" in data
    assert "session_id" in data
    assert "/mock-kyc" in data["redirect_url"]


@pytest.mark.asyncio
async def test_kyc_session_idempotent(async_client: AsyncClient) -> None:
    """Same Idempotency-Key on POST /kyc/session returns same session."""
    email = _unique_email()
    await async_client.post(
        "/auth/register",
        json={"email": email, "password": "password123456"},
        headers={"Idempotency-Key": _idempotency_key()},
    )
    token = await _latest_verification_token_for_email(email)
    await async_client.post(
        "/auth/verify-email",
        json={"token": token},
        headers={"Idempotency-Key": _idempotency_key()},
    )
    await async_client.post(
        "/auth/login",
        json={"email": email, "password": "password123456"},
    )
    async_client.cookies.delete("csrf_token")
    key = _idempotency_key()
    r1 = await async_client.post(
        "/kyc/session",
        json={},
        headers={"Idempotency-Key": key},
    )
    assert r1.status_code == 200
    sid1 = r1.json()["session_id"]
    r2 = await async_client.post(
        "/kyc/session",
        json={},
        headers={"Idempotency-Key": key},
    )
    assert r2.status_code == 200
    assert r2.json()["session_id"] == sid1


@pytest.mark.asyncio
async def test_webhook_rejects_missing_signature(async_client: AsyncClient) -> None:
    """POST /webhooks/kyc returns 401 without signature."""
    r = await async_client.post(
        "/webhooks/kyc",
        json={
            "provider_session_id": "mock_123",
            "status": "APPROVED",
            "event_id": "evt_1",
        },
    )
    assert r.status_code == 401, r.json()


@pytest.mark.asyncio
async def test_webhook_rejects_invalid_signature(async_client: AsyncClient) -> None:
    """POST /webhooks/kyc returns 401 with wrong HMAC."""
    import hmac as hm
    from app.core.settings import get_settings
    body = b'{"provider_session_id":"mock_123","status":"APPROVED","event_id":"evt_1"}'
    wrong_sig = hm.new(b"wrong-secret", body, "sha256").hexdigest()
    r = await async_client.post(
        "/webhooks/kyc",
        content=body,
        headers={
            "Content-Type": "application/json",
            "X-Kyc-Signature": wrong_sig,
        },
    )
    assert r.status_code == 401, r.json()


@pytest.mark.asyncio
async def test_webhook_valid_hmac_and_audit(async_client: AsyncClient) -> None:
    """Webhook with valid HMAC processes and creates audit event."""
    import hmac as hm
    from sqlalchemy import select

    from app.core.settings import get_settings
    from app.db.session import async_session_factory
    from app.modules.onboarding.models import OnboardingAuditEvent

    email = _unique_email()
    await async_client.post(
        "/auth/register",
        json={"email": email, "password": "password123456"},
        headers={"Idempotency-Key": _idempotency_key()},
    )
    token = await _latest_verification_token_for_email(email)
    await async_client.post(
        "/auth/verify-email",
        json={"token": token},
        headers={"Idempotency-Key": _idempotency_key()},
    )
    await async_client.post(
        "/auth/login",
        json={"email": email, "password": "password123456"},
    )
    async_client.cookies.delete("csrf_token")
    r = await async_client.post(
        "/kyc/session",
        json={},
        headers={"Idempotency-Key": _idempotency_key()},
    )
    assert r.status_code == 200
    session_id = r.json()["session_id"]
    provider_session_id = f"mock_{session_id}"
    secret = get_settings().kyc_webhook_hmac_secret.encode("utf-8")
    evt_sub = f"evt_sub_{uuid.uuid4().hex[:8]}"
    body = (
        '{"provider_session_id":"'
        + provider_session_id
        + '","status":"SUBMITTED","event_id":"'
        + evt_sub
        + '"}'
    ).encode()
    sig = hm.new(secret, body, "sha256").hexdigest()
    wh1 = await async_client.post(
        "/webhooks/kyc",
        content=body,
        headers={"Content-Type": "application/json", "X-Kyc-Signature": sig},
    )
    assert wh1.status_code == 200
    evt_app = f"evt_app_{uuid.uuid4().hex[:8]}"
    body2 = (
        '{"provider_session_id":"'
        + provider_session_id
        + '","status":"APPROVED","event_id":"'
        + evt_app
        + '"}'
    ).encode()
    sig2 = hm.new(secret, body2, "sha256").hexdigest()
    wh2 = await async_client.post(
        "/webhooks/kyc",
        content=body2,
        headers={"Content-Type": "application/json", "X-Kyc-Signature": sig2},
    )
    assert wh2.status_code == 200
    async with async_session_factory() as s:
        result = await s.execute(
            select(OnboardingAuditEvent)
            .order_by(OnboardingAuditEvent.created_at.desc())
            .limit(5)
        )
        events = list(result.scalars().all())
    assert any(e.event_type == "webhook_kyc_approved" for e in events)


@pytest.mark.asyncio
async def test_webhook_idempotent_by_event_id(async_client: AsyncClient) -> None:
    """Same event_id returns cached response (idempotent)."""
    import hmac as hm

    from app.core.settings import get_settings

    email = _unique_email()
    await async_client.post(
        "/auth/register",
        json={"email": email, "password": "password123456"},
        headers={"Idempotency-Key": _idempotency_key()},
    )
    token = await _latest_verification_token_for_email(email)
    await async_client.post(
        "/auth/verify-email",
        json={"token": token},
        headers={"Idempotency-Key": _idempotency_key()},
    )
    await async_client.post(
        "/auth/login",
        json={"email": email, "password": "password123456"},
    )
    async_client.cookies.delete("csrf_token")
    r = await async_client.post(
        "/kyc/session",
        json={},
        headers={"Idempotency-Key": _idempotency_key()},
    )
    session_id = r.json()["session_id"]
    provider_session_id = f"mock_{session_id}"
    secret = get_settings().kyc_webhook_hmac_secret.encode("utf-8")
    evt_idem = f"evt_idem_{uuid.uuid4().hex[:8]}"
    body = (
        '{"provider_session_id":"'
        + provider_session_id
        + '","status":"SUBMITTED","event_id":"'
        + evt_idem
        + '"}'
    ).encode()
    sig = hm.new(secret, body, "sha256").hexdigest()
    hdrs = {"Content-Type": "application/json", "X-Kyc-Signature": sig}
    w1 = await async_client.post("/webhooks/kyc", content=body, headers=hdrs)
    assert w1.status_code == 200
    w2 = await async_client.post("/webhooks/kyc", content=body, headers=hdrs)
    assert w2.status_code == 200


@pytest.mark.asyncio
async def test_invalid_state_transition_returns_409(async_client: AsyncClient) -> None:
    """Webhook with invalid transition (KYC_PENDING -> APPROVED skip SUBMITTED) returns 409."""
    import hmac as hm

    from app.core.settings import get_settings

    email = _unique_email()
    await async_client.post(
        "/auth/register",
        json={"email": email, "password": "password123456"},
        headers={"Idempotency-Key": _idempotency_key()},
    )
    token = await _latest_verification_token_for_email(email)
    await async_client.post(
        "/auth/verify-email",
        json={"token": token},
        headers={"Idempotency-Key": _idempotency_key()},
    )
    await async_client.post(
        "/auth/login",
        json={"email": email, "password": "password123456"},
    )
    async_client.cookies.delete("csrf_token")
    r = await async_client.post(
        "/kyc/session",
        json={},
        headers={"Idempotency-Key": _idempotency_key()},
    )
    session_id = r.json()["session_id"]
    provider_session_id = f"mock_{session_id}"
    secret = get_settings().kyc_webhook_hmac_secret.encode("utf-8")
    body = (
        '{"provider_session_id":"'
        + provider_session_id
        + '","status":"APPROVED","event_id":"evt_invalid"}'
    ).encode()
    sig = hm.new(secret, body, "sha256").hexdigest()
    wh = await async_client.post(
        "/webhooks/kyc",
        content=body,
        headers={"Content-Type": "application/json", "X-Kyc-Signature": sig},
    )
    assert wh.status_code == 409, wh.json()
    data = wh.json()
    detail = data.get("detail", {})
    assert detail.get("code") == "invalid_state_transition" or detail.get("error_code") == "invalid_state_transition"
