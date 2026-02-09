"use client";

import Image from "next/image";
import { cn } from "@/lib/utils";
import { DEMO_ASSETS } from "@/lib/demoAssets";

/** Grid tiles: first 2 locked, rest use creator demo tile. All from public/creators/demo. */
const TILES = [
  DEMO_ASSETS.locked,
  DEMO_ASSETS.locked,
  DEMO_ASSETS.tile[600],
  DEMO_ASSETS.tile[600],
  DEMO_ASSETS.tile[600],
  DEMO_ASSETS.tile[600],
] as const;

/**
 * Single tile with image + gradient overlay so it never looks empty.
 */
function PreviewTile({ src, locked }: { src: string; locked?: boolean }) {
  return (
    <div className="relative aspect-square overflow-hidden rounded-lg border border-border/60">
      <Image
        src={src}
        alt=""
        fill
        className={cn("object-cover", locked && "blur-[2px] opacity-80")}
        sizes="(max-width: 768px) 33vw, 120px"
        priority={false}
      />
      <div className={cn("absolute inset-0 pointer-events-none", locked && "bg-white/10")} />
      <div className="absolute inset-0 bg-gradient-to-br from-accent-50/60 via-transparent to-secondary/40 pointer-events-none" />
    </div>
  );
}

/**
 * Hero product preview: 3x2 grid using creator demo images (tile + locked); strip uses demo avatar.
 */
export function ProductPreview({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "relative w-full max-w-[320px] sm:max-w-[360px] mx-auto",
        "rounded-premium-xl border border-white/20 bg-white/70 backdrop-blur-sm shadow-strong overflow-hidden",
        "transition-transform duration-normal ease-premium-out",
        "hover:transition-transform motion-reduce:transition-none",
        "md:hover:scale-[1.02]",
        className
      )}
      aria-hidden
    >
      <div className="flex items-center gap-2 border-b border-border/80 bg-surface-2/80 px-3 py-2">
        <div className="flex gap-1.5">
          <span className="h-2 w-2 rounded-full bg-neutral-300" />
          <span className="h-2 w-2 rounded-full bg-neutral-300" />
          <span className="h-2 w-2 rounded-full bg-neutral-300" />
        </div>
        <div className="flex-1 rounded bg-neutral-200/80 h-5 mx-4 max-w-[140px]" />
      </div>

      <div className="flex items-center gap-3 p-4 border-b border-border/60 bg-card">
        <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-full border border-border/60">
          <Image src={DEMO_ASSETS.avatar[256]} alt="" fill className="object-cover" sizes="48px" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="h-4 w-24 rounded bg-foreground/20" />
          <div className="mt-1 h-3 w-16 rounded bg-muted-foreground/30" />
        </div>
      </div>

      <div className="p-3">
        <div className="grid grid-cols-3 gap-1.5">
          {TILES.map((src, i) => (
            <PreviewTile key={i} src={src} locked={i < 2} />
          ))}
        </div>
        <div className="mt-2 flex items-center justify-center gap-1.5 rounded-lg border border-accent-500/30 bg-gradient-to-r from-accent-50 to-accent-500/10 py-2">
          <LockIcon className="h-4 w-4 text-accent-600" />
          <span className="text-premium-small font-medium text-accent-700">
            Subscribe to unlock
          </span>
        </div>
      </div>

      <div className="border-t border-border/80 bg-surface-2/50 px-4 py-3">
        <div className="flex items-center justify-between gap-2">
          <div className="h-4 w-20 rounded bg-foreground/15" />
          <div className="h-8 w-24 rounded-premium-sm bg-brand-gradient" />
        </div>
      </div>
    </div>
  );
}

function LockIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
    </svg>
  );
}
