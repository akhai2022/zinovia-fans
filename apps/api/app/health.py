from __future__ import annotations

from sqlalchemy import text
from redis.asyncio import Redis

from app.core.settings import get_settings
from app.db.session import engine


async def check_db() -> bool:
    try:
        async with engine.connect() as conn:
            await conn.execute(text("SELECT 1"))
        return True
    except Exception:
        return False


async def check_redis() -> bool:
    settings = get_settings()
    if not (settings.redis_url or "").strip():
        # Redis is optional in no-worker deployments.
        return True
    client = Redis.from_url(str(settings.redis_url))
    try:
        result = await client.ping()
        return bool(result)
    except Exception:
        return False
    finally:
        await client.aclose()  # type: ignore[attr-defined]
