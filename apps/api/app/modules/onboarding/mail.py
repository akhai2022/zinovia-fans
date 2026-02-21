from __future__ import annotations

import asyncio
import logging
from dataclasses import dataclass
from typing import Protocol
from urllib.parse import quote

import resend

from app.core.request_id import get_request_id
from app.core.settings import get_settings

logger = logging.getLogger(__name__)


class VerificationEmailDeliveryError(RuntimeError):
    """Raised when the configured provider cannot send verification email."""

    def __init__(self, reason_code: str) -> None:
        super().__init__(reason_code)
        self.reason_code = reason_code


@dataclass(slots=True)
class VerificationEmailPayload:
    recipient: str
    token: str


@dataclass(slots=True)
class PasswordResetEmailPayload:
    recipient: str
    reset_url: str


@dataclass(slots=True)
class ContactFormEmailPayload:
    sender_email: str
    category: str
    subject: str
    message: str


class MailProvider(Protocol):
    async def send_verification_email(self, payload: VerificationEmailPayload) -> None:
        ...

    async def send_password_reset_email(self, payload: PasswordResetEmailPayload) -> None:
        ...

    async def send_contact_form_email(self, payload: ContactFormEmailPayload) -> None:
        ...

    async def send_generic_email(
        self, *, recipient: str, subject: str, text_body: str, html_body: str
    ) -> None:
        ...


def _build_verify_link(token: str) -> str:
    settings = get_settings()
    base = (settings.public_web_base_url or settings.app_base_url).rstrip("/")
    return f"{base}/verify-email?token={quote(token)}"


class ConsoleMailProvider:
    async def send_verification_email(self, payload: VerificationEmailPayload) -> None:
        verify_link = _build_verify_link(payload.token)
        # In local dev, print the link to stdout so developers can complete the flow.
        settings = get_settings()
        if settings.environment not in ("production", "prod"):
            print(f"\n{'='*60}")
            print("  VERIFICATION EMAIL (console provider)")
            print(f"  To:   {payload.recipient}")
            print(f"  Link: {verify_link}")
            print(f"  Token: {payload.token}")
            print(f"{'='*60}\n")
        logger.info(
            "verification email (console)",
            extra={
                "request_id": get_request_id(),
                "provider": "console",
                "outcome": "generated",
            },
        )

    async def send_password_reset_email(self, payload: PasswordResetEmailPayload) -> None:
        settings = get_settings()
        if settings.environment not in ("production", "prod"):
            print(f"\n{'='*60}")
            print("  PASSWORD RESET EMAIL (console provider)")
            print(f"  To:   {payload.recipient}")
            print(f"  Link: {payload.reset_url}")
            print(f"{'='*60}\n")
        logger.info(
            "password reset email (console)",
            extra={
                "request_id": get_request_id(),
                "provider": "console",
                "outcome": "generated",
            },
        )

    async def send_contact_form_email(self, payload: ContactFormEmailPayload) -> None:
        settings = get_settings()
        if settings.environment not in ("production", "prod"):
            print(f"\n{'='*60}")
            print("  CONTACT FORM (console provider)")
            print(f"  From:     {payload.sender_email}")
            print(f"  Category: {payload.category}")
            print(f"  Subject:  {payload.subject}")
            print(f"  Message:  {payload.message[:200]}")
            print(f"{'='*60}\n")
        logger.info(
            "contact form email (console)",
            extra={
                "request_id": get_request_id(),
                "provider": "console",
                "outcome": "generated",
            },
        )

    async def send_generic_email(
        self, *, recipient: str, subject: str, text_body: str, html_body: str
    ) -> None:
        settings = get_settings()
        if settings.environment not in ("production", "prod"):
            print(f"\n{'='*60}")
            print("  GENERIC EMAIL (console provider)")
            print(f"  To:      {recipient}")
            print(f"  Subject: {subject}")
            print(f"  Body:    {text_body[:200]}")
            print(f"{'='*60}\n")
        logger.info(
            "generic email (console)",
            extra={
                "request_id": get_request_id(),
                "provider": "console",
                "outcome": "generated",
            },
        )


def _wrap_html(body_content: str) -> str:
    """Wrap email body in a proper HTML document structure for deliverability."""
    return (
        "<!DOCTYPE html>"
        '<html lang="en" xmlns="http://www.w3.org/1999/xhtml">'
        "<head>"
        '<meta charset="utf-8"/>'
        '<meta name="viewport" content="width=device-width, initial-scale=1.0"/>'
        "<title>Zinovia Fans</title>"
        "</head>"
        '<body style="margin:0;padding:0;font-family:-apple-system,BlinkMacSystemFont,'
        "'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:16px;line-height:1.5;"
        'color:#1a1a1a;background-color:#f9fafb;">'
        '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" '
        'style="background-color:#f9fafb;">'
        "<tr><td align=\"center\" style=\"padding:40px 20px;\">"
        '<table role="presentation" width="600" cellpadding="0" cellspacing="0" '
        'style="background-color:#ffffff;border-radius:8px;overflow:hidden;">'
        '<tr><td style="padding:32px 40px;">'
        f"{body_content}"
        '<hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0;"/>'
        '<p style="font-size:12px;color:#9ca3af;margin:0;">'
        "Zinovia Fans &mdash; the premium creator platform.<br/>"
        "You received this email because you have an account on zinovia.ai.<br/>"
        'To manage your email preferences, visit your '
        '<a href="https://zinovia.ai/settings/profile" '
        'style="color:#6366f1;">account settings</a>.'
        "</p>"
        "</td></tr></table>"
        "</td></tr></table>"
        "</body></html>"
    )


class ResendMailProvider:
    def __init__(self) -> None:
        settings = get_settings()
        resend.api_key = settings.resend_api_key
        self._mail_from = f"Zinovia Fans <{settings.mail_from}>"
        self._reply_to = settings.mail_reply_to
        self._dry_run = settings.mail_dry_run
        web_base = (settings.public_web_base_url or settings.app_base_url).rstrip("/")
        self._unsubscribe_url = f"{web_base}/settings/profile"

    async def _send_email(
        self, *, recipient: str, subject: str, text_body: str, html_body: str, email_type: str
    ) -> None:
        if self._dry_run:
            logger.info(
                "%s email DRY-RUN (not sent)",
                email_type,
                extra={
                    "request_id": get_request_id(),
                    "provider": "resend",
                    "outcome": "dry_run",
                    "to": recipient,
                    "subject": subject,
                    "from": self._mail_from,
                },
            )
            return
        try:
            params: resend.Emails.SendParams = {
                "from": self._mail_from,
                "to": [recipient],
                "reply_to": [self._reply_to],
                "subject": subject,
                "html": html_body,
                "text": text_body,
                "headers": {
                    "List-Unsubscribe": f"<{self._unsubscribe_url}>",
                    "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
                },
            }
            response = await asyncio.to_thread(resend.Emails.send, params)
            logger.info(
                "%s email delivered",
                email_type,
                extra={
                    "request_id": get_request_id(),
                    "provider": "resend",
                    "outcome": "sent",
                    "resend_id": response.get("id") if isinstance(response, dict) else None,
                },
            )
        except resend.exceptions.ResendError as exc:
            logger.error(
                "%s email delivery failed",
                email_type,
                extra={
                    "request_id": get_request_id(),
                    "provider": "resend",
                    "outcome": "failed",
                    "error": str(exc),
                },
            )
            raise VerificationEmailDeliveryError("resend_send_failed") from exc
        except Exception as exc:  # noqa: BLE001 - wraps network/timeouts/etc
            logger.error(
                "%s email delivery failed",
                email_type,
                extra={
                    "request_id": get_request_id(),
                    "provider": "resend",
                    "outcome": "failed",
                    "error": exc.__class__.__name__,
                },
            )
            raise VerificationEmailDeliveryError("resend_send_failed") from exc

    async def send_verification_email(self, payload: VerificationEmailPayload) -> None:
        verify_link = _build_verify_link(payload.token)
        await self._send_email(
            recipient=payload.recipient,
            subject="Verify your email address",
            text_body=(
                "Welcome to Zinovia Fans!\n\n"
                "Thank you for signing up. To complete your registration and "
                "start exploring the platform, please verify your email address "
                "by visiting the link below:\n\n"
                f"{verify_link}\n\n"
                "This verification link will expire in 24 hours. If you did not "
                "create an account on Zinovia Fans, you can safely ignore this email.\n\n"
                "Best regards,\n"
                "The Zinovia Fans Team\n"
                "https://zinovia.ai"
            ),
            html_body=_wrap_html(
                '<p style="margin:0 0 16px;">Welcome to Zinovia Fans!</p>'
                '<p style="margin:0 0 16px;">Thank you for signing up. To complete your '
                "registration and start exploring the platform, please verify your "
                "email address:</p>"
                '<p style="margin:0 0 24px;text-align:center;">'
                '<a href="' + verify_link + '" style="display:inline-block;'
                "background-color:#6366f1;color:#ffffff;font-weight:600;"
                "text-decoration:none;padding:12px 32px;border-radius:6px;"
                'font-size:16px;">Verify my email</a></p>'
                '<p style="margin:0 0 8px;font-size:13px;color:#6b7280;">'
                "Or copy and paste this link into your browser:</p>"
                '<p style="margin:0 0 16px;font-size:13px;word-break:break-all;">'
                f'<a href="{verify_link}" style="color:#6366f1;">{verify_link}</a></p>'
                '<p style="margin:0 0 8px;font-size:13px;color:#6b7280;">'
                "This link expires in 24 hours. If you did not create an account "
                "on Zinovia Fans, you can safely ignore this email.</p>"
            ),
            email_type="verification",
        )

    async def send_contact_form_email(self, payload: ContactFormEmailPayload) -> None:
        settings = get_settings()
        support_email = settings.mail_reply_to  # support@zinovia.ai
        category_label = payload.category.replace("_", " ").title()
        # Escape HTML in user-provided content
        import html as _html
        safe_message = _html.escape(payload.message).replace("\n", "<br/>")
        safe_subject = _html.escape(payload.subject)
        safe_email = _html.escape(payload.sender_email)
        safe_category = _html.escape(category_label)

        await self._send_email(
            recipient=support_email,
            subject=f"[Contact] {category_label}: {payload.subject}",
            text_body=(
                f"New contact form submission\n\n"
                f"Category: {category_label}\n"
                f"From: {payload.sender_email}\n"
                f"Subject: {payload.subject}\n\n"
                f"Message:\n{payload.message}\n"
            ),
            html_body=_wrap_html(
                f'<p style="margin:0 0 16px;font-size:18px;font-weight:600;">New Contact Form Submission</p>'
                f'<table style="width:100%;border-collapse:collapse;margin:0 0 16px;">'
                f'<tr><td style="padding:6px 12px 6px 0;color:#6b7280;font-size:14px;vertical-align:top;">Category</td>'
                f'<td style="padding:6px 0;font-size:14px;">{safe_category}</td></tr>'
                f'<tr><td style="padding:6px 12px 6px 0;color:#6b7280;font-size:14px;vertical-align:top;">From</td>'
                f'<td style="padding:6px 0;font-size:14px;"><a href="mailto:{safe_email}" style="color:#6366f1;">{safe_email}</a></td></tr>'
                f'<tr><td style="padding:6px 12px 6px 0;color:#6b7280;font-size:14px;vertical-align:top;">Subject</td>'
                f'<td style="padding:6px 0;font-size:14px;">{safe_subject}</td></tr>'
                f'</table>'
                f'<div style="background:#f3f4f6;border-radius:6px;padding:16px;font-size:14px;line-height:1.6;">'
                f'{safe_message}'
                f'</div>'
            ),
            email_type="contact_form",
        )

    async def send_generic_email(
        self, *, recipient: str, subject: str, text_body: str, html_body: str
    ) -> None:
        await self._send_email(
            recipient=recipient,
            subject=subject,
            text_body=text_body,
            html_body=html_body,
            email_type="generic",
        )

    async def send_password_reset_email(self, payload: PasswordResetEmailPayload) -> None:
        await self._send_email(
            recipient=payload.recipient,
            subject="Reset your password",
            text_body=(
                "Password Reset Request\n\n"
                "You requested a password reset for your Zinovia Fans account. "
                "Use the link below to set a new password:\n\n"
                f"{payload.reset_url}\n\n"
                "This link expires in 1 hour. If you didn't request a password "
                "reset, you can safely ignore this email — your password will "
                "remain unchanged.\n\n"
                "Best regards,\n"
                "The Zinovia Fans Team\n"
                "https://zinovia.ai"
            ),
            html_body=_wrap_html(
                '<p style="margin:0 0 16px;">Password Reset Request</p>'
                '<p style="margin:0 0 16px;">You requested a password reset for your '
                "Zinovia Fans account. Click the button below to set a new password:</p>"
                '<p style="margin:0 0 24px;text-align:center;">'
                '<a href="' + payload.reset_url + '" style="display:inline-block;'
                "background-color:#6366f1;color:#ffffff;font-weight:600;"
                "text-decoration:none;padding:12px 32px;border-radius:6px;"
                'font-size:16px;">Reset password</a></p>'
                '<p style="margin:0 0 8px;font-size:13px;color:#6b7280;">'
                "Or copy and paste this link into your browser:</p>"
                '<p style="margin:0 0 16px;font-size:13px;word-break:break-all;">'
                f'<a href="{payload.reset_url}" style="color:#6366f1;">'
                f"{payload.reset_url}</a></p>"
                '<p style="margin:0 0 8px;font-size:13px;color:#6b7280;">'
                "This link expires in 1 hour. If you didn't request this, "
                "you can safely ignore this email.</p>"
            ),
            email_type="password_reset",
        )


class MailpitProvider:
    """Send emails via SMTP to a local Mailpit instance (no auth, no TLS)."""

    def __init__(self) -> None:
        settings = get_settings()
        self._host = settings.mailpit_host
        self._port = settings.mailpit_port
        self._mail_from = settings.mail_from
        self._reply_to = settings.mail_reply_to

    async def _send_email(
        self, *, recipient: str, subject: str, text_body: str, html_body: str, email_type: str
    ) -> None:
        import smtplib
        from email.mime.multipart import MIMEMultipart
        from email.mime.text import MIMEText

        msg = MIMEMultipart("alternative")
        msg["Subject"] = subject
        msg["From"] = self._mail_from
        msg["To"] = recipient
        msg["Reply-To"] = self._reply_to
        settings = get_settings()
        web_base = (settings.public_web_base_url or settings.app_base_url).rstrip("/")
        msg["List-Unsubscribe"] = f"<{web_base}/settings/profile>"
        msg["List-Unsubscribe-Post"] = "List-Unsubscribe=One-Click"
        msg.attach(MIMEText(text_body, "plain", "utf-8"))
        msg.attach(MIMEText(html_body, "html", "utf-8"))

        def _send() -> None:
            with smtplib.SMTP(self._host, self._port) as server:
                server.send_message(msg)

        await asyncio.to_thread(_send)
        logger.info(
            "%s email delivered",
            email_type,
            extra={
                "request_id": get_request_id(),
                "provider": "mailpit",
                "outcome": "sent",
            },
        )

    async def send_generic_email(
        self, *, recipient: str, subject: str, text_body: str, html_body: str
    ) -> None:
        await self._send_email(
            recipient=recipient,
            subject=subject,
            text_body=text_body,
            html_body=html_body,
            email_type="generic",
        )

    async def send_verification_email(self, payload: VerificationEmailPayload) -> None:
        verify_link = _build_verify_link(payload.token)
        await self._send_email(
            recipient=payload.recipient,
            subject="Verify your Zinovia Fans account",
            text_body=(
                "Welcome to Zinovia Fans.\n\n"
                "Please verify your email using this link:\n"
                f"{verify_link}\n\n"
                "This link expires in 24 hours."
            ),
            html_body=(
                "<p>Welcome to Zinovia Fans.</p>"
                "<p>Please verify your email using this link:</p>"
                f'<p><a href="{verify_link}">{verify_link}</a></p>'
                "<p>This link expires in 24 hours.</p>"
            ),
            email_type="verification",
        )

    async def send_contact_form_email(self, payload: ContactFormEmailPayload) -> None:
        settings = get_settings()
        support_email = settings.mail_reply_to
        category_label = payload.category.replace("_", " ").title()
        await self._send_email(
            recipient=support_email,
            subject=f"[Contact] {category_label}: {payload.subject}",
            text_body=(
                f"New contact form submission\n\n"
                f"Category: {category_label}\n"
                f"From: {payload.sender_email}\n"
                f"Subject: {payload.subject}\n\n"
                f"Message:\n{payload.message}\n"
            ),
            html_body=(
                f"<p><strong>New Contact Form Submission</strong></p>"
                f"<p>Category: {category_label}<br/>"
                f"From: {payload.sender_email}<br/>"
                f"Subject: {payload.subject}</p>"
                f"<p>{payload.message}</p>"
            ),
            email_type="contact_form",
        )

    async def send_password_reset_email(self, payload: PasswordResetEmailPayload) -> None:
        await self._send_email(
            recipient=payload.recipient,
            subject="Reset your password — Zinovia Fans",
            text_body=(
                "You requested a password reset for your Zinovia Fans account.\n\n"
                "Use this link to set a new password:\n"
                f"{payload.reset_url}\n\n"
                "This link expires in 1 hour. If you didn't request this, "
                "you can safely ignore this email."
            ),
            html_body=(
                "<p>You requested a password reset for your Zinovia Fans account.</p>"
                "<p>Use this link to set a new password:</p>"
                f'<p><a href="{payload.reset_url}">{payload.reset_url}</a></p>'
                "<p>This link expires in 1 hour. If you didn't request this, "
                "you can safely ignore this email.</p>"
            ),
            email_type="password_reset",
        )


def get_mail_provider() -> MailProvider:
    settings = get_settings()
    provider = settings.mail_provider.lower()
    if provider == "resend":
        return ResendMailProvider()
    if provider == "mailpit":
        return MailpitProvider()
    return ConsoleMailProvider()


async def send_verification_email(recipient: str, token: str) -> None:
    provider = get_mail_provider()
    await provider.send_verification_email(
        VerificationEmailPayload(recipient=recipient, token=token)
    )


async def send_password_reset_email(recipient: str, reset_url: str) -> None:
    """Send a password reset email via the configured mail provider."""
    provider = get_mail_provider()
    await provider.send_password_reset_email(
        PasswordResetEmailPayload(recipient=recipient, reset_url=reset_url)
    )


async def send_contact_form_email(
    *, sender_email: str, category: str, subject: str, message: str
) -> None:
    """Forward a contact form submission to support via the configured mail provider."""
    provider = get_mail_provider()
    await provider.send_contact_form_email(
        ContactFormEmailPayload(
            sender_email=sender_email,
            category=category,
            subject=subject,
            message=message,
        )
    )


async def send_admin_notification_email(
    recipient: str, title: str, message: str
) -> None:
    """Send an admin broadcast notification email to a user."""
    import html as _html

    safe_title = _html.escape(title)
    safe_message = _html.escape(message).replace("\n", "<br/>")

    subject = f"Zinovia Fans: {title}"
    text_body = (
        f"{title}\n\n"
        f"{message}\n\n"
        "Best regards,\n"
        "The Zinovia Fans Team\n"
        "https://zinovia.ai"
    )
    html_body = _wrap_html(
        f'<p style="margin:0 0 16px;font-size:18px;font-weight:600;">{safe_title}</p>'
        f'<div style="margin:0 0 16px;font-size:14px;line-height:1.6;">{safe_message}</div>'
    )
    provider = get_mail_provider()
    await provider.send_generic_email(
        recipient=recipient,
        subject=subject,
        text_body=text_body,
        html_body=html_body,
    )
