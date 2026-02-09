from __future__ import annotations

import asyncio

from app.db.metadata import Base
from app.db.session import engine


async def reset_db() -> None:
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
        await conn.run_sync(Base.metadata.create_all)


def main() -> None:
    asyncio.run(reset_db())


if __name__ == "__main__":
    main()
