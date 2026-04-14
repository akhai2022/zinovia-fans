"""Retry behaviour for the Resend mail provider.

Regression test for silent onboarding failures: transient Resend errors
must not strand new creators. Verifies retry on 5xx / generic errors
and fail-fast on 4xx client errors.
"""

from __future__ import annotations

from unittest.mock import patch

import pytest

from app.modules.onboarding.mail import (
    ResendMailProvider,
    VerificationEmailDeliveryError,
    _RESEND_RETRY_DELAYS,
)


class _FakeResendError(Exception):
    def __init__(self, status_code: int, message: str = "boom") -> None:
        super().__init__(message)
        self.status_code = status_code


@pytest.fixture
def provider(monkeypatch: pytest.MonkeyPatch) -> ResendMailProvider:
    monkeypatch.setenv("MAIL_DRY_RUN", "false")
    monkeypatch.setenv("MAIL_PROVIDER", "resend")
    monkeypatch.setenv("RESEND_API_KEY", "test-key")
    monkeypatch.setenv("MAIL_FROM", "noreply@test.local")
    monkeypatch.setenv("MAIL_REPLY_TO", "support@test.local")
    from app.core.settings import get_settings

    get_settings.cache_clear()  # type: ignore[attr-defined]
    return ResendMailProvider()


@pytest.mark.asyncio
async def test_send_succeeds_on_first_attempt(provider: ResendMailProvider) -> None:
    calls = {"n": 0}

    def fake_send(_: dict) -> dict:
        calls["n"] += 1
        return {"id": "resend-1"}

    with patch("app.modules.onboarding.mail.resend.Emails.send", side_effect=fake_send):
        await provider._send_email(
            recipient="user@test.local",
            subject="s",
            text_body="t",
            html_body="<p>h</p>",
            email_type="verification",
        )
    assert calls["n"] == 1


@pytest.mark.asyncio
async def test_send_retries_transient_and_succeeds(
    provider: ResendMailProvider, monkeypatch: pytest.MonkeyPatch
) -> None:
    """A transient network failure on attempt 1 is retried and eventually succeeds."""
    calls = {"n": 0}

    def fake_send(_: dict) -> dict:
        calls["n"] += 1
        if calls["n"] < 3:
            raise RuntimeError("connection reset")
        return {"id": "resend-ok"}

    async def no_sleep(_: float) -> None:
        return None

    monkeypatch.setattr("app.modules.onboarding.mail.asyncio.sleep", no_sleep)
    with patch("app.modules.onboarding.mail.resend.Emails.send", side_effect=fake_send):
        await provider._send_email(
            recipient="user@test.local",
            subject="s",
            text_body="t",
            html_body="<p>h</p>",
            email_type="verification",
        )
    assert calls["n"] == 3  # failed, failed, succeeded


@pytest.mark.asyncio
async def test_send_exhausts_retries_and_raises(
    provider: ResendMailProvider, monkeypatch: pytest.MonkeyPatch
) -> None:
    """When every attempt fails transiently, caller sees VerificationEmailDeliveryError."""
    calls = {"n": 0}

    def fake_send(_: dict) -> dict:
        calls["n"] += 1
        raise RuntimeError("permanent network failure")

    async def no_sleep(_: float) -> None:
        return None

    monkeypatch.setattr("app.modules.onboarding.mail.asyncio.sleep", no_sleep)
    with patch("app.modules.onboarding.mail.resend.Emails.send", side_effect=fake_send):
        with pytest.raises(VerificationEmailDeliveryError) as exc_info:
            await provider._send_email(
                recipient="user@test.local",
                subject="s",
                text_body="t",
                html_body="<p>h</p>",
                email_type="verification",
            )
    assert exc_info.value.reason_code == "resend_send_failed"
    assert calls["n"] == len(_RESEND_RETRY_DELAYS) + 1


@pytest.mark.asyncio
async def test_resend_4xx_does_not_retry(
    provider: ResendMailProvider, monkeypatch: pytest.MonkeyPatch
) -> None:
    """Client-side Resend errors (4xx) must fail fast — retrying won't help."""
    import app.modules.onboarding.mail as mail_module

    monkeypatch.setattr(
        mail_module.resend.exceptions, "ResendError", _FakeResendError, raising=False
    )
    calls = {"n": 0}

    def fake_send(_: dict) -> dict:
        calls["n"] += 1
        raise _FakeResendError(status_code=422, message="invalid from address")

    async def no_sleep(_: float) -> None:
        return None

    monkeypatch.setattr("app.modules.onboarding.mail.asyncio.sleep", no_sleep)
    with patch("app.modules.onboarding.mail.resend.Emails.send", side_effect=fake_send):
        with pytest.raises(VerificationEmailDeliveryError):
            await provider._send_email(
                recipient="user@test.local",
                subject="s",
                text_body="t",
                html_body="<p>h</p>",
                email_type="verification",
            )
    assert calls["n"] == 1  # no retry on 4xx
