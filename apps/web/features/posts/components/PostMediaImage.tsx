"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { MediaService } from "@/features/media/api";
import "@/lib/api";

/** Session-only cache: assetId -> signed URL. Avoids refetch when same asset is used in multiple cells. */
const signedUrlCache = new Map<string, string>();

const WATERMARK_SRC = "/brand/zinovia-verified.svg";

/**
 * Renders a single post media asset by fetching a signed download URL.
 * Uses in-memory cache so repeated mounts (e.g. grid + feed) don't refetch.
 * Loading/error: same-size placeholder to avoid layout shift.
 * Optional watermark overlay (e.g. for creator profile grid only).
 */
export function PostMediaImage({
  assetId,
  variant,
  className,
  watermark = false,
}: {
  assetId: string;
  variant?: "thumb" | "grid" | "full" | "poster";
  className?: string;
  /** Show "Validated by Zinovia Fans" badge bottom-right (e.g. profile grid only) */
  watermark?: boolean;
}) {
  const cacheKey = variant ? `${assetId}:${variant}` : assetId;
  const [url, setUrl] = useState<string | null>(() => signedUrlCache.get(cacheKey) ?? null);

  useEffect(() => {
    if (signedUrlCache.has(cacheKey)) {
      setUrl(signedUrlCache.get(cacheKey)!);
      return;
    }
    let cancelled = false;
    MediaService.mediaDownloadUrl(assetId, variant ?? null)
      .then((res) => {
        if (!cancelled && res.download_url) {
          signedUrlCache.set(cacheKey, res.download_url);
          setUrl(res.download_url);
        }
      })
      .catch(() => {
        /* On failure we keep showing placeholder (url stays null). */
      });
    return () => {
      cancelled = true;
    };
  }, [assetId, cacheKey, variant]);

  const placeholder = (
    <div
      className={className}
      style={{ background: "var(--muted)" }}
      aria-hidden
    />
  );

  if (!url) return placeholder;

  return (
    <div className="relative h-full w-full">
      <img src={url} alt="" className={className} />
      {watermark && (
        <div
          className="absolute bottom-1.5 right-1.5 flex items-center opacity-90"
          aria-hidden
        >
          <Image
            src={WATERMARK_SRC}
            alt=""
            width={88}
            height={16}
            className="h-4 w-auto max-w-[88px]"
          />
        </div>
      )}
    </div>
  );
}
