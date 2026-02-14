import * as React from "react";
import { cn } from "@/lib/utils";

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  /** Visual variant: accent, neutral, success, popular, verified, nsfw, subscriber */
  variant?: "accent" | "neutral" | "primary" | "success" | "popular" | "verified" | "nsfw" | "subscriber";
}

const variantClasses: Record<NonNullable<BadgeProps["variant"]>, string> = {
  accent: "bg-accent/12 text-accent",
  neutral: "bg-muted text-muted-foreground",
  primary: "bg-primary/12 text-primary",
  success: "bg-success/12 text-success",
  popular: "bg-primary/12 text-primary",
  verified: "bg-primary/10 text-primary",
  nsfw: "bg-destructive/12 text-destructive",
  subscriber: "bg-accent/12 text-accent",
};

const Badge = React.forwardRef<HTMLSpanElement, BadgeProps>(
  ({ className, variant = "accent", ...props }, ref) => (
    <span
      ref={ref}
      className={cn(
        "inline-flex items-center rounded-premium-sm px-2.5 py-1 text-premium-label font-semibold uppercase tracking-wide",
        variantClasses[variant],
        className
      )}
      {...props}
    />
  )
);
Badge.displayName = "Badge";

export { Badge };
