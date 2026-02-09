import * as React from "react";
import { cn } from "@/lib/utils";

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  /** Visual variant: accent, neutral, success, popular, verified, nsfw, subscriber */
  variant?: "accent" | "neutral" | "success" | "popular" | "verified" | "nsfw" | "subscriber";
}

const variantClasses: Record<NonNullable<BadgeProps["variant"]>, string> = {
  accent: "bg-accent-50 text-accent-700",
  neutral: "bg-neutral-100 text-neutral-700",
  success: "bg-success-bg text-success-500",
  popular: "bg-brand/15 text-brand ring-1 ring-brand/30",
  verified: "bg-brand/10 text-brand",
  nsfw: "bg-destructive/10 text-destructive",
  subscriber: "bg-accent-50 text-accent-700",
};

const Badge = React.forwardRef<HTMLSpanElement, BadgeProps>(
  ({ className, variant = "accent", ...props }, ref) => (
    <span
      ref={ref}
      className={cn(
        "inline-flex items-center rounded-premium-sm px-2 py-0.5 text-premium-label font-medium uppercase tracking-wide",
        variantClasses[variant],
        className
      )}
      {...props}
    />
  )
);
Badge.displayName = "Badge";

export { Badge };
