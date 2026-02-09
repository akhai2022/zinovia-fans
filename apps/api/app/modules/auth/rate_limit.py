from __future__ import annotations

from redis.asyncio import Redis

from app.core.settings import get_settings


async def check_rate_limit(key: str) -> bool:
    settings = get_settings()
    client = Redis.from_url(str(settings.redis_url))
    try:
        current = await client.incr(key)
        if current == 1:
            await client.expire(key, settings.rate_limit_window_seconds)
        return current <= settings.rate_limit_max
    finally:
        await client.aclose()
