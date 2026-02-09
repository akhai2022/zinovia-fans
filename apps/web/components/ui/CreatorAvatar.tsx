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
}

const sizeClasses = {
  sm: "h-10 w-10 text-sm",
  md: "h-12 w-12 text-sm",
  lg: "h-16 w-16 text-base",
};

const ringClasses = "ring-2 ring-brand/40 ring-offset-2 ring-offset-background";

/**
 * Creator avatar with optional gradient ring and initials fallback.
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
    },
    ref
  ) => {
    const initials =
      displayName?.slice(0, 2).toUpperCase() ||
      handle?.slice(0, 2).toUpperCase() ||
      "?";

    return (
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
    );
  }
);
CreatorAvatar.displayName = "CreatorAvatar";
