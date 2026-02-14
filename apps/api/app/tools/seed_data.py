"""Seed admin user for local dev and initial production setup.

Usage:
    SEED_ADMIN_EMAIL=admin@zinovia.ai SEED_ADMIN_PASSWORD=<strong-password> \
    python -m app.tools.seed_data

Safe to run multiple times -- skips if admin already exists.
"""
from __future__ import annotations

import asyncio
import logging
import os

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import async_session_factory
from app.modules.auth.constants import ADMIN_ROLE
from app.modules.auth.models import Profile, User
from app.modules.auth.security import hash_password

logger = logging.getLogger(__name__)


async def seed_admin(session: AsyncSession, email: str, password: str) -> None:
    """Create admin user if not already present. Idempotent."""
    result = await session.execute(select(User).where(User.email == email))
    existing = result.scalar_one_or_none()
    if existing:
        if existing.role != ADMIN_ROLE:
            existing.role = ADMIN_ROLE
            await session.commit()
            logger.info("Upgraded existing user %s to admin role.", email)
        else:
            logger.info("Admin user %s already exists. Skipping.", email)
        return

    user = User(
        email=email,
        password_hash=hash_password(password),
        role=ADMIN_ROLE,
        is_active=True,
    )
    profile = Profile(user=user, display_name="Admin")
    session.add_all([user, profile])
    await session.commit()
    logger.info("Created admin user: %s", email)


async def seed() -> None:
    email = os.getenv("SEED_ADMIN_EMAIL")
    password = os.getenv("SEED_ADMIN_PASSWORD")
    if not email or not password:
        raise RuntimeError("SEED_ADMIN_EMAIL and SEED_ADMIN_PASSWORD must be set.")
    async with async_session_factory() as session:
        await seed_admin(session, email, password)


def main() -> None:
    logging.basicConfig(level=logging.INFO)
    asyncio.run(seed())


if __name__ == "__main__":
    main()
