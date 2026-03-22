"""Automated onboarding email sequence for new users.

Sends a series of emails after a user verifies their email:
  - Day 1:  Welcome email with quick-start guide
  - Day 3:  Feature discovery (AI tools, content protection, analytics)
  - Day 7:  Re-engagement prompt (first post for creators, browse for fans)

Runs daily via Celery Beat.
"""

from __future__ import annotations

import asyncio
import logging
from collections.abc import Callable
from datetime import datetime, timedelta, timezone

from celery import shared_task
from sqlalchemy import select

from app.db.session import async_session_factory
from app.modules.auth.models import User
from app.modules.onboarding.mail import _wrap_html, get_mail_provider

logger = logging.getLogger(__name__)

# How many days after email verification each email is sent.
WELCOME_DELAY_DAYS = 1
FEATURES_DELAY_DAYS = 3
REENGAGEMENT_DELAY_DAYS = 7

# Window in hours — users whose verification falls within this window get the email.
# Should match the beat schedule interval (daily = 24h).
WINDOW_HOURS = 25  # slight overlap to avoid gaps


def _welcome_email_creator() -> tuple[str, str, str]:
    subject = "Welcome to Zinovia — here's how to get started"
    text = (
        "Welcome to Zinovia Fans!\n\n"
        "You're all set. Here's how to make the most of the platform:\n\n"
        "1. Complete your profile — add an avatar, banner, and bio so fans "
        "can find you.\n"
        "2. Set your subscription price — go to Settings > Monetization.\n"
        "3. Post your first content — photos, videos, or text updates.\n"
        "4. Share your profile link — your unique URL is ready to share on "
        "social media.\n\n"
        "Need help? Reply to this email or visit https://zinovia.ai/contact\n\n"
        "Best regards,\n"
        "The Zinovia Fans Team"
    )
    html = _wrap_html(
        '<p style="margin:0 0 16px;font-size:18px;font-weight:600;">'
        "Welcome to Zinovia!</p>"
        '<p style="margin:0 0 16px;">You\'re all set. Here\'s how to make the '
        "most of the platform:</p>"
        '<ol style="margin:0 0 16px;padding-left:20px;font-size:14px;line-height:1.8;">'
        "<li><strong>Complete your profile</strong> — add an avatar, banner, and bio.</li>"
        "<li><strong>Set your subscription price</strong> — go to Settings &gt; Monetization.</li>"
        "<li><strong>Post your first content</strong> — photos, videos, or text updates.</li>"
        "<li><strong>Share your profile link</strong> — your unique URL is ready for social media.</li>"
        "</ol>"
        '<p style="margin:0 0 24px;text-align:center;">'
        '<a href="https://zinovia.ai/me" style="display:inline-block;'
        "background-color:#6366f1;color:#ffffff;font-weight:600;"
        "text-decoration:none;padding:12px 32px;border-radius:6px;"
        'font-size:16px;">Go to my profile</a></p>'
        '<p style="margin:0;font-size:13px;color:#6b7280;">'
        "Need help? Reply to this email or visit "
        '<a href="https://zinovia.ai/contact" style="color:#6366f1;">our support page</a>.</p>'
    )
    return subject, text, html


def _welcome_email_fan() -> tuple[str, str, str]:
    subject = "Welcome to Zinovia — discover creators you'll love"
    text = (
        "Welcome to Zinovia Fans!\n\n"
        "You're in. Here's what you can do:\n\n"
        "1. Browse creators — find creators by category at "
        "https://zinovia.ai/creators\n"
        "2. Follow your favorites — get notified when they post.\n"
        "3. Subscribe — unlock exclusive content from creators you love.\n"
        "4. Send messages — connect directly with creators.\n\n"
        "Start exploring: https://zinovia.ai/creators\n\n"
        "Best regards,\n"
        "The Zinovia Fans Team"
    )
    html = _wrap_html(
        '<p style="margin:0 0 16px;font-size:18px;font-weight:600;">'
        "Welcome to Zinovia!</p>"
        '<p style="margin:0 0 16px;">You\'re in. Here\'s what you can do:</p>'
        '<ol style="margin:0 0 16px;padding-left:20px;font-size:14px;line-height:1.8;">'
        "<li><strong>Browse creators</strong> — find creators by category.</li>"
        "<li><strong>Follow your favorites</strong> — get notified when they post.</li>"
        "<li><strong>Subscribe</strong> — unlock exclusive content.</li>"
        "<li><strong>Send messages</strong> — connect directly with creators.</li>"
        "</ol>"
        '<p style="margin:0 0 24px;text-align:center;">'
        '<a href="https://zinovia.ai/creators" style="display:inline-block;'
        "background-color:#6366f1;color:#ffffff;font-weight:600;"
        "text-decoration:none;padding:12px 32px;border-radius:6px;"
        'font-size:16px;">Browse creators</a></p>'
    )
    return subject, text, html


def _features_email() -> tuple[str, str, str]:
    subject = "3 features you might have missed on Zinovia"
    text = (
        "Hi there,\n\n"
        "Here are some Zinovia features designed to help you stand out:\n\n"
        "AI Studio — Virtual try-on, background removal, cartoon avatars, "
        "and motion transfer. Built-in creative tools at no extra cost.\n"
        "https://zinovia.ai/ai\n\n"
        "Content Protection — Your content is encrypted, watermarked, and "
        "delivered via signed URLs. 5-layer security.\n"
        "https://zinovia.ai/content-protection\n\n"
        "Analytics Dashboard — Track subscribers, revenue, and engagement "
        "in real time.\n"
        "https://zinovia.ai/me\n\n"
        "Best regards,\n"
        "The Zinovia Fans Team"
    )
    html = _wrap_html(
        '<p style="margin:0 0 16px;font-size:18px;font-weight:600;">'
        "3 features you might have missed</p>"
        '<div style="margin:0 0 16px;">'
        '<div style="border-left:3px solid #6366f1;padding:12px 16px;margin:0 0 12px;">'
        '<p style="margin:0 0 4px;font-weight:600;font-size:14px;">AI Studio</p>'
        '<p style="margin:0;font-size:13px;color:#6b7280;">Virtual try-on, background removal, '
        "cartoon avatars, and motion transfer. Built-in creative tools at no extra cost.</p>"
        "</div>"
        '<div style="border-left:3px solid #6366f1;padding:12px 16px;margin:0 0 12px;">'
        '<p style="margin:0 0 4px;font-weight:600;font-size:14px;">Content Protection</p>'
        '<p style="margin:0;font-size:13px;color:#6b7280;">Your content is encrypted, watermarked, '
        "and delivered via signed URLs. 5-layer security.</p>"
        "</div>"
        '<div style="border-left:3px solid #6366f1;padding:12px 16px;margin:0 0 12px;">'
        '<p style="margin:0 0 4px;font-weight:600;font-size:14px;">Analytics Dashboard</p>'
        '<p style="margin:0;font-size:13px;color:#6b7280;">Track subscribers, revenue, '
        "and engagement in real time.</p>"
        "</div>"
        "</div>"
        '<p style="margin:0 0 24px;text-align:center;">'
        '<a href="https://zinovia.ai/ai" style="display:inline-block;'
        "background-color:#6366f1;color:#ffffff;font-weight:600;"
        "text-decoration:none;padding:12px 32px;border-radius:6px;"
        'font-size:16px;">Explore AI Studio</a></p>'
    )
    return subject, text, html


def _reengagement_email_creator() -> tuple[str, str, str]:
    subject = "Your fans are waiting — publish your first post"
    text = (
        "Hi there,\n\n"
        "It's been a week since you joined Zinovia. If you haven't yet, "
        "now is a great time to publish your first post.\n\n"
        "What works well for a first post:\n"
        "- An introduction — tell fans who you are and what to expect.\n"
        "- A free preview — give fans a taste of your exclusive content.\n"
        "- A behind-the-scenes photo or video.\n\n"
        "Create your first post: https://zinovia.ai/creator/post/new\n\n"
        "Best regards,\n"
        "The Zinovia Fans Team"
    )
    html = _wrap_html(
        '<p style="margin:0 0 16px;font-size:18px;font-weight:600;">'
        "Your fans are waiting</p>"
        '<p style="margin:0 0 16px;">It\'s been a week since you joined Zinovia. '
        "If you haven't yet, now is a great time to publish your first post.</p>"
        '<div style="background:#f3f4f6;border-radius:6px;padding:16px;margin:0 0 16px;">'
        '<p style="margin:0 0 8px;font-weight:600;font-size:14px;">What works well for a first post:</p>'
        '<ul style="margin:0;padding-left:20px;font-size:14px;line-height:1.8;">'
        "<li>An introduction — tell fans who you are and what to expect.</li>"
        "<li>A free preview — give fans a taste of your exclusive content.</li>"
        "<li>A behind-the-scenes photo or video.</li>"
        "</ul></div>"
        '<p style="margin:0 0 24px;text-align:center;">'
        '<a href="https://zinovia.ai/creator/post/new" style="display:inline-block;'
        "background-color:#6366f1;color:#ffffff;font-weight:600;"
        "text-decoration:none;padding:12px 32px;border-radius:6px;"
        'font-size:16px;">Create your first post</a></p>'
    )
    return subject, text, html


def _reengagement_email_fan() -> tuple[str, str, str]:
    subject = "Discover new creators on Zinovia"
    text = (
        "Hi there,\n\n"
        "It's been a week since you joined Zinovia. Have you found "
        "creators you love yet?\n\n"
        "Browse creators by category: https://zinovia.ai/creators\n\n"
        "New creators are joining every day. Follow your favorites "
        "to get notified when they post.\n\n"
        "Best regards,\n"
        "The Zinovia Fans Team"
    )
    html = _wrap_html(
        '<p style="margin:0 0 16px;font-size:18px;font-weight:600;">'
        "Discover new creators</p>"
        '<p style="margin:0 0 16px;">It\'s been a week since you joined Zinovia. '
        "Have you found creators you love yet?</p>"
        '<p style="margin:0 0 16px;font-size:14px;">New creators are joining every day. '
        "Follow your favorites to get notified when they post.</p>"
        '<p style="margin:0 0 24px;text-align:center;">'
        '<a href="https://zinovia.ai/creators" style="display:inline-block;'
        "background-color:#6366f1;color:#ffffff;font-weight:600;"
        "text-decoration:none;padding:12px 32px;border-radius:6px;"
        'font-size:16px;">Browse creators</a></p>'
    )
    return subject, text, html


async def _send_onboarding_batch(
    delay_days: int,
    get_email_fn_creator: Callable[[], tuple[str, str, str]],
    get_email_fn_fan: Callable[[], tuple[str, str, str]],
    label: str,
) -> str:
    """Find users verified ~delay_days ago and send them the appropriate email."""
    now = datetime.now(timezone.utc)
    target_time = now - timedelta(days=delay_days)
    window_start = target_time - timedelta(hours=WINDOW_HOURS)

    provider = get_mail_provider()
    sent = 0
    failed = 0

    async with async_session_factory() as session:
        # Find users who transitioned to EMAIL_VERIFIED within the time window.
        # We use updated_at as a proxy for verification time since the state
        # transition updates it.
        result = await session.execute(
            select(User.email, User.role, User.updated_at)
            .where(User.is_active == True)  # noqa: E712
            .where(User.onboarding_state != "CREATED")  # must be verified
            .where(User.updated_at >= window_start)
            .where(User.updated_at < target_time)
        )
        users = result.all()
        logger.info("[%s] Found %d users verified ~%d days ago", label, len(users), delay_days)

        for email, role, _updated_at in users:
            try:
                if role == "creator":
                    subject, text_body, html_body = get_email_fn_creator()
                else:
                    subject, text_body, html_body = get_email_fn_fan()

                await provider.send_generic_email(
                    recipient=email,
                    subject=subject,
                    text_body=text_body,
                    html_body=html_body,
                )
                sent += 1
            except Exception:
                failed += 1
                logger.exception("[%s] Failed to send to %s", label, email)

    result_msg = f"[{label}] {sent} sent, {failed} failed, {len(users)} eligible"
    logger.info(result_msg)
    return result_msg


@shared_task(name="onboarding.send_sequence_emails")
def send_sequence_emails() -> str:
    """Run all onboarding email batches. Called daily by Celery Beat."""

    async def _run() -> str:
        results = []

        # Day 1: Welcome email
        r = await _send_onboarding_batch(
            delay_days=WELCOME_DELAY_DAYS,
            get_email_fn_creator=_welcome_email_creator,
            get_email_fn_fan=_welcome_email_fan,
            label="welcome",
        )
        results.append(r)

        # Day 3: Feature discovery
        r = await _send_onboarding_batch(
            delay_days=FEATURES_DELAY_DAYS,
            get_email_fn_creator=_features_email,
            get_email_fn_fan=_features_email,
            label="features",
        )
        results.append(r)

        # Day 7: Re-engagement
        r = await _send_onboarding_batch(
            delay_days=REENGAGEMENT_DELAY_DAYS,
            get_email_fn_creator=_reengagement_email_creator,
            get_email_fn_fan=_reengagement_email_fan,
            label="reengagement",
        )
        results.append(r)

        return " | ".join(results)

    return asyncio.run(_run())
