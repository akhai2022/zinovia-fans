from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.errors import AppError
from app.core.settings import get_settings
from app.db.session import get_async_session
from app.modules.auth.deps import get_current_user
from app.modules.auth.models import User
from app.modules.creators.deps import require_creator_with_profile
from app.modules.posts.constants import DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE
from app.modules.posts.schemas import (
    CreatorSummary,
    FeedPage,
    PostCommentCreate,
    PostCommentOut,
    PostCommentPageOut,
    PostCreate,
    PostLikeSummary,
    PostOut,
    PostSearchPage,
    PostSearchResult,
    PostUpdate,
    PostWithCreator,
)
from app.modules.posts.service import (
    _post_to_out,
    create_comment,
    create_post,
    delete_comment,
    delete_post,
    get_feed_page,
    get_post_like_summary,
    like_post,
    list_comments_page,
    publish_post_now,
    search_posts,
    unlike_post,
    update_post,
)

router = APIRouter()


feed_router = APIRouter()


def _ensure_likes_enabled() -> None:
    if not get_settings().enable_likes:
        raise AppError(status_code=404, detail="feature_disabled")


def _ensure_comments_enabled() -> None:
    if not get_settings().enable_comments:
        raise AppError(status_code=404, detail="feature_disabled")


@feed_router.get("/feed", response_model=FeedPage, operation_id="feed_list")
async def feed(
    session: AsyncSession = Depends(get_async_session),
    current_user: User = Depends(get_current_user),
    page: int = Query(1, ge=1),
    page_size: int = Query(DEFAULT_PAGE_SIZE, ge=1, le=MAX_PAGE_SIZE),
    cursor: str | None = Query(None, description="Opaque cursor for infinite scroll pagination."),
) -> FeedPage:
    from app.modules.posts.service import _post_to_out_locked

    items_tuples, total, next_cursor = await get_feed_page(
        session, current_user.id, page=page, page_size=page_size, cursor=cursor
    )
    items = []
    for post, user, profile, is_locked, locked_reason in items_tuples:
        data = _post_to_out_locked(post, locked_reason) if is_locked else _post_to_out(post)
        items.append(
            PostWithCreator(
                **data,
                creator=CreatorSummary(
                    user_id=user.id,
                    handle=profile.handle or "",
                    display_name=profile.display_name,
                    avatar_asset_id=profile.avatar_asset_id,
                    verified=profile.verified,
                ),
            )
        )
    return FeedPage(items=items, total=total, page=page, page_size=page_size, next_cursor=next_cursor)


@router.get("/search", response_model=PostSearchPage, operation_id="posts_search")
async def search(
    q: str = Query(..., min_length=1, max_length=200, description="Search query"),
    page: int = Query(1, ge=1),
    page_size: int = Query(DEFAULT_PAGE_SIZE, ge=1, le=MAX_PAGE_SIZE),
    session: AsyncSession = Depends(get_async_session),
) -> PostSearchPage:
    """Search public posts by caption (trigram GIN index)."""
    items_tuples, total = await search_posts(session, q, page=page, page_size=page_size)
    items = [
        PostSearchResult(
            id=post.id,
            creator_user_id=post.creator_user_id,
            type=post.type,
            caption=post.caption,
            visibility=post.visibility,
            nsfw=post.nsfw,
            created_at=post.created_at,
            updated_at=post.updated_at,
            asset_ids=[pm.media_asset_id for pm in sorted(post.media, key=lambda m: m.position)],
            creator=CreatorSummary(
                user_id=user.id,
                handle=profile.handle or "",
                display_name=profile.display_name,
                avatar_asset_id=profile.avatar_asset_id,
                verified=profile.verified,
            ),
        )
        for post, user, profile in items_tuples
    ]
    return PostSearchPage(items=items, total=total, page=page, page_size=page_size)


@router.post("", response_model=PostOut, status_code=201, operation_id="posts_create")
async def create(
    payload: PostCreate,
    session: AsyncSession = Depends(get_async_session),
    current_user: User = Depends(require_creator_with_profile),
) -> PostOut:
    post = await create_post(
        session,
        current_user.id,
        type_=payload.type,
        caption=payload.caption,
        visibility=payload.visibility,
        nsfw=payload.nsfw,
        asset_ids=payload.asset_ids or [],
        publish_at=payload.publish_at,
        price_cents=payload.price_cents,
        currency=payload.currency,
    )
    data = _post_to_out(post)
    return PostOut(**data)


@router.patch("/{post_id}", response_model=PostOut, operation_id="posts_update")
async def update(
    post_id: UUID,
    payload: PostUpdate,
    session: AsyncSession = Depends(get_async_session),
    current_user: User = Depends(require_creator_with_profile),
) -> PostOut:
    post = await update_post(
        session,
        post_id,
        current_user.id,
        caption=payload.caption,
        visibility=payload.visibility,
    )
    return PostOut(**_post_to_out(post))


@router.delete("/{post_id}", status_code=204, operation_id="posts_delete")
async def delete(
    post_id: UUID,
    session: AsyncSession = Depends(get_async_session),
    current_user: User = Depends(require_creator_with_profile),
) -> None:
    await delete_post(session, post_id, current_user.id)


@router.post("/{post_id}/like", operation_id="posts_like")
async def like(
    post_id: UUID,
    session: AsyncSession = Depends(get_async_session),
    current_user: User = Depends(get_current_user),
) -> dict[str, str]:
    _ensure_likes_enabled()
    await like_post(session, post_id, current_user.id)
    return {"status": "ok"}


@router.delete("/{post_id}/like", operation_id="posts_unlike")
async def unlike(
    post_id: UUID,
    session: AsyncSession = Depends(get_async_session),
    current_user: User = Depends(get_current_user),
) -> dict[str, str]:
    _ensure_likes_enabled()
    await unlike_post(session, post_id, current_user.id)
    return {"status": "ok"}


@router.get("/{post_id}/likes", response_model=PostLikeSummary, operation_id="posts_like_summary")
async def likes(
    post_id: UUID,
    session: AsyncSession = Depends(get_async_session),
    current_user: User = Depends(get_current_user),
) -> PostLikeSummary:
    _ensure_likes_enabled()
    count, viewer_liked = await get_post_like_summary(session, post_id, current_user.id)
    return PostLikeSummary(post_id=post_id, count=count, viewer_liked=viewer_liked)


@router.post("/{post_id}/comments", response_model=PostCommentOut, operation_id="posts_comment_create")
async def comment_create(
    post_id: UUID,
    payload: PostCommentCreate,
    session: AsyncSession = Depends(get_async_session),
    current_user: User = Depends(get_current_user),
) -> PostCommentOut:
    _ensure_comments_enabled()
    comment = await create_comment(session, post_id, current_user.id, payload.body)
    return PostCommentOut(
        id=comment.id,
        post_id=comment.post_id,
        user_id=comment.user_id,
        body=comment.body,
        created_at=comment.created_at,
    )
@router.get("/{post_id}/comments", response_model=PostCommentPageOut, operation_id="posts_comment_list")
async def comment_list(
    post_id: UUID,
    cursor: str | None = Query(None),
    page_size: int = Query(30, ge=1, le=100),
    session: AsyncSession = Depends(get_async_session),
    _current_user: User = Depends(get_current_user),
) -> PostCommentPageOut:
    _ensure_comments_enabled()
    rows, next_cursor, total = await list_comments_page(
        session, post_id, cursor=cursor, page_size=page_size
    )
    return PostCommentPageOut(
        items=[
            PostCommentOut(
                id=r.id,
                post_id=r.post_id,
                user_id=r.user_id,
                body=r.body,
                created_at=r.created_at,
            )
            for r in rows
        ],
        next_cursor=next_cursor,
        total=total,
    )


@router.delete("/comments/{comment_id}", operation_id="posts_comment_delete")
async def comment_delete(
    comment_id: UUID,
    session: AsyncSession = Depends(get_async_session),
    current_user: User = Depends(get_current_user),
) -> dict[str, str]:
    _ensure_comments_enabled()
    await delete_comment(session, comment_id, current_user.id)
    return {"status": "ok"}
@router.post("/{post_id}/publish-now", response_model=PostOut, operation_id="posts_publish_now")
async def publish_now(
    post_id: UUID,
    session: AsyncSession = Depends(get_async_session),
    current_user: User = Depends(require_creator_with_profile),
) -> PostOut:
    if not get_settings().enable_scheduled_posts:
        raise AppError(status_code=404, detail="feature_disabled")
    post = await publish_post_now(session, post_id, current_user.id)
    return PostOut(**_post_to_out(post))