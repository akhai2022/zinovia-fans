from __future__ import annotations

import asyncio
import os

from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import async_session_factory
from app.modules.auth.constants import ADMIN_ROLE
from app.modules.auth.models import User
from app.modules.auth.security import hash_password


async def seed_admin(session: AsyncSession, email: str, password: str) -> None:
    user = User(email=email, password_hash=hash_password(password), role=ADMIN_ROLE)
    session.add(user)
    await session.commit()


async def seed() -> None:
    email = os.getenv("SEED_ADMIN_EMAIL")
    password = os.getenv("SEED_ADMIN_PASSWORD")
    if not email or not password:
        raise RuntimeError("SEED_ADMIN_EMAIL and SEED_ADMIN_PASSWORD must be set.")
    async with async_session_factory() as session:
        await seed_admin(session, email, password)


def main() -> None:
    asyncio.run(seed())


if __name__ == "__main__":
    main()
