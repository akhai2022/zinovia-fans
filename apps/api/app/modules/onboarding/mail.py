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


class MailProvider(Protocol):
    async def send_verification_email(self, payload: VerificationEmailPayload) -> None:
        ...


def _build_verify_link(token: str) -> str:
    settings = get_settings()
    base = (settings.public_web_base_url or settings.app_base_url).rstrip("/")
    return f"{base}/verify-email?token={quote(token)}"


class ConsoleMailProvider:
    async def send_verification_email(self, payload: VerificationEmailPayload) -> None:
        verify_link = _build_verify_link(payload.token)
        # In local dev, print the link to stdout so developers can complete the flow.
        # In production, MAIL_PROVIDER should always be "ses", never "console".
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


class SesMailProvider:
    def __init__(self) -> None:
        settings = get_settings()
        self._region = settings.aws_region or "us-east-1"
        self._mail_from = settings.mail_from
        self._client = boto3.client("sesv2", region_name=self._region)

    async def send_verification_email(self, payload: VerificationEmailPayload) -> None:
        verify_link = _build_verify_link(payload.token)
        subject = "Verify your Zinovia account"
        text_body = (
            "Welcome to Zinovia.\n\n"
            "Please verify your email using this link:\n"
            f"{verify_link}\n\n"
            "This link expires in 24 hours."
        )
        html_body = (
            "<p>Welcome to Zinovia.</p>"
            "<p>Please verify your email using this link:</p>"
            f'<p><a href="{verify_link}">{verify_link}</a></p>'
            "<p>This link expires in 24 hours.</p>"
        )
        try:
            response = await asyncio.to_thread(
                self._client.send_email,
                FromEmailAddress=self._mail_from,
                Destination={"ToAddresses": [payload.recipient]},
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
            # MessageId is safe; do not log recipient or token/link.
            logger.info(
                "verification email delivered",
                extra={
                    "request_id": get_request_id(),
                    "provider": "ses",
                    "outcome": "sent",
                    "ses_message_id": response.get("MessageId"),
                },
            )
        except ClientError as exc:
            # Do not log exc message: SES errors can include the recipient email.
            error_code = exc.response.get("Error", {}).get("Code", "ClientError")
            logger.error(
                "verification email delivery failed",
                extra={
                    "request_id": get_request_id(),
                    "provider": "ses",
                    "outcome": "failed",
                    "ses_error_code": error_code,
                },
            )
            # In SES sandbox, unverified recipients typically fail as MessageRejected.
            reason = "ses_message_rejected" if error_code == "MessageRejected" else "ses_send_failed"
            raise VerificationEmailDeliveryError(reason) from exc
        except Exception as exc:  # noqa: BLE001 - wraps network/timeouts/etc
            logger.error(
                "verification email delivery failed",
                extra={
                    "request_id": get_request_id(),
                    "provider": "ses",
                    "outcome": "failed",
                    "ses_error_code": exc.__class__.__name__,
                },
            )
            raise VerificationEmailDeliveryError("ses_send_failed") from exc


def get_mail_provider() -> MailProvider:
    settings = get_settings()
    provider = settings.mail_provider.lower()
    if provider == "ses":
        return SesMailProvider()
    return ConsoleMailProvider()


async def send_verification_email(recipient: str, token: str) -> None:
    provider = get_mail_provider()
    await provider.send_verification_email(
        VerificationEmailPayload(recipient=recipient, token=token)
    )


async def send_password_reset_email(recipient: str, reset_url: str) -> None:
    """Send a password reset email via the configured mail provider."""
    settings = get_settings()
    provider_name = settings.mail_provider.lower()

    if provider_name == "console":
        if settings.environment not in ("production", "prod"):
            print(f"\n{'='*60}")
            print(f"  PASSWORD RESET EMAIL (console provider)")
            print(f"  To:   {recipient}")
            print(f"  Link: {reset_url}")
            print(f"{'='*60}\n")
        logger.info(
            "password reset email (console)",
            extra={
                "request_id": get_request_id(),
                "provider": "console",
                "outcome": "generated",
            },
        )
        return

    subject = "Reset your Zinovia password"
    text_body = (
        "You requested a password reset for your Zinovia account.\n\n"
        "Use this link to set a new password:\n"
        f"{reset_url}\n\n"
        "This link expires in 1 hour. If you didn't request this, you can safely ignore this email."
    )
    html_body = (
        "<p>You requested a password reset for your Zinovia account.</p>"
        "<p>Use this link to set a new password:</p>"
        f'<p><a href="{reset_url}">{reset_url}</a></p>'
        "<p>This link expires in 1 hour. If you didn't request this, you can safely ignore this email.</p>"
    )

    ses = SesMailProvider()
    try:
        await asyncio.to_thread(
            ses._client.send_email,
            FromEmailAddress=ses._mail_from,
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
    except Exception:
        logger.error(
            "password reset email delivery failed",
            extra={
                "request_id": get_request_id(),
                "provider": "ses",
                "outcome": "failed",
            },
        )
        raise
