"use client";

import { cn } from "@/lib/utils";

interface HeroBackgroundProps {
  children?: React.ReactNode;
  className?: string;
  /** Include grid overlay */
  withGrid?: boolean;
  /** Include grain overlay */
  withGrain?: boolean;
  /** Optional hero background image URL (e.g. from brand assets) */
  backgroundImageUrl?: string | null;
}

/**
 * Hero background: brand gradients + optional grid and grain.
 * Uses utility classes from globals.css.
 * When backgroundImageUrl is set, it overlays as background (with fallback to gradients).
 */
export function HeroBackground({
  children,
  className,
  withGrid = true,
  withGrain = true,
  backgroundImageUrl,
}: HeroBackgroundProps) {
  const style = backgroundImageUrl
    ? { backgroundImage: `linear-gradient(to bottom, rgba(0,0,0,0.3), rgba(0,0,0,0.5)), url(${backgroundImageUrl})`, backgroundSize: "cover" as const }
    : undefined;
  return (
    <div
      className={cn(
        "relative overflow-hidden hero-bg",
        withGrid && "hero-bg-grid",
        withGrain && "hero-grain",
        className
      )}
      style={style}
    >
      {children}
    </div>
  );
}
