"use client";

import { cn } from "@/lib/utils";

interface HeroBackgroundProps {
  children?: React.ReactNode;
  className?: string;
  /** Include grid overlay */
  withGrid?: boolean;
  /** Include grain overlay */
  withGrain?: boolean;
}

/**
 * Hero background: brand gradients + optional grid and grain.
 * Uses utility classes from globals.css.
 */
export function HeroBackground({
  children,
  className,
  withGrid = true,
  withGrain = true,
}: HeroBackgroundProps) {
  return (
    <div
      className={cn(
        "relative overflow-hidden hero-bg",
        withGrid && "hero-bg-grid",
        withGrain && "hero-grain",
        className
      )}
    >
      {children}
    </div>
  );
}
