"""CCBill FlexForms client: URL generation, webhook verification, subscription management."""

from __future__ import annotations

import hashlib
import logging
from decimal import Decimal
from urllib.parse import urlencode

import httpx

from app.core.settings import get_settings

logger = logging.getLogger(__name__)

# CCBill numeric currency codes (ISO 4217)
CURRENCY_CODES = {
    "usd": "840",
    "eur": "978",
    "gbp": "826",
    "aud": "036",
    "cad": "124",
    "jpy": "392",
}

FLEXFORMS_BASE_URL = "https://api.ccbill.com/wap-frontflex/flexforms"
DATALINK_BASE_URL = "https://datalink.ccbill.com/utils/subscriptionManagement.cgi"


def ccbill_configured() -> bool:
    """True if CCBill credentials are set."""
    settings = get_settings()
    return bool(
        settings.ccbill_account_number
        and settings.ccbill_sub_account
        and settings.ccbill_flex_form_id
        and settings.ccbill_salt
    )


def _format_price(amount: Decimal) -> str:
    """Format price as string with exactly 2 decimal places (e.g. '4.99')."""
    return f"{amount:.2f}"


def _compute_form_digest(
    initial_price: str,
    initial_period: str,
    currency_code: str,
    salt: str,
    *,
    recurring_price: str | None = None,
    recurring_period: str | None = None,
    num_rebills: str | None = None,
) -> str:
    """Compute CCBill formDigest: MD5 hex of concatenated fields + salt.

    For recurring: MD5(initialPrice + initialPeriod + recurringPrice + recurringPeriod + numRebills + currencyCode + salt)
    For one-time:  MD5(initialPrice + initialPeriod + currencyCode + salt)
    """
    if recurring_price and recurring_period and num_rebills:
        raw = f"{initial_price}{initial_period}{recurring_price}{recurring_period}{num_rebills}{currency_code}{salt}"
    else:
        raw = f"{initial_price}{initial_period}{currency_code}{salt}"
    return hashlib.md5(raw.encode()).hexdigest()


def build_flexform_url(
    *,
    price: Decimal,
    currency: str = "eur",
    initial_period_days: int = 30,
    recurring: bool = True,
    recurring_period_days: int = 30,
    num_rebills: int = 99,
    success_url: str | None = None,
    failure_url: str | None = None,
    custom_fields: dict[str, str] | None = None,
) -> str:
    """Build a CCBill FlexForms dynamic pricing URL.

    Args:
        price: Amount in major currency units (e.g. 4.99).
        currency: 3-letter code (eur, usd, etc.).
        initial_period_days: First billing period in days (2-365).
        recurring: If True, create recurring subscription.
        recurring_period_days: Rebill period (30, 60, or 90).
        num_rebills: Max number of rebills (99 = infinite).
        success_url: Redirect after successful payment.
        failure_url: Redirect after failed payment.
        custom_fields: Extra key-value pairs passed through (e.g. fan_user_id, creator_user_id).

    Returns:
        Full FlexForms URL for redirect.
    """
    settings = get_settings()
    currency_code = CURRENCY_CODES.get(currency.lower(), "978")
    price_str = _format_price(price)

    if recurring:
        recurring_price_str = price_str
        recurring_period_str = str(recurring_period_days)
        num_rebills_str = str(num_rebills)
        digest = _compute_form_digest(
            price_str,
            str(initial_period_days),
            currency_code,
            settings.ccbill_salt,
            recurring_price=recurring_price_str,
            recurring_period=recurring_period_str,
            num_rebills=num_rebills_str,
        )
    else:
        recurring_price_str = None
        recurring_period_str = None
        num_rebills_str = None
        digest = _compute_form_digest(
            price_str,
            str(initial_period_days),
            currency_code,
            settings.ccbill_salt,
        )

    params: dict[str, str] = {
        "clientAccnum": settings.ccbill_account_number,
        "clientSubacc": settings.ccbill_sub_account,
        "formPrice": price_str,
        "formPeriod": str(initial_period_days),
        "currencyCode": currency_code,
        "formDigest": digest,
    }
    if recurring and recurring_price_str and recurring_period_str and num_rebills_str:
        params["formRecurringPrice"] = recurring_price_str
        params["formRecurringPeriod"] = recurring_period_str
        params["formRebills"] = num_rebills_str

    if success_url:
        params["referringUrl"] = success_url
    if failure_url:
        params["denyUrl"] = failure_url

    if custom_fields:
        for key, value in custom_fields.items():
            params[key] = value

    flex_form_id = settings.ccbill_flex_form_id
    url = f"{FLEXFORMS_BASE_URL}/{flex_form_id}?{urlencode(params)}"
    return url


def verify_webhook_digest(params: dict[str, str]) -> bool:
    """Verify CCBill webhook authenticity using responseDigest.

    CCBill sends responseDigest = MD5(subscriptionId + 1 + salt) for NewSaleSuccess,
    or similar patterns for other events. Returns True if valid or if no digest present
    (some events don't include it).
    """
    settings = get_settings()
    response_digest = params.get("responseDigest")
    if not response_digest:
        # Not all events include a digest; allow processing
        return True

    subscription_id = params.get("subscriptionId", "")
    # NewSaleSuccess/RenewalSuccess: MD5(subscriptionId + "1" + salt)
    expected = hashlib.md5(
        f"{subscription_id}1{settings.ccbill_salt}".encode()
    ).hexdigest()
    if response_digest == expected:
        return True

    # Cancellation: MD5(subscriptionId + "0" + salt)
    expected_cancel = hashlib.md5(
        f"{subscription_id}0{settings.ccbill_salt}".encode()
    ).hexdigest()
    if response_digest == expected_cancel:
        return True

    logger.warning(
        "ccbill webhook digest mismatch subscription_id=%s", subscription_id
    )
    return False


async def cancel_ccbill_subscription(subscription_id: str) -> bool:
    """Cancel a CCBill subscription via Datalink API.

    Returns True if successfully canceled.
    """
    settings = get_settings()
    if not settings.ccbill_datalink_username or not settings.ccbill_datalink_password:
        logger.error("CCBill Datalink credentials not configured")
        return False

    params = {
        "action": "cancelSubscription",
        "clientAccnum": settings.ccbill_account_number,
        "clientSubacc": settings.ccbill_sub_account,
        "subscriptionId": subscription_id,
        "username": settings.ccbill_datalink_username,
        "password": settings.ccbill_datalink_password,
    }

    try:
        async with httpx.AsyncClient(timeout=30) as client:
            response = await client.get(DATALINK_BASE_URL, params=params)
            body = response.text.strip()
            # CCBill returns "1" for success, "0" for failure
            if body == "1":
                logger.info("ccbill subscription canceled subscription_id=%s", subscription_id)
                return True
            logger.warning(
                "ccbill cancel failed subscription_id=%s response=%s",
                subscription_id,
                body,
            )
            return False
    except Exception:
        logger.exception("ccbill cancel request failed subscription_id=%s", subscription_id)
        return False
