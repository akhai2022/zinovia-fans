from __future__ import annotations

import asyncio
import logging
from dataclasses import dataclass
from typing import Protocol
from urllib.parse import quote

import boto3
from botocore.exceptions import ClientError

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


class MailProvider(Protocol):
    async def send_verification_email(self, payload: VerificationEmailPayload) -> None:
        ...

    async def send_password_reset_email(self, payload: PasswordResetEmailPayload) -> None:
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
            print(f"  VERIFICATION EMAIL (console provider)")
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
            print(f"  PASSWORD RESET EMAIL (console provider)")
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


class SesMailProvider:
    def __init__(self) -> None:
        settings = get_settings()
        self._region = settings.aws_region or "us-east-1"
        self._mail_from = settings.mail_from
        self._client = boto3.client("sesv2", region_name=self._region)

    async def _send_email(
        self, *, recipient: str, subject: str, text_body: str, html_body: str, email_type: str
    ) -> None:
        try:
            response = await asyncio.to_thread(
                self._client.send_email,
                FromEmailAddress=self._mail_from,
                Destination={"ToAddresses": [recipient]},
                Content={
                    "Simple": {
                        "Subject": {"Data": subject, "Charset": "UTF-8"},
                        "Body": {
                            "Text": {"Data": text_body, "Charset": "UTF-8"},
                            "Html": {"Data": html_body, "Charset": "UTF-8"},
                        },
                    }
                },
            )
            logger.info(
                "%s email delivered",
                email_type,
                extra={
                    "request_id": get_request_id(),
                    "provider": "ses",
                    "outcome": "sent",
                    "ses_message_id": response.get("MessageId"),
                },
            )
        except ClientError as exc:
            error_code = exc.response.get("Error", {}).get("Code", "ClientError")
            logger.error(
                "%s email delivery failed",
                email_type,
                extra={
                    "request_id": get_request_id(),
                    "provider": "ses",
                    "outcome": "failed",
                    "ses_error_code": error_code,
                },
            )
            reason = "ses_message_rejected" if error_code == "MessageRejected" else "ses_send_failed"
            raise VerificationEmailDeliveryError(reason) from exc
        except Exception as exc:  # noqa: BLE001 - wraps network/timeouts/etc
            logger.error(
                "%s email delivery failed",
                email_type,
                extra={
                    "request_id": get_request_id(),
                    "provider": "ses",
                    "outcome": "failed",
                    "ses_error_code": exc.__class__.__name__,
                },
            )
            raise VerificationEmailDeliveryError("ses_send_failed") from exc

    async def send_verification_email(self, payload: VerificationEmailPayload) -> None:
        verify_link = _build_verify_link(payload.token)
        await self._send_email(
            recipient=payload.recipient,
            subject="Verify your Zinovia account",
            text_body=(
                "Welcome to Zinovia.\n\n"
                "Please verify your email using this link:\n"
                f"{verify_link}\n\n"
                "This link expires in 24 hours."
            ),
            html_body=(
                "<p>Welcome to Zinovia.</p>"
                "<p>Please verify your email using this link:</p>"
                f'<p><a href="{verify_link}">{verify_link}</a></p>'
                "<p>This link expires in 24 hours.</p>"
            ),
            email_type="verification",
        )

    async def send_password_reset_email(self, payload: PasswordResetEmailPayload) -> None:
        await self._send_email(
            recipient=payload.recipient,
            subject="Reset your Zinovia password",
            text_body=(
                "You requested a password reset for your Zinovia account.\n\n"
                "Use this link to set a new password:\n"
                f"{payload.reset_url}\n\n"
                "This link expires in 1 hour. If you didn't request this, "
                "you can safely ignore this email."
            ),
            html_body=(
                "<p>You requested a password reset for your Zinovia account.</p>"
                "<p>Use this link to set a new password:</p>"
                f'<p><a href="{payload.reset_url}">{payload.reset_url}</a></p>'
                "<p>This link expires in 1 hour. If you didn't request this, "
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

    async def send_verification_email(self, payload: VerificationEmailPayload) -> None:
        verify_link = _build_verify_link(payload.token)
        await self._send_email(
            recipient=payload.recipient,
            subject="Verify your Zinovia account",
            text_body=(
                "Welcome to Zinovia.\n\n"
                "Please verify your email using this link:\n"
                f"{verify_link}\n\n"
                "This link expires in 24 hours."
            ),
            html_body=(
                "<p>Welcome to Zinovia.</p>"
                "<p>Please verify your email using this link:</p>"
                f'<p><a href="{verify_link}">{verify_link}</a></p>'
                "<p>This link expires in 24 hours.</p>"
            ),
            email_type="verification",
        )

    async def send_password_reset_email(self, payload: PasswordResetEmailPayload) -> None:
        await self._send_email(
            recipient=payload.recipient,
            subject="Reset your Zinovia password",
            text_body=(
                "You requested a password reset for your Zinovia account.\n\n"
                "Use this link to set a new password:\n"
                f"{payload.reset_url}\n\n"
                "This link expires in 1 hour. If you didn't request this, "
                "you can safely ignore this email."
            ),
            html_body=(
                "<p>You requested a password reset for your Zinovia account.</p>"
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
    if provider == "ses":
        return SesMailProvider()
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
