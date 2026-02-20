"""E2E test-only endpoints.

These endpoints exist SOLELY to support deterministic Playwright E2E tests.
They are gated by:
  1. E2E_ENABLE=1 (must be false in production — enforced by Settings validator)
  2. X-E2E-Secret header must match E2E_SECRET

If either guard fails the entire router returns 404.
"""

from __future__ import annotations

import logging
import uuid
from datetime import UTC, datetime

from fastapi import APIRouter, Depends, Header, Query
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.errors import AppError
from app.core.settings import get_settings
from app.db.session import get_async_session
from app.modules.auth.models import Profile, User

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/__e2e__", tags=["e2e"])


def _require_e2e(x_e2e_secret: str = Header("", alias="X-E2E-Secret")) -> None:
    """Guard: reject if E2E not enabled or secret mismatch."""
    settings = get_settings()
    if not settings.e2e_enable:
        raise AppError(status_code=404, detail="not_found")
    if settings.is_production:
        raise AppError(status_code=404, detail="not_found")
    expected = (settings.e2e_secret or "").strip()
    if not expected or x_e2e_secret != expected:
        raise AppError(status_code=403, detail="invalid_e2e_secret")


@router.post(
    "/auth/force-role",
    operation_id="e2e_force_role",
    summary="[E2E] Set user role",
    dependencies=[Depends(_require_e2e)],
)
async def force_role(
    email: str = Query(...),
    role: str = Query(...),
    session: AsyncSession = Depends(get_async_session),
) -> dict:
    """Set role for a user (fan, creator, admin). Creates profile if missing."""
    allowed = {"fan", "creator", "admin"}
    if role not in allowed:
        raise AppError(status_code=400, detail=f"role must be one of {allowed}")

    result = await session.execute(select(User).where(User.email == email))
    user = result.scalar_one_or_none()
    if not user:
        raise AppError(status_code=404, detail="user_not_found")

    user.role = role
    # If becoming creator/admin, ensure profile exists
    if role in ("creator", "admin") and not user.profile:
        profile = Profile(
            id=uuid.uuid4(),
            user_id=user.id,
            display_name=user.email.split("@")[0],
            handle=f"e2e{uuid.uuid4().hex[:8]}",
            handle_normalized=f"e2e{uuid.uuid4().hex[:8]}",
            discoverable=True,
        )
        session.add(profile)
    # Also mark email-verified for creators (skip onboarding gate)
    if role == "creator" and user.onboarding_state == "CREATED":
        user.onboarding_state = "KYC_APPROVED"
    await session.commit()
    logger.info("e2e: forced role=%s for email=%s", role, email)
    return {"status": "ok", "email": email, "role": role, "user_id": str(user.id)}


@router.post(
    "/onboarding/force-state",
    operation_id="e2e_force_onboarding_state",
    summary="[E2E] Set onboarding state",
    dependencies=[Depends(_require_e2e)],
)
async def force_onboarding_state(
    email: str = Query(...),
    state: str = Query(...),
    session: AsyncSession = Depends(get_async_session),
) -> dict:
    """Force onboarding state for a user (e.g., KYC_APPROVED)."""
    result = await session.execute(select(User).where(User.email == email))
    user = result.scalar_one_or_none()
    if not user:
        raise AppError(status_code=404, detail="user_not_found")
    user.onboarding_state = state
    await session.commit()
    logger.info("e2e: forced onboarding_state=%s for email=%s", state, email)
    return {"status": "ok", "email": email, "onboarding_state": state}


@router.post(
    "/billing/activate-subscription",
    operation_id="e2e_activate_subscription",
    summary="[E2E] Simulate subscription activation (bypass payment processor)",
    dependencies=[Depends(_require_e2e)],
)
async def activate_subscription(
    fan_email: str = Query(...),
    creator_email: str = Query(...),
    session: AsyncSession = Depends(get_async_session),
) -> dict:
    """Create a subscription record directly in the DB, bypassing payment processor.
    Idempotent: if subscription already exists and is active, returns it."""
    from app.modules.billing.models import Subscription

    fan_result = await session.execute(select(User).where(User.email == fan_email))
    fan = fan_result.scalar_one_or_none()
    if not fan:
        raise AppError(status_code=404, detail="fan_not_found")

    creator_result = await session.execute(select(User).where(User.email == creator_email))
    creator = creator_result.scalar_one_or_none()
    if not creator:
        raise AppError(status_code=404, detail="creator_not_found")

    # Check existing active subscription
    existing = await session.execute(
        select(Subscription).where(
            Subscription.fan_user_id == fan.id,
            Subscription.creator_user_id == creator.id,
            Subscription.status == "active",
        )
    )
    sub = existing.scalar_one_or_none()
    if sub:
        return {
            "status": "already_active",
            "subscription_id": str(sub.id),
            "fan_user_id": str(fan.id),
            "creator_user_id": str(creator.id),
        }

    # Create subscription record
    now = datetime.now(UTC)
    from datetime import timedelta
    sub = Subscription(
        id=uuid.uuid4(),
        fan_user_id=fan.id,
        creator_user_id=creator.id,
        status="active",
        ccbill_subscription_id=f"e2e_sub_{uuid.uuid4().hex[:12]}",
        current_period_end=now + timedelta(days=30),
        cancel_at_period_end=False,
    )
    session.add(sub)
    await session.commit()
    logger.info(
        "e2e: activated subscription fan=%s creator=%s sub_id=%s",
        fan_email, creator_email, sub.id,
    )
    return {
        "status": "activated",
        "subscription_id": str(sub.id),
        "fan_user_id": str(fan.id),
        "creator_user_id": str(creator.id),
    }


@router.post(
    "/ppv/activate-post-purchase",
    operation_id="e2e_activate_post_purchase",
    summary="[E2E] Simulate PPV post purchase (bypass payment processor)",
    dependencies=[Depends(_require_e2e)],
)
async def activate_post_purchase(
    fan_email: str = Query(...),
    post_id: str = Query(...),
    session: AsyncSession = Depends(get_async_session),
) -> dict:
    """Create a post_purchase record directly, bypassing payment flow."""
    from app.modules.payments.models import PostPurchase
    from app.modules.posts.models import Post

    fan_result = await session.execute(select(User).where(User.email == fan_email))
    fan = fan_result.scalar_one_or_none()
    if not fan:
        raise AppError(status_code=404, detail="fan_not_found")

    post_result = await session.execute(
        select(Post).where(Post.id == uuid.UUID(post_id))
    )
    post = post_result.scalar_one_or_none()
    if not post:
        raise AppError(status_code=404, detail="post_not_found")

    # Check existing purchase
    existing = await session.execute(
        select(PostPurchase).where(
            PostPurchase.purchaser_id == fan.id,
            PostPurchase.post_id == post.id,
        )
    )
    purchase = existing.scalar_one_or_none()
    if purchase:
        return {
            "status": "already_purchased",
            "purchase_id": str(purchase.id),
        }

    purchase = PostPurchase(
        id=uuid.uuid4(),
        purchaser_id=fan.id,
        creator_id=post.creator_user_id,
        post_id=post.id,
        amount_cents=post.price_cents or 500,
        currency=post.currency or "EUR",
        ccbill_transaction_id=f"e2e_ppv_{uuid.uuid4().hex[:12]}",
        status="completed",
    )
    session.add(purchase)
    await session.commit()
    logger.info("e2e: activated post purchase fan=%s post=%s", fan_email, post_id)
    return {
        "status": "purchased",
        "purchase_id": str(purchase.id),
        "post_id": post_id,
    }


@router.post(
    "/cleanup",
    operation_id="e2e_cleanup",
    summary="[E2E] Delete test users by email prefix",
    dependencies=[Depends(_require_e2e)],
)
async def cleanup(
    email_prefix: str = Query(default="e2e+"),
    session: AsyncSession = Depends(get_async_session),
) -> dict:
    """Delete all users whose email starts with the given prefix. Use after test runs."""
    result = await session.execute(
        select(User).where(User.email.like(f"{email_prefix}%"))
    )
    users = result.scalars().all()
    count = 0
    for user in users:
        await session.delete(user)
        count += 1
    await session.commit()
    logger.info("e2e: cleaned up %d users with prefix=%s", count, email_prefix)
    return {"status": "ok", "deleted": count}
