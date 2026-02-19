"use client";

import { useEffect, useState } from "react";
import { MediaService } from "@/features/media/api";
import { CreatorAvatar } from "@/components/ui/CreatorAvatar";
import "@/lib/api";

const avatarUrlCache = new Map<string, string>();

/**
 * Resolves avatar_media_id to a signed URL and renders CreatorAvatar with it.
 * Falls back to gradient initials when no assetId or while loading.
 */
export function CreatorAvatarAsset({
  assetId,
  displayName,
  handle,
  size = "md",
  withRing = true,
  className,
  isOnline,
}: {
  assetId: string | null;
  displayName?: string | null;
  handle?: string | null;
  size?: "sm" | "md" | "lg";
  withRing?: boolean;
  className?: string;
  isOnline?: boolean;
}) {
  const [url, setUrl] = useState<string | null>(
    () => (assetId && avatarUrlCache.get(assetId)) ?? null
  );

  useEffect(() => {
    if (!assetId) return;
    if (avatarUrlCache.has(assetId)) {
      setUrl(avatarUrlCache.get(assetId)!);
      return;
    }
    let cancelled = false;
    MediaService.mediaDownloadUrl(assetId)
      .then((res) => {
        if (!cancelled && res.download_url) {
          avatarUrlCache.set(assetId, res.download_url);
          setUrl(res.download_url);
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [assetId]);

  return (
    <CreatorAvatar
      src={url ?? undefined}
      displayName={displayName}
      handle={handle}
      size={size}
      withRing={withRing}
      className={className}
      isOnline={isOnline}
    />
  );
}
