"""Shared pagination normalization. Use for list endpoints to keep behavior consistent."""

from __future__ import annotations


def normalize_pagination(
    page: int | None,
    page_size: int | None,
    *,
    default_size: int,
    max_size: int,
    invalid_page_size_use_default: bool = True,
) -> tuple[int, int, int, int]:
    """
    Normalize page and page_size into (page, page_size, offset, limit).

    Rules:
    - page: 1 if None or < 1.
    - page_size: if invalid_page_size_use_default (creators-style), any invalid
      (None, < 1, or > max_size) is replaced with default_size; otherwise
      (posts-style) default only when None, then clamp to [1, max_size].
    - offset = (page - 1) * page_size, limit = page_size.

    Returns:
        (page, page_size, offset, limit)
    """
    if page is None or page < 1:
        page = 1

    if invalid_page_size_use_default:
        if page_size is None or page_size < 1 or page_size > max_size:
            page_size = default_size
    else:
        page_size = default_size if page_size is None else page_size
        page_size = min(max(1, page_size), max_size)

    offset = (page - 1) * page_size
    limit = page_size
    return (page, page_size, offset, limit)
