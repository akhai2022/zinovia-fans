import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function Section({
  id,
  title,
  subtitle,
  children,
  className,
  tone = "plain",
  "aria-labelledby": ariaLabelledBy,
  "aria-label": ariaLabel,
}: {
  id?: string;
  title?: ReactNode;
  subtitle?: ReactNode;
  children: ReactNode;
  className?: string;
  tone?: "plain" | "muted" | "surface";
  "aria-labelledby"?: string;
  "aria-label"?: string;
}) {
  return (
    <section
      id={id}
      aria-labelledby={ariaLabelledBy}
      aria-label={ariaLabel}
      className={cn(
        "border-t border-border/70",
        tone === "muted" && "bg-muted/25",
        tone === "surface" && "bg-surface-2/50",
        "py-10 sm:py-14",
        className
      )}
    >
      <div className="mx-auto w-full max-w-6xl px-4 sm:px-6">
        {(title || subtitle) && (
          <div className="mb-6 sm:mb-8 max-w-2xl">
            {title && (
              <h2
                id={ariaLabelledBy}
                className="text-premium-h2 font-semibold text-foreground"
              >
                {title}
              </h2>
            )}
            {subtitle && (
              <p className="mt-2 text-premium-body-sm text-muted-foreground">
                {subtitle}
              </p>
            )}
          </div>
        )}
        {children}
      </div>
    </section>
  );
}
