"""Billing constants."""

DEFAULT_PLAN_PRICE = "4.99"
DEFAULT_PLAN_CURRENCY = "usd"
PLATFORM_ACCOUNT_ID = "platform"


def creator_pending_account_id(creator_user_id: str) -> str:
    return f"creator_pending:{creator_user_id}"
