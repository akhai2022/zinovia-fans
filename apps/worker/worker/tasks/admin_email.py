"""One-off admin tasks: send targeted emails to user cohorts."""

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


@shared_task(name="admin.send_kyc_reminder_email")
def send_kyc_reminder_email() -> str:
    """Send a motivational email to all creators stuck in KYC_PENDING or EMAIL_VERIFIED.

    These creators signed up and verified their email but never submitted
    their identity documents. The email explains how to complete verification
    and motivates them to start posting and earning.
    """

    async def _run() -> str:
        from app.modules.auth.models import User, Profile
        from app.modules.onboarding.mail import _wrap_html, get_mail_provider

        provider = get_mail_provider()
        async with _make_session_factory()() as session:
            r = await session.execute(
                select(User.email, Profile.display_name, User.onboarding_state)
                .outerjoin(Profile, Profile.user_id == User.id)
                .where(User.onboarding_state.in_(["KYC_PENDING", "EMAIL_VERIFIED"]))
                .where(User.is_active == True)  # noqa: E712
                .where(User.role == "creator")
            )
            users = r.all()
            logger.info("Found %d creators awaiting KYC completion", len(users))

            sent = 0
            failed = 0
            for email, display_name, _state in users:
                name = display_name or "there"
                try:
                    text_body = (
                        f"Hi {name},\n\n"
                        "You're almost there! Your Zinovia creator account is set up "
                        "and your email is verified — all that's left is a quick "
                        "identity verification so you can start posting and earning.\n\n"
                        "HOW TO COMPLETE YOUR VERIFICATION\n"
                        "==================================\n\n"
                        "1. Log in at https://zinovia.ai/login\n"
                        "2. You'll be guided to the verification page\n"
                        "3. Take a clear photo of any government-issued ID "
                        "(passport, national ID card, or driver's license)\n"
                        "4. Take a quick selfie so we can match your face to your ID\n"
                        "5. Enter your date of birth\n"
                        "6. Submit — that's it!\n\n"
                        "The review takes less than 24 hours. Once approved, "
                        "your creator profile goes live immediately.\n\n"
                        "WHAT HAPPENS AFTER VERIFICATION?\n"
                        "=================================\n\n"
                        "- Set your subscription price and start earning from day one\n"
                        "- Post photos, videos, and exclusive content for your fans\n"
                        "- Use our AI Studio to create stunning content "
                        "(virtual try-on, motion transfer, background removal...)\n"
                        "- Get discovered by fans through our platform\n"
                        "- Receive payouts directly to your bank account\n\n"
                        "Creators who complete verification and post within "
                        "the first week see 3x more engagement.\n\n"
                        "Don't miss out — complete your verification now:\n"
                        "https://zinovia.ai/login\n\n"
                        "If you have any questions or need help, just reply "
                        "to this email.\n\n"
                        "See you on Zinovia!\n"
                        "The Zinovia Team\n"
                        "https://zinovia.ai"
                    )
                    html_body = _wrap_html(
                        f"<p>Hi <strong>{name}</strong>,</p>"
                        "<p>You're almost there! Your Zinovia creator account is set up "
                        "and your email is verified — all that's left is a <strong>quick "
                        "identity verification</strong> so you can start posting and earning.</p>"
                        '<h3 style="color:#6366f1;margin-top:24px;">How to complete your verification</h3>'
                        '<ol style="line-height:1.8;">'
                        '<li>Log in at <a href="https://zinovia.ai/login" '
                        'style="color:#6366f1;font-weight:600;">zinovia.ai</a></li>'
                        "<li>You'll be guided to the verification page</li>"
                        "<li>Take a <strong>clear photo of any government-issued ID</strong> "
                        "(passport, national ID card, or driver's license)</li>"
                        "<li>Take a <strong>quick selfie</strong> so we can match "
                        "your face to your ID</li>"
                        "<li>Enter your <strong>date of birth</strong></li>"
                        "<li>Submit — <strong>that's it!</strong></li>"
                        "</ol>"
                        '<p style="background:#f0f0ff;padding:12px 16px;border-radius:8px;'
                        'border-left:4px solid #6366f1;">'
                        "The review takes <strong>less than 24 hours</strong>. "
                        "Once approved, your creator profile goes live immediately.</p>"
                        '<h3 style="color:#6366f1;margin-top:24px;">What happens after verification?</h3>'
                        "<ul>"
                        "<li><strong>Set your subscription price</strong> and start earning from day one</li>"
                        "<li><strong>Post photos, videos, and exclusive content</strong> for your fans</li>"
                        "<li>Use our <strong>AI Studio</strong> to create stunning content "
                        "(virtual try-on, motion transfer, background removal...)</li>"
                        "<li><strong>Get discovered</strong> by fans through our platform</li>"
                        "<li>Receive <strong>payouts directly</strong> to your bank account</li>"
                        "</ul>"
                        '<p style="font-style:italic;color:#6b7280;">'
                        "Creators who complete verification and post within "
                        "the first week see <strong>3x more engagement</strong>.</p>"
                        '<p style="text-align:center;margin:28px 0;">'
                        '<a href="https://zinovia.ai/login" '
                        'style="display:inline-block;background:#6366f1;color:#ffffff;'
                        "padding:14px 32px;border-radius:8px;text-decoration:none;"
                        'font-weight:600;font-size:16px;">'
                        "Complete my verification &rarr;"
                        "</a></p>"
                        "<p>If you have any questions, just reply to this email.</p>"
                        "<p>See you on Zinovia!<br/>"
                        "<strong>The Zinovia Team</strong></p>"
                    )
                    await provider.send_generic_email(
                        recipient=email,
                        subject="You're one step away from earning on Zinovia",
                        text_body=text_body,
                        html_body=html_body,
                    )
                    sent += 1
                    logger.info("Sent KYC reminder to %s", email)
                    # Resend rate limit: 5 req/s — pace at ~3 req/s to stay safe
                    await asyncio.sleep(0.35)
                except Exception as e:
                    failed += 1
                    cause = str(e.__cause__) if e.__cause__ else str(e)
                    logger.error("Failed to send KYC reminder to %s: %s (cause: %s)", email, str(e), cause[:200])
                    await asyncio.sleep(0.5)

            result = f"Done: {sent} sent, {failed} failed, {len(users)} total KYC-pending creators"
            logger.info(result)
            return result

    return asyncio.run(_run())
