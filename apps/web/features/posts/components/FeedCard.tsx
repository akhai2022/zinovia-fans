"use client";

import Link from "next/link";
import { CreatorHeader, LockedOverlay } from "@/components/premium";
import { Card, CardContent } from "@/components/ui/card";
import { useToast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";
import type { PostItem } from "@/types/creator";
import type { PostOut, PostWithCreator } from "../api";
import { PostMediaImage } from "./PostMediaImage";
import { PostMediaVideo } from "./PostMediaVideo";

type FeedCardProps = {
  post: PostOut | PostWithCreator | PostItem;
  /** When true, show lock overlay (subscriber-only content) */
  locked?: boolean;
  /** Creator for header; from post.creator when feed item */
  creator?: { handle: string; display_name: string; user_id?: string; avatar_asset_id?: string | null };
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

  const onActionComingSoon = () => {
    addToast("Coming soon", "default");
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
            badge={undefined}
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
              <p className="text-premium-body-sm text-foreground line-clamp-3">
                {post.caption}
              </p>
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
                onClick={onActionComingSoon}
                className="font-medium text-brand hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-ring focus-visible:ring-offset-2 rounded cursor-pointer"
                aria-label="Like"
              >
                Like
              </button>
              <span className="text-muted-foreground" aria-hidden>·</span>
              <button
                type="button"
                onClick={onActionComingSoon}
                className="text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-ring focus-visible:ring-offset-2 rounded cursor-pointer"
                aria-label="Comment"
              >
                Comment
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
          </div>
        </LockedOverlay>
      </CardContent>
    </Card>
  );
}
