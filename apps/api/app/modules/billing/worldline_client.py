"""Worldline Connect API client: hosted checkout, webhook verification, status queries."""

from __future__ import annotations

import base64
import hashlib
import hmac
import logging
from datetime import datetime, timezone
from decimal import Decimal

import httpx

from app.core.settings import get_settings

logger = logging.getLogger(__name__)


def worldline_configured() -> bool:
    """True if Worldline credentials are set."""
    settings = get_settings()
    return bool(
        settings.worldline_merchant_id
        and settings.worldline_api_key
        and settings.worldline_api_secret
    )


# ---------------------------------------------------------------------------
# Authentication helpers
# ---------------------------------------------------------------------------

def _auth_header(method: str, url_path: str, content_type: str = "") -> dict[str, str]:
    """Build Worldline v1 HMAC-SHA256 authorization header.

    See: https://docs.direct.worldline-solutions.com/en/integration/api-developer-guide/authentication
    """
    settings = get_settings()
    date = datetime.now(timezone.utc).strftime("%a, %d %b %Y %H:%M:%S GMT")

    # String to sign: METHOD\nContent-Type\nDate\nCanonicalizedPath
    string_to_sign = f"{method}\n{content_type}\n{date}\n{url_path}\n"

    secret_bytes = base64.b64decode(settings.worldline_api_secret)
    signature = base64.b64encode(
        hmac.new(secret_bytes, string_to_sign.encode("utf-8"), hashlib.sha256).digest()
    ).decode("utf-8")

    return {
        "Date": date,
        "Authorization": f"GCS v1HMAC:SHA256:{settings.worldline_api_key}:{signature}",
    }


# ---------------------------------------------------------------------------
# Hosted checkout
# ---------------------------------------------------------------------------

async def create_hosted_checkout(
    *,
    amount_cents: int,
    currency: str = "EUR",
    description: str = "",
    return_url: str,
    custom_fields: dict[str, str] | None = None,
    recurring: bool = False,
    tokens_requested: bool = False,
) -> dict:
    """Create a Worldline Hosted Checkout session.

    Returns dict with:
      - checkout_url: URL to redirect the customer to
      - hosted_checkout_id: Worldline's hosted checkout ID
      - return_mac: MAC for return URL verification
    """
    settings = get_settings()
    merchant_id = settings.worldline_merchant_id
    api_endpoint = settings.worldline_api_endpoint
    url_path = f"/v2/{merchant_id}/hostedcheckouts"
    full_url = f"{api_endpoint}{url_path}"

    body: dict = {
        "order": {
            "amountOfMoney": {
                "amount": amount_cents,
                "currencyCode": currency.upper(),
            },
            "references": {
                "descriptor": description or "Zinovia Fans",
            },
        },
        "hostedCheckoutSpecificInput": {
            "returnUrl": return_url,
            "showResultPage": False,
            "variant": "100",
        },
    }

    if recurring or tokens_requested:
        body["hostedCheckoutSpecificInput"]["isRecurring"] = True
        body.setdefault("cardPaymentMethodSpecificInput", {})
        body["cardPaymentMethodSpecificInput"]["tokenize"] = True
        body["cardPaymentMethodSpecificInput"]["authorizationMode"] = "SALE"

    # Attach custom fields as merchant reference
    if custom_fields:
        body["order"]["references"]["merchantReference"] = "|".join(
            f"{k}={v}" for k, v in custom_fields.items()
        )

    content_type = "application/json"
    headers = {
        **_auth_header("POST", url_path, content_type),
        "Content-Type": content_type,
    }

    async with httpx.AsyncClient(timeout=30) as client:
        resp = await client.post(full_url, json=body, headers=headers)
        resp.raise_for_status()
        data = resp.json()

    partial_url = data.get("partialRedirectUrl", "")
    checkout_url = f"https://payment.{partial_url}" if partial_url else ""

    return {
        "checkout_url": checkout_url,
        "hosted_checkout_id": data.get("hostedCheckoutId", ""),
        "return_mac": data.get("RETURNMAC", ""),
    }


# ---------------------------------------------------------------------------
# Payment status
# ---------------------------------------------------------------------------

async def get_payment_status(payment_id: str) -> dict:
    """Get payment status from Worldline."""
    settings = get_settings()
    merchant_id = settings.worldline_merchant_id
    api_endpoint = settings.worldline_api_endpoint
    url_path = f"/v2/{merchant_id}/payments/{payment_id}"
    full_url = f"{api_endpoint}{url_path}"

    headers = _auth_header("GET", url_path)

    async with httpx.AsyncClient(timeout=30) as client:
        resp = await client.get(full_url, headers=headers)
        resp.raise_for_status()
        return resp.json()


async def get_hosted_checkout_status(hosted_checkout_id: str) -> dict:
    """Get hosted checkout status from Worldline."""
    settings = get_settings()
    merchant_id = settings.worldline_merchant_id
    api_endpoint = settings.worldline_api_endpoint
    url_path = f"/v2/{merchant_id}/hostedcheckouts/{hosted_checkout_id}"
    full_url = f"{api_endpoint}{url_path}"

    headers = _auth_header("GET", url_path)

    async with httpx.AsyncClient(timeout=30) as client:
        resp = await client.get(full_url, headers=headers)
        resp.raise_for_status()
        return resp.json()


# ---------------------------------------------------------------------------
# Webhook signature verification
# ---------------------------------------------------------------------------

def verify_webhook_signature(body: bytes, key_id: str, signature: str) -> bool:
    """Verify Worldline webhook HMAC-SHA256 signature.

    Args:
        body: Raw request body bytes.
        key_id: Value of X-GCS-KeyId header.
        signature: Value of X-GCS-Signature header (base64).

    Returns:
        True if the signature is valid.
    """
    settings = get_settings()

    # Check that the key ID matches our configured key
    if key_id != settings.worldline_webhook_key_id:
        logger.warning("worldline webhook key_id mismatch: got=%s expected=%s", key_id, settings.worldline_webhook_key_id)
        return False

    secret = settings.worldline_webhook_secret
    if not secret:
        logger.error("worldline webhook secret not configured")
        return False

    # Compute HMAC-SHA256
    secret_bytes = base64.b64decode(secret)
    expected_sig = base64.b64encode(
        hmac.new(secret_bytes, body, hashlib.sha256).digest()
    ).decode("utf-8")

    if not hmac.compare_digest(expected_sig, signature):
        logger.warning("worldline webhook signature mismatch")
        return False

    return True


# ---------------------------------------------------------------------------
# Refund
# ---------------------------------------------------------------------------

async def create_refund(payment_id: str, amount_cents: int, currency: str = "EUR") -> dict:
    """Create a refund for a Worldline payment."""
    settings = get_settings()
    merchant_id = settings.worldline_merchant_id
    api_endpoint = settings.worldline_api_endpoint
    url_path = f"/v2/{merchant_id}/payments/{payment_id}/refund"
    full_url = f"{api_endpoint}{url_path}"

    body = {
        "amountOfMoney": {
            "amount": amount_cents,
            "currencyCode": currency.upper(),
        },
    }

    content_type = "application/json"
    headers = {
        **_auth_header("POST", url_path, content_type),
        "Content-Type": content_type,
    }

    async with httpx.AsyncClient(timeout=30) as client:
        resp = await client.post(full_url, json=body, headers=headers)
        resp.raise_for_status()
        return resp.json()
