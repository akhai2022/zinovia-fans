"use client";

import { cn } from "@/lib/utils";
import { Icon } from "@/components/ui/icon";

interface LockedOverlayProps {
  className?: string;
  /** Short line shown on overlay, e.g. "Subscriber only" */
  label?: string;
  /** When true, overlay is visible and blocks interaction */
  locked: boolean;
  children: React.ReactNode;
  /** Optional click handler (e.g. open subscribe sheet); overlay still blocks direct child interaction */
  onUnlockClick?: () => void;
}

export function LockedOverlay({
  className,
  label = "Subscribe to unlock",
  locked,
  children,
  onUnlockClick,
}: LockedOverlayProps) {
  return (
    <div className={cn("relative overflow-hidden", className)}>
      {children}
      {locked && (
        <div
          className="absolute inset-0 flex flex-col items-center justify-center bg-card/70 backdrop-blur-[2px] transition-opacity duration-fast ease-premium-out"
        >
          <span className="sr-only">{label}</span>
          <Icon name="lock" className="icon-xl text-foreground" />
          <p className="mt-2 text-premium-small font-medium text-foreground">{label}</p>
          {onUnlockClick && (
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onUnlockClick();
              }}
              className="mt-3 inline-flex items-center gap-1.5 rounded-premium-sm bg-primary px-3 py-1.5 text-premium-small font-medium text-white hover:bg-primary/90 focus-visible:outline focus-visible:ring-2 focus-visible:ring-primary/35"
              aria-label="Subscribe to unlock this content"
            >
              <Icon name="lock" className="icon-sm" />
              Unlock
            </button>
          )}
        </div>
      )}
    </div>
  );
}
