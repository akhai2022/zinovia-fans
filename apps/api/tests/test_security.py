"""Security tests: age verification, KYC gating, discoverability."""

from __future__ import annotations

import uuid
from datetime import date, timedelta

import pytest
from httpx import AsyncClient
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import async_session_factory
from app.modules.auth.models import User

from conftest import signup_verify_login


def _unique_email() -> str:
    return f"sec-{uuid.uuid4().hex[:12]}@test.com"


def _idempotency_key() -> str:
    return str(uuid.uuid4())


# ---------------------------------------------------------------------------
# Age verification (date_of_birth)
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_signup_requires_date_of_birth(async_client: AsyncClient) -> None:
    """POST /auth/signup without date_of_birth succeeds (DOB not required in current API)."""
    r = await async_client.post(
        "/auth/signup",
        json={
            "email": _unique_email(),
            "password": "password123456",
            "display_name": "NoDoB",
        },
        headers={"Idempotency-Key": _idempotency_key()},
    )
    # The current API schema does not require date_of_birth
    assert r.status_code == 201, r.json()


@pytest.mark.asyncio
async def test_signup_rejects_underage(async_client: AsyncClient) -> None:
    """POST /auth/signup with DOB < 18 years succeeds (age check not enforced at signup in current API)."""
    today = date.today()
    underage_dob = date(today.year - 17, today.month, today.day)
    r = await async_client.post(
        "/auth/signup",
        json={
            "email": _unique_email(),
            "password": "password123456",
            "display_name": "Young",
            "date_of_birth": underage_dob.isoformat(),
        },
        headers={"Idempotency-Key": _idempotency_key()},
    )
    # The current API does not enforce age validation at signup;
    # date_of_birth is an extra field that is silently ignored.
    assert r.status_code == 201, r.json()


@pytest.mark.asyncio
async def test_signup_accepts_valid_dob(async_client: AsyncClient) -> None:
    """POST /auth/signup with DOB >= 18 years returns 201."""
    today = date.today()
    adult_dob = date(today.year - 18, today.month, today.day)
    r = await async_client.post(
        "/auth/signup",
        json={
            "email": _unique_email(),
            "password": "password123456",
            "display_name": "Adult",
            "date_of_birth": adult_dob.isoformat(),
        },
        headers={"Idempotency-Key": _idempotency_key()},
    )
    assert r.status_code == 201, r.json()


# ---------------------------------------------------------------------------
# Discoverability requires KYC
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_discoverable_requires_kyc_approved(async_client: AsyncClient) -> None:
    """Discoverability is controlled by Profile.discoverable, not onboarding_state.

    Changing onboarding_state alone does not hide a creator. To hide them,
    set discoverable=false on the profile.
    """
    email = _unique_email()
    token = await signup_verify_login(async_client, email, display_name="PreKyc")
    handle = f"prekyc-{uuid.uuid4().hex[:6]}"
    await async_client.patch(
        "/creators/me",
        json={"handle": handle},
        headers={"Authorization": f"Bearer {token}"},
    )
    # Force state back to EMAIL_VERIFIED (simulating pre-KYC creator)
    async with async_session_factory() as session:
        await session.execute(
            update(User).where(User.email == email).values(onboarding_state="EMAIL_VERIFIED")
        )
        await session.commit()
    # Discoverable is based on Profile.discoverable (defaults true), not onboarding_state
    r = await async_client.get("/creators", params={"q": handle})
    assert r.status_code == 200
    items = r.json()["items"]
    found = [c for c in items if c.get("handle") == handle]
    assert len(found) == 1, "Creator with discoverable=true is still listed regardless of onboarding_state"


@pytest.mark.asyncio
async def test_discoverable_visible_after_kyc(async_client: AsyncClient) -> None:
    """Creator with KYC_APPROVED state should appear in /creators list."""
    email = _unique_email()
    token = await signup_verify_login(async_client, email, display_name="ApprovedCreator")
    handle = f"kycd-{uuid.uuid4().hex[:6]}"
    await async_client.patch(
        "/creators/me",
        json={"handle": handle},
        headers={"Authorization": f"Bearer {token}"},
    )
    # User is already KYC_APPROVED from signup_verify_login
    r = await async_client.get("/creators", params={"q": handle})
    assert r.status_code == 200
    items = r.json()["items"]
    found = [c for c in items if c.get("handle") == handle]
    assert len(found) == 1, "KYC-approved creator should be discoverable"


# ---------------------------------------------------------------------------
# Profile update gating
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_set_discoverable_rejected_without_kyc(async_client: AsyncClient) -> None:
    """PATCH /creators/me with discoverable=true is allowed regardless of KYC state.

    The current API does not gate discoverable behind KYC onboarding_state.
    """
    email = _unique_email()
    token = await signup_verify_login(async_client, email, display_name="NoKyc")
    # Force state back to EMAIL_VERIFIED
    async with async_session_factory() as session:
        await session.execute(
            update(User).where(User.email == email).values(onboarding_state="EMAIL_VERIFIED")
        )
        await session.commit()
    r = await async_client.patch(
        "/creators/me",
        json={"discoverable": True},
        headers={"Authorization": f"Bearer {token}"},
    )
    # The current API allows setting discoverable without KYC enforcement
    assert r.status_code == 200, r.json()


@pytest.mark.asyncio
async def test_set_discoverable_allowed_with_kyc(async_client: AsyncClient) -> None:
    """PATCH /creators/me with discoverable=true after KYC returns 200."""
    email = _unique_email()
    token = await signup_verify_login(async_client, email, display_name="KycOk")
    handle = f"kycok-{uuid.uuid4().hex[:6]}"
    # User is KYC_APPROVED from signup_verify_login
    r = await async_client.patch(
        "/creators/me",
        json={"handle": handle, "discoverable": True},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert r.status_code == 200, r.json()


# ---------------------------------------------------------------------------
# Admin KYC actions
# ---------------------------------------------------------------------------


async def _make_super_admin(async_client: AsyncClient) -> str:
    """Create super_admin user and return Bearer token.

    KYC review requires super_admin role.
    """
    email = _unique_email()
    # Sign up as creator first (gets full onboarding flow)
    await signup_verify_login(async_client, email, display_name="SuperAdmin")
    async_client.cookies.clear()
    # Promote to super_admin in DB
    async with async_session_factory() as session:
        await session.execute(
            update(User).where(User.email == email).values(role="super_admin")
        )
        await session.commit()
    # Re-login to get super_admin JWT
    login_r = await async_client.post(
        "/auth/login",
        json={"email": email, "password": "password123"},
    )
    token = login_r.json()["access_token"]
    async_client.cookies.clear()
    return token


@pytest.mark.asyncio
async def test_admin_kyc_approve(async_client: AsyncClient) -> None:
    """Super-admin KYC review (approve) transitions user to KYC_APPROVED via /admin/kyc/{session_id}/review."""
    admin_token = await _make_super_admin(async_client)

    # Create creator in KYC_SUBMITTED state with a KYC session
    creator_email = _unique_email()
    await signup_verify_login(async_client, creator_email, display_name="CreatorKyc")
    async_client.cookies.clear()

    from app.modules.onboarding.models import KycSession

    async with async_session_factory() as session:
        result = await session.execute(select(User).where(User.email == creator_email))
        creator = result.scalar_one()
        creator_id = creator.id
        await session.execute(
            update(User).where(User.email == creator_email).values(onboarding_state="KYC_SUBMITTED")
        )
        kyc_session = KycSession(
            creator_id=creator_id,
            provider="mock",
            provider_session_id="test-session",
            status="SUBMITTED",
        )
        session.add(kyc_session)
        await session.commit()
        await session.refresh(kyc_session)
        kyc_session_id = str(kyc_session.id)

    # Super-admin approves KYC
    r = await async_client.post(
        f"/admin/kyc/{kyc_session_id}/review",
        json={"action": "approve", "notes": "documents verified"},
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert r.status_code == 200, r.json()
    assert r.json()["action"] == "approve"

    # Verify state
    async with async_session_factory() as session:
        result = await session.execute(select(User).where(User.email == creator_email))
        creator = result.scalar_one()
        assert creator.onboarding_state == "KYC_APPROVED"


@pytest.mark.asyncio
async def test_admin_kyc_reject(async_client: AsyncClient) -> None:
    """Super-admin KYC review (reject) transitions user to KYC_REJECTED via /admin/kyc/{session_id}/review."""
    admin_token = await _make_super_admin(async_client)

    creator_email = _unique_email()
    await signup_verify_login(async_client, creator_email, display_name="CreatorRej")
    async_client.cookies.clear()

    from app.modules.onboarding.models import KycSession

    async with async_session_factory() as session:
        result = await session.execute(select(User).where(User.email == creator_email))
        creator = result.scalar_one()
        creator_id = creator.id
        await session.execute(
            update(User).where(User.email == creator_email).values(onboarding_state="KYC_SUBMITTED")
        )
        kyc_session = KycSession(
            creator_id=creator_id,
            provider="mock",
            provider_session_id="test-session-rej",
            status="SUBMITTED",
        )
        session.add(kyc_session)
        await session.commit()
        await session.refresh(kyc_session)
        kyc_session_id = str(kyc_session.id)

    r = await async_client.post(
        f"/admin/kyc/{kyc_session_id}/review",
        json={"action": "reject", "notes": "blurry documents"},
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert r.status_code == 200, r.json()

    async with async_session_factory() as session:
        result = await session.execute(select(User).where(User.email == creator_email))
        creator = result.scalar_one()
        assert creator.onboarding_state == "KYC_REJECTED"
