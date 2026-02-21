"use client";

import { PostMediaImage } from "@/features/posts/components/PostMediaImage";
import { PostMediaVideo } from "@/features/posts/components/PostMediaVideo";
import { LockedOverlay } from "./LockedOverlay";
import { cn } from "@/lib/utils";
import { useTranslation, interpolate } from "@/lib/i18n";
import type { PostItem } from "@/types/creator";

interface MediaGridProps {
  posts: PostItem[];
  /** Current user is subscriber to this creator (all cells unlocked) */
  isSubscriber?: boolean;
  /** Optional: override locked state per post (e.g. (p) => p.visibility === "SUBSCRIBERS") */
  isLocked?: (post: PostItem) => boolean;
  /** Creator handle for unlock CTA */
  creatorHandle?: string;
  onUnlockClick?: (post?: PostItem) => void;
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
  t,
}: {
  post: PostItem;
  locked: boolean;
  onUnlockClick?: () => void;
  showWatermark?: boolean;
  t: ReturnType<typeof import("@/lib/i18n").useTranslation>["t"];
}) {
  const hasImageAsset = post.type === "IMAGE" && post.asset_ids?.length;
  const hasVideoAsset = post.type === "VIDEO" && post.asset_ids?.length;
  const isVideo = post.type === "VIDEO";
  const imagePlaceholder = (
    <div className="h-full w-full bg-muted" aria-hidden />
  );

  function formatPpvLabel(): string {
    if (!post.price_cents) return t.feed.unlock;
    const amount = (post.price_cents / 100).toFixed(2);
    const cur = (post.currency || "eur").toUpperCase();
    return interpolate(t.feed.unlockForPrice, { price: amount, currency: cur });
  }

  const overlayLabel =
    post.locked_reason === "FOLLOW_REQUIRED"
      ? t.feed.followToUnlock
      : post.locked_reason === "PPV_REQUIRED"
        ? formatPpvLabel()
        : t.feed.subscribeToUnlock;

  const firstAssetId = post.asset_ids?.[0];
  const preview = firstAssetId ? (post as any).media_previews?.[firstAssetId] : undefined;

  const imageCell = hasImageAsset ? (
    <div className="h-full w-full bg-muted">
      <PostMediaImage
        assetId={post.asset_ids![0]}
        variant={locked ? "teaser" : "grid"}
        className="h-full w-full object-cover"
        watermark={showWatermark && !locked}
        initialBlurhash={preview?.blurhash}
        initialDominantColor={preview?.dominant_color}
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
      {imageCell ? (
        imageCell
      ) : hasVideoAsset ? (
        locked ? (
          <div className="h-full w-full bg-muted">
            <PostMediaImage
              assetId={post.asset_ids![0]}
              variant="teaser"
              className="h-full w-full object-cover"
            />
          </div>
        ) : (
          <div className="h-full w-full bg-muted">
            <PostMediaVideo
              assetId={post.asset_ids![0]}
              className="h-full w-full object-cover"
            />
          </div>
        )
      ) : isVideo ? (
        imagePlaceholder
      ) : (
        <div className="flex h-full w-full items-center p-3">
          <p className="line-clamp-4 text-premium-small text-muted-foreground">
            {post.caption || t.feed.textPost}
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
  const { t } = useTranslation();

  if (posts.length === 0) {
    return (
      <div
        className={cn(
          "flex flex-col items-center justify-center rounded-premium-lg border border-border bg-muted/30 py-12 text-center",
          className
        )}
        role="status"
        aria-label={t.feed.noPostsAriaLabel}
      >
        <p className="text-premium-body-sm text-muted-foreground">
          {t.feed.noPostsYet}
        </p>
        {creatorHandle && (
          <p className="mt-1 text-premium-small text-muted-foreground">
            {t.feed.subscribeToSeeContent}
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
      aria-label={t.feed.postsGridAriaLabel}
    >
      {posts.map((post) => {
        const locked =
          isLockedProp?.(post) ?? post.is_locked ?? (!isSubscriber && post.visibility === "SUBSCRIBERS");
        return (
          <li key={post.id}>
            <PostCell
              post={post}
              locked={locked}
              onUnlockClick={onUnlockClick ? () => onUnlockClick(post) : undefined}
              showWatermark={showWatermark}
              t={t}
            />
          </li>
        );
      })}
    </ul>
  );
}
