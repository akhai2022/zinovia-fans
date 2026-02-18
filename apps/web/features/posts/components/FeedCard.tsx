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
  const isWithCreator = "creator" in post && post.creator;
  const creatorInfo = creator ?? (isWithCreator ? (post as PostWithCreator).creator : null);
  const [likeCount, setLikeCount] = useState(0);
  const [viewerLiked, setViewerLiked] = useState(false);
  const [commentCount, setCommentCount] = useState(0);
  const [commentsOpen, setCommentsOpen] = useState(false);
  const [commentInput, setCommentInput] = useState("");
  const [comments, setComments] = useState<Array<{ id: string; body: string; created_at: string }>>([]);

  const onActionComingSoon = () => {
    addToast("Coming soon", "default");
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
      addToast("Unable to update like", "error");
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
      addToast("Unable to send comment", "error");
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
          label="Subscribe to unlock"
          onUnlockClick={onUnlockClick}
          className="min-h-[120px]"
        >
          {/* Media-first: lead with image/video when present */}
          {(post.type === "IMAGE" && post.asset_ids?.length) || post.type === "VIDEO" ? (
            <div className="aspect-video w-full bg-muted">
              {post.type === "IMAGE" && post.asset_ids?.length ? (
                <div className="flex h-full w-full gap-px">
                  {post.asset_ids.slice(0, 3).map((assetId) => (
                    <PostMediaImage
                      key={assetId}
                      assetId={assetId}
                      variant={locked ? "thumb" : undefined}
                      className="min-w-0 flex-1 object-cover"
                    />
                  ))}
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
            {/* Card actions — like, comment, share (coming soon) */}
            <div
              className="mt-3 flex items-center gap-4 text-premium-small"
              role="group"
              aria-label="Post actions"
            >
              <button
                type="button"
                onClick={onToggleLike}
                className="font-medium text-brand hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-ring focus-visible:ring-offset-2 rounded cursor-pointer"
                aria-label="Like"
              >
                {viewerLiked ? "Liked" : "Like"} ({likeCount})
              </button>
              <span className="text-muted-foreground" aria-hidden>·</span>
              <button
                type="button"
                onClick={() => setCommentsOpen((v) => !v)}
                className="text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-ring focus-visible:ring-offset-2 rounded cursor-pointer"
                aria-label="Comment"
              >
                Comment ({commentCount})
              </button>
              <span className="text-muted-foreground" aria-hidden>·</span>
              <button
                type="button"
                onClick={onActionComingSoon}
                className="text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-ring focus-visible:ring-offset-2 rounded cursor-pointer"
                aria-label="Share"
              >
                Share
              </button>
            </div>
            {commentsOpen && (
              <div className="mt-3 rounded-md border border-border p-2">
                <div className="flex gap-2">
                  <input
                    value={commentInput}
                    onChange={(e) => setCommentInput(e.target.value)}
                    placeholder="Write a comment..."
                    className="h-9 flex-1 rounded border border-input bg-background px-2 text-sm"
                  />
                  <button
                    type="button"
                    onClick={onSubmitComment}
                    className="rounded bg-primary px-3 text-xs text-primary-foreground"
                  >
                    Send
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
