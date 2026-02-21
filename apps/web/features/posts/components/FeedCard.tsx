"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { CreatorHeader, LockedOverlay } from "@/components/premium";
import { Card, CardContent } from "@/components/ui/card";
import { useToast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";
import { createComment, getLikeSummary, likePost, listComments, unlikePost } from "@/features/engagement/api";
import type { PostItem } from "@/types/creator";
import type { PostOut, PostWithCreator } from "../api";
import { PostMediaImage } from "./PostMediaImage";
import { PostMediaVideo } from "./PostMediaVideo";
import { RichCaption } from "./RichCaption";
import { Icon } from "@/components/ui/icon";
import { useTranslation } from "@/lib/i18n";

type FeedCardProps = {
  post: PostOut | PostWithCreator | PostItem;
  /** When true, show lock overlay (subscriber-only content) */
  locked?: boolean;
  /** Creator for header; from post.creator when feed item */
  creator?: { handle: string; display_name: string; user_id?: string; avatar_asset_id?: string | null; verified?: boolean };
  onUnlockClick?: () => void;
  className?: string;
};

export function FeedCard({
  post,
  locked = false,
  creator,
  onUnlockClick,
  className,
}: FeedCardProps) {
  const { addToast } = useToast();
  const { t } = useTranslation();
  const isWithCreator = "creator" in post && post.creator;
  const creatorInfo = creator ?? (isWithCreator ? (post as PostWithCreator).creator : null);
  const [likeCount, setLikeCount] = useState(0);
  const [viewerLiked, setViewerLiked] = useState(false);
  const [commentCount, setCommentCount] = useState(0);
  const [commentsOpen, setCommentsOpen] = useState(false);
  const [commentInput, setCommentInput] = useState("");
  const [comments, setComments] = useState<Array<{ id: string; body: string; created_at: string }>>([]);

  const onShare = async () => {
    const handle = creatorInfo?.handle;
    const url = handle
      ? `${window.location.origin}/creators/${handle}`
      : window.location.href;
    if (navigator.share) {
      try {
        await navigator.share({ url, title: creatorInfo?.display_name ?? "Zinovia" });
      } catch {
        /* user cancelled */
      }
    } else {
      await navigator.clipboard.writeText(url);
      addToast(t.feed.toastLinkCopied, "success");
    }
  };

  useEffect(() => {
    getLikeSummary(post.id)
      .then((res) => {
        setLikeCount(res.count);
        setViewerLiked(res.viewer_liked);
      })
      .catch(() => {});
    listComments(post.id)
      .then((res) => {
        setCommentCount(res.total);
        setComments(res.items);
      })
      .catch(() => {});
  }, [post.id]);

  const onToggleLike = async () => {
    const nextLiked = !viewerLiked;
    setViewerLiked(nextLiked);
    setLikeCount((prev) => Math.max(0, prev + (nextLiked ? 1 : -1)));
    try {
      if (nextLiked) {
        await likePost(post.id);
      } else {
        await unlikePost(post.id);
      }
    } catch {
      setViewerLiked(!nextLiked);
      setLikeCount((prev) => Math.max(0, prev + (nextLiked ? -1 : 1)));
      addToast(t.feed.toastUnableToLike, "error");
    }
  };

  const onSubmitComment = async () => {
    if (!commentInput.trim()) return;
    try {
      const created = await createComment(post.id, commentInput);
      setComments((prev) => [created, ...prev].slice(0, 5));
      setCommentCount((prev) => prev + 1);
      setCommentInput("");
    } catch {
      addToast(t.feed.toastUnableToComment, "error");
    }
  };

  return (
    <Card
      variant="elevated"
      className={cn(
        "overflow-hidden rounded-premium-lg transition-shadow hover:shadow-strong",
        className
      )}
    >
      {creatorInfo && (
        <div className="border-b border-border px-4 py-3">
          <CreatorHeader
            displayName={creatorInfo.display_name}
            handle={creatorInfo.handle}
            href={`/creators/${creatorInfo.handle}`}
            avatarAssetId={creatorInfo.avatar_asset_id ?? undefined}
            size="sm"
            badge={(creatorInfo as any)?.verified ? "verified" : undefined}
          />
        </div>
      )}
      <CardContent className="p-0">
        <LockedOverlay
          locked={locked}
          label={t.feed.subscribeToUnlock}
          onUnlockClick={onUnlockClick}
          className="min-h-[120px]"
        >
          {/* Media-first: lead with image/video when present */}
          {(post.type === "IMAGE" && post.asset_ids?.length) || post.type === "VIDEO" ? (
            <div className="aspect-video w-full bg-muted">
              {post.type === "IMAGE" && post.asset_ids?.length ? (
                <div className="flex h-full w-full gap-px">
                  {post.asset_ids.slice(0, 3).map((assetId) => {
                    const preview = (post as any).media_previews?.[assetId];
                    return (
                      <PostMediaImage
                        key={assetId}
                        assetId={assetId}
                        variant={locked ? "thumb" : "grid"}
                        className="min-w-0 flex-1 object-cover"
                        initialBlurhash={preview?.blurhash}
                        initialDominantColor={preview?.dominant_color}
                      />
                    );
                  })}
                </div>
              ) : post.type === "VIDEO" && post.asset_ids?.length ? (
                <PostMediaVideo
                  assetId={post.asset_ids[0]}
                  className="h-full w-full object-contain rounded-b-none"
                />
              ) : null}
            </div>
          ) : null}
          <div className="px-4 py-3">
            {post.caption && (
              <RichCaption text={post.caption} className="line-clamp-3" />
            )}
            <p className="mt-2 text-premium-small text-muted-foreground">
              {post.visibility} · {new Date(post.created_at).toLocaleDateString()}
            </p>
            {/* Card actions — like, comment, share */}
            <div
              className="mt-3 flex items-center gap-4 text-premium-small"
              role="group"
              aria-label={t.feed.postActionsAriaLabel}
            >
              <button
                type="button"
                onClick={onToggleLike}
                className="inline-flex items-center gap-1 font-medium text-brand hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-ring focus-visible:ring-offset-2 rounded cursor-pointer"
                aria-label={t.feed.likeAriaLabel}
              >
                <Icon name="favorite" filled={viewerLiked} className="icon-base" />
                {viewerLiked ? t.feed.liked : t.feed.like} ({likeCount})
              </button>
              <span className="text-muted-foreground" aria-hidden>·</span>
              <button
                type="button"
                onClick={() => setCommentsOpen((v) => !v)}
                className="inline-flex items-center gap-1 text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-ring focus-visible:ring-offset-2 rounded cursor-pointer"
                aria-label={t.feed.commentAriaLabel}
              >
                <Icon name="chat_bubble" className="icon-base" />
                {t.feed.commentLabel} ({commentCount})
              </button>
              <span className="text-muted-foreground" aria-hidden>·</span>
              <button
                type="button"
                onClick={onShare}
                className="inline-flex items-center gap-1 text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-ring focus-visible:ring-offset-2 rounded cursor-pointer"
                aria-label={t.feed.shareAriaLabel}
              >
                <Icon name="share" className="icon-base" />
                {t.feed.shareLabel}
              </button>
            </div>
            {commentsOpen && (
              <div className="mt-3 rounded-md border border-border p-2">
                <div className="flex gap-2">
                  <input
                    value={commentInput}
                    onChange={(e) => setCommentInput(e.target.value)}
                    placeholder={t.feed.commentPlaceholder}
                    className="h-9 flex-1 rounded border border-input bg-background px-2 text-sm"
                  />
                  <button
                    type="button"
                    onClick={onSubmitComment}
                    className="inline-flex items-center gap-1 rounded bg-primary px-3 text-xs text-primary-foreground"
                  >
                    <Icon name="send" className="icon-sm" />
                    {t.feed.sendButton}
                  </button>
                </div>
                {comments.length > 0 && (
                  <ul className="mt-2 space-y-1 text-xs text-muted-foreground">
                    {comments.map((comment) => (
                      <li key={comment.id} className="rounded bg-muted/40 px-2 py-1">
                        {comment.body}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </div>
        </LockedOverlay>
      </CardContent>
    </Card>
  );
}
