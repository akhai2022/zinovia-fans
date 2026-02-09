"""Print current subscriptions from DB for debugging (Stripe E2E). Run: python -m app.tools.print_subscriptions."""

from __future__ import annotations

import asyncio
from datetime import datetime, timezone

from sqlalchemy import select

from app.db.session import async_session_factory
from app.modules.billing.models import Subscription


async def run() -> None:
    async with async_session_factory() as session:
        result = await session.execute(
            select(Subscription).order_by(Subscription.created_at.desc())
        )
        rows = result.scalars().all()
    if not rows:
        print("No subscriptions in DB.")
        return
    now = datetime.now(timezone.utc)
    print(f"Subscriptions (count={len(rows)}):")
    for sub in rows:
        period_ok = sub.current_period_end is None or sub.current_period_end > now
        active = sub.status == "active" and period_ok
        print(
            f"  fan={sub.fan_user_id} creator={sub.creator_user_id} "
            f"status={sub.status} period_end={sub.current_period_end} "
            f"stripe_sub={sub.stripe_subscription_id or '-'} active_effective={active}"
        )


def main() -> None:
    asyncio.run(run())


if __name__ == "__main__":
    main()
