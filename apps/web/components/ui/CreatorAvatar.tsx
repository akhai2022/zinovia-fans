"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { Avatar, AvatarFallback, AvatarImage } from "./avatar";

interface CreatorAvatarProps {
  src?: string | null;
  displayName?: string | null;
  handle?: string | null;
  size?: "sm" | "md" | "lg";
  className?: string;
  /** Show gradient ring (brand) */
  withRing?: boolean;
  /** Show green dot when true, gray dot when false, nothing when undefined */
  isOnline?: boolean;
}

const sizeClasses = {
  sm: "h-10 w-10 text-sm",
  md: "h-12 w-12 text-sm",
  lg: "h-16 w-16 text-base",
};

const dotSizeClasses = {
  sm: "h-2.5 w-2.5",
  md: "h-3 w-3",
  lg: "h-3.5 w-3.5",
};

const ringClasses = "ring-2 ring-brand/40 ring-offset-2 ring-offset-background";

/**
 * Creator avatar with optional gradient ring, online indicator, and initials fallback.
 */
export const CreatorAvatar = React.forwardRef<HTMLDivElement, CreatorAvatarProps>(
  (
    {
      src,
      displayName,
      handle,
      size = "md",
      className,
      withRing = true,
      isOnline,
    },
    ref
  ) => {
    const initials =
      displayName?.slice(0, 2).toUpperCase() ||
      handle?.slice(0, 2).toUpperCase() ||
      "?";

    return (
      <div className="relative inline-block">
        <Avatar
          ref={ref}
          className={cn(
            sizeClasses[size],
            withRing && ringClasses,
            className
          )}
        >
          {src ? (
            <AvatarImage src={src} alt="" />
          ) : null}
          <AvatarFallback className="bg-surface-2 text-foreground font-display font-medium">
            {initials}
          </AvatarFallback>
        </Avatar>
        {isOnline !== undefined && (
          <span
            className={cn(
              "absolute bottom-0 right-0 rounded-full border-2 border-background",
              dotSizeClasses[size],
              isOnline ? "bg-emerald-500" : "bg-muted-foreground/40",
            )}
            aria-label={isOnline ? "Online" : "Offline"}
          />
        )}
      </div>
    );
  }
);
CreatorAvatar.displayName = "CreatorAvatar";
