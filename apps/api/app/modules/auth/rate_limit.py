from __future__ import annotations

from datetime import datetime, timedelta, timezone
from collections import defaultdict, deque
from typing import Deque

from app.core.settings import get_settings

_LOCAL_WINDOWS: dict[str, Deque[datetime]] = defaultdict(deque)


def _check_local_window(key: str, max_count: int, window_seconds: int) -> bool:
    now = datetime.now(timezone.utc)
    window_start = now - timedelta(seconds=window_seconds)
    q = _LOCAL_WINDOWS[key]
    while q and q[0] < window_start:
        q.popleft()
    q.append(now)
    return len(q) <= max_count


async def check_rate_limit(key: str) -> bool:
    settings = get_settings()
    if not (settings.redis_url or "").strip():
        return _check_local_window(key, settings.rate_limit_max, settings.rate_limit_window_seconds)
    from redis.asyncio import Redis
    client = Redis.from_url(str(settings.redis_url))
    try:
        current = await client.incr(key)
        if current == 1:
            await client.expire(key, settings.rate_limit_window_seconds)
        return current <= settings.rate_limit_max
    except Exception:
        return _check_local_window(key, settings.rate_limit_max, settings.rate_limit_window_seconds)
    finally:
        await client.aclose()  # type: ignore[attr-defined]


async def check_rate_limit_custom(
    key: str, max_count: int, window_seconds: int = 60
) -> bool:
    """Return True if under limit. Raise AppError if over limit."""
    from app.core.errors import AppError

    settings = get_settings()
    if not (settings.redis_url or "").strip():
        if not _check_local_window(key, max_count, window_seconds):
            raise AppError(status_code=429, detail="rate_limit_exceeded")
        return True
    from redis.asyncio import Redis
    client = Redis.from_url(str(settings.redis_url))
    try:
        current = await client.incr(key)
        if current == 1:
            await client.expire(key, window_seconds)
        if current > max_count:
            raise AppError(status_code=429, detail="rate_limit_exceeded")
        return True
    except Exception:
        if not _check_local_window(key, max_count, window_seconds):
            raise AppError(status_code=429, detail="rate_limit_exceeded")
        return True
    finally:
        await client.aclose()  # type: ignore[attr-defined]
