"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import { MediaService } from "@/features/media/api";
import { blurhashToDataURL } from "@/lib/blurhash";
import { cn } from "@/lib/utils";
import "@/lib/api";

/** Session-only cache: assetId -> { url, blurhash?, dominantColor? }. */
type CachedMedia = { url: string; blurhash?: string; dominantColor?: string };
const mediaCache = new Map<string, CachedMedia>();

const WATERMARK_SRC = "/brand/zinovia-verified.svg";

/**
 * Renders a single post media asset by fetching a signed download URL.
 * Uses in-memory cache so repeated mounts (e.g. grid + feed) don't refetch.
 * Lazy-loads: only fetches the signed URL when the element enters the viewport.
 * Loading state: blurhash canvas placeholder (or dominant color, or muted gray).
 * Optional watermark overlay (e.g. for creator profile grid only).
 */
export function PostMediaImage({
  assetId,
  variant,
  className,
  watermark = false,
  initialBlurhash,
  initialDominantColor,
}: {
  assetId: string;
  variant?: "thumb" | "grid" | "full" | "poster" | "teaser";
  className?: string;
  /** Show "Validated by Zinovia Fans" badge bottom-right (e.g. profile grid only) */
  watermark?: boolean;
  /** Pre-populated from post.media_previews — shows placeholder instantly */
  initialBlurhash?: string;
  /** Pre-populated from post.media_previews — fallback background color */
  initialDominantColor?: string;
}) {
  const cacheKey = variant ? `${assetId}:${variant}` : assetId;
  const cached = mediaCache.get(cacheKey);
  const [url, setUrl] = useState<string | null>(cached?.url ?? null);
  const [blurhash, setBlurhash] = useState<string | undefined>(cached?.blurhash ?? initialBlurhash);
  const [dominantColor, setDominantColor] = useState<string | undefined>(cached?.dominantColor ?? initialDominantColor);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isVisible, setIsVisible] = useState(!!cached?.url);

  // Intersection observer: only fetch signed URL when element is near viewport
  useEffect(() => {
    if (isVisible || cached?.url) return;
    const el = containerRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          observer.disconnect();
        }
      },
      { rootMargin: "200px" } // start loading 200px before entering viewport
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [isVisible, cached?.url]);

  useEffect(() => {
    if (!isVisible) return;
    if (mediaCache.has(cacheKey)) {
      const c = mediaCache.get(cacheKey)!;
      setUrl(c.url);
      setBlurhash(c.blurhash);
      setDominantColor(c.dominantColor);
      return;
    }
    let cancelled = false;
    MediaService.mediaDownloadUrl(assetId, variant ?? null)
      .then((res) => {
        if (cancelled) return;
        if (res.download_url) {
          mediaCache.set(cacheKey, {
            url: res.download_url,
            blurhash: (res as Record<string, unknown>).blurhash as string | undefined,
            dominantColor: (res as Record<string, unknown>).dominant_color as string | undefined,
          });
          setUrl(res.download_url);
          setBlurhash((res as Record<string, unknown>).blurhash as string | undefined);
          setDominantColor((res as Record<string, unknown>).dominant_color as string | undefined);
        }
      })
      .catch(() => {
        /* On failure we keep showing placeholder (url stays null). */
      });
    return () => {
      cancelled = true;
    };
  }, [assetId, cacheKey, variant, isVisible]);

  // Decode blurhash to a data URL for the placeholder background
  const blurhashDataUrl = useMemo(() => {
    if (!blurhash || typeof window === "undefined") return undefined;
    try {
      return blurhashToDataURL(blurhash);
    } catch {
      return undefined;
    }
  }, [blurhash]);

  const placeholderStyle: React.CSSProperties = blurhashDataUrl
    ? { backgroundImage: `url(${blurhashDataUrl})`, backgroundSize: "cover" }
    : dominantColor
      ? { background: dominantColor }
      : { background: "var(--muted)" };

  if (!url) {
    return <div ref={containerRef} className={cn("overflow-hidden", className)} style={placeholderStyle} aria-hidden />;
  }

  return (
    <div className={cn("relative overflow-hidden", className)}>
      <img src={url} alt="" loading="lazy" decoding="async" className="h-full w-full object-cover" referrerPolicy="no-referrer" />
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
