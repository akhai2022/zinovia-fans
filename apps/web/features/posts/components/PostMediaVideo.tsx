"use client";

import { useEffect, useState } from "react";
import { getMediaDownloadUrl } from "@/features/media/downloadUrl";

type PostMediaVideoProps = {
  assetId: string;
  className?: string;
};

/**
 * Renders a single video asset with optional poster. Fetches signed URLs for video and poster (variant=poster).
 * Loading/error: placeholder to avoid layout shift.
 */
export function PostMediaVideo({ assetId, className }: PostMediaVideoProps) {
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [posterUrl, setPosterUrl] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    getMediaDownloadUrl(assetId)
      .then((url) => {
        if (!cancelled && url) setVideoUrl(url);
      })
      .catch(() => {});
    getMediaDownloadUrl(assetId, "poster")
      .then((url) => {
        if (!cancelled && url) setPosterUrl(url);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [assetId]);

  const placeholder = (
    <div
      className={className}
      style={{ background: "var(--muted)" }}
      aria-hidden
    />
  );

  if (!videoUrl) return placeholder;

  return (
    <video
      controls
      preload="metadata"
      poster={posterUrl ?? undefined}
      src={videoUrl}
      className={className}
      playsInline
      {...{ referrerPolicy: "no-referrer" } as React.VideoHTMLAttributes<HTMLVideoElement>}
    />
  );
}
