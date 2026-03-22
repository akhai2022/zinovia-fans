"""One-off admin task: send help email to unverified users."""

from __future__ import annotations

import asyncio
import logging

from celery import shared_task
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.core.settings import get_settings

logger = logging.getLogger(__name__)


def _make_session_factory() -> async_sessionmaker[AsyncSession]:
    engine = create_async_engine(str(get_settings().database_url), pool_pre_ping=True)
    return async_sessionmaker(engine, expire_on_commit=False, class_=AsyncSession)


@shared_task(name="admin.send_verification_help_email")
def send_verification_help_email() -> str:
    """Send a help email to all users stuck in CREATED state (unverified email)."""

    async def _run() -> str:
        from app.modules.auth.models import User
        from app.modules.onboarding.mail import get_mail_provider

        provider = get_mail_provider()
        async with _make_session_factory()() as session:
            r = await session.execute(
                select(User.email, User.onboarding_state)
                .where(User.onboarding_state == "CREATED")
                .where(User.is_active == True)  # noqa: E712
            )
            users = r.all()
            logger.info("Found %d unverified users", len(users))

            sent = 0
            failed = 0
            for email, _state in users:
                try:
                    await provider.send_generic_email(
                        recipient=email,
                        subject="Action needed: Complete your Zinovia Fans signup",
                        text_body=(
                            "Hi,\n\n"
                            "Thank you for signing up on Zinovia Fans!\n\n"
                            "If you have not received your verification email, "
                            "please follow these steps:\n\n"
                            "1. Check your spam or junk folder - look for an email "
                            "from noreply@zinovia.ai with the subject "
                            "'Verify your email address'.\n\n"
                            "2. Add noreply@zinovia.ai to your contacts or safe "
                            "senders list.\n\n"
                            "3. Request a new verification email - go to "
                            "https://zinovia.ai/login, enter your credentials, "
                            "and click 'Resend verification email'.\n\n"
                            "4. Gmail users: check the Promotions or Updates tab, "
                            "not just the Primary inbox.\n\n"
                            "5. If using a corporate or university email, try "
                            "signing up with a personal Gmail, Outlook, or Yahoo "
                            "address.\n\n"
                            "If you still cannot verify your account, reply to "
                            "this email and we will help you.\n\n"
                            "Best regards,\n"
                            "The Zinovia Fans Team\n"
                            "https://zinovia.ai"
                        ),
                        html_body=(
                            "<p>Hi,</p>"
                            "<p>Thank you for signing up on <strong>Zinovia Fans</strong>!</p>"
                            "<p>If you have not received your verification email, "
                            "please follow these steps:</p>"
                            "<ol>"
                            "<li><strong>Check your spam or junk folder</strong> — "
                            "look for an email from <code>noreply@zinovia.ai</code> "
                            "with the subject <em>Verify your email address</em>.</li>"
                            "<li><strong>Add us to your contacts</strong> — add "
                            "<code>noreply@zinovia.ai</code> to your safe senders list.</li>"
                            "<li><strong>Request a new verification email</strong> — "
                            "go to <a href='https://zinovia.ai/login'>zinovia.ai/login</a>, "
                            "enter your credentials, and click <em>Resend verification "
                            "email</em>.</li>"
                            "<li><strong>Gmail users</strong>: check the Promotions or "
                            "Updates tab, not just Primary.</li>"
                            "<li>If using a corporate email, try a personal Gmail, "
                            "Outlook, or Yahoo address.</li>"
                            "</ol>"
                            "<p>If you still cannot verify, reply to this email and "
                            "we will help you.</p>"
                            "<p>Best regards,<br/>"
                            "The Zinovia Fans Team<br/>"
                            "<a href='https://zinovia.ai'>zinovia.ai</a></p>"
                        ),
                    )
                    sent += 1
                    logger.info("Sent help email to %s", email)
                except Exception as e:
                    failed += 1
                    logger.error("Failed to send help email to %s: %s", email, str(e)[:200])

            result = f"Done: {sent} sent, {failed} failed, {len(users)} total unverified"
            logger.info(result)
            return result

    return asyncio.run(_run())
