"use client";

import Image from "next/image";
import { PostMediaImage } from "@/features/posts/components/PostMediaImage";
import { PostMediaVideo } from "@/features/posts/components/PostMediaVideo";
import { LockedOverlay } from "./LockedOverlay";
import { DEMO_ASSETS } from "@/lib/demoAssets";
import { cn } from "@/lib/utils";
import type { PostItem } from "@/types/creator";

interface MediaGridProps {
  posts: PostItem[];
  /** Current user is subscriber to this creator (all cells unlocked) */
  isSubscriber?: boolean;
  /** Optional: override locked state per post (e.g. (p) => p.visibility === "SUBSCRIBERS") */
  isLocked?: (post: PostItem) => boolean;
  /** Creator handle for unlock CTA */
  creatorHandle?: string;
  onUnlockClick?: () => void;
  className?: string;
  /** Columns: 2 (mobile), 3 or 4 (desktop) */
  columns?: 2 | 3 | 4;
  /** Show "Validated by Zinovia Fans" watermark on image cells (e.g. profile grid only) */
  showWatermark?: boolean;
}

function PostCell({
  post,
  locked,
  onUnlockClick,
  showWatermark,
}: {
  post: PostItem;
  locked: boolean;
  onUnlockClick?: () => void;
  showWatermark?: boolean;
}) {
  const hasImageAsset = post.type === "IMAGE" && post.asset_ids?.length;
  const hasVideoAsset = post.type === "VIDEO" && post.asset_ids?.length;
  const isVideo = post.type === "VIDEO";
  const imagePlaceholder = (
    <div className="h-full w-full bg-muted" aria-hidden />
  );
  const lockedPlaceholderImage = (
    <Image
      src={DEMO_ASSETS.locked}
      alt=""
      fill
      className="object-cover"
      sizes="(max-width: 640px) 50vw, 25vw"
    />
  );
  const overlayLabel =
    post.locked_reason === "FOLLOW_REQUIRED" ? "Follow to unlock" : "Subscribe to unlock";

  const imageCell = hasImageAsset ? (
    <div className={cn("h-full w-full bg-muted", locked && "blur-[2px] opacity-90")}>
      <PostMediaImage
        assetId={post.asset_ids![0]}
        className="h-full w-full object-cover"
        watermark={showWatermark && !locked}
      />
    </div>
  ) : post.type === "IMAGE" ? (
    <div className="h-full w-full bg-gradient-to-br from-accent-50 to-secondary/40" aria-hidden />
  ) : null;

  return (
    <LockedOverlay
      locked={locked}
      label={overlayLabel}
      onUnlockClick={onUnlockClick}
      className="aspect-square rounded-premium-md overflow-hidden bg-muted"
    >
      {locked && !hasImageAsset && post.type !== "IMAGE" ? (
        <div className="relative h-full w-full">{lockedPlaceholderImage}</div>
      ) : imageCell ? (
        imageCell
      ) : hasVideoAsset ? (
        <div className="h-full w-full bg-muted">
          <PostMediaVideo
            assetId={post.asset_ids![0]}
            className="h-full w-full object-cover"
          />
        </div>
      ) : isVideo ? (
        imagePlaceholder
      ) : (
        <div className="flex h-full w-full items-center p-3">
          <p className="line-clamp-4 text-premium-small text-muted-foreground">
            {post.caption || "Text post"}
          </p>
        </div>
      )}
    </LockedOverlay>
  );
}

export function MediaGrid({
  posts,
  isSubscriber = false,
  isLocked: isLockedProp,
  creatorHandle,
  onUnlockClick,
  className,
  columns = 2,
  showWatermark = false,
}: MediaGridProps) {
  if (posts.length === 0) {
    return (
      <div
        className={cn(
          "flex flex-col items-center justify-center rounded-premium-lg border border-border bg-muted/30 py-12 text-center",
          className
        )}
        role="status"
        aria-label="No posts yet"
      >
        <p className="text-premium-body-sm text-muted-foreground">
          No posts yet.
        </p>
        {creatorHandle && (
          <p className="mt-1 text-premium-small text-muted-foreground">
            Subscribe to be first to see new content.
          </p>
        )}
      </div>
    );
  }

  return (
    <ul
      className={cn(
        "grid gap-2 sm:gap-3",
        columns === 2 && "grid-cols-2",
        columns === 3 && "grid-cols-2 sm:grid-cols-3",
        columns === 4 && "grid-cols-2 sm:grid-cols-3 md:grid-cols-4",
        className
      )}
      aria-label="Creator posts grid"
    >
      {posts.map((post) => {
        const locked =
          isLockedProp?.(post) ?? post.is_locked ?? (!isSubscriber && post.visibility === "SUBSCRIBERS");
        return (
          <li key={post.id}>
            <PostCell
              post={post}
              locked={locked}
              onUnlockClick={onUnlockClick}
              showWatermark={showWatermark}
            />
          </li>
        );
      })}
    </ul>
  );
}
