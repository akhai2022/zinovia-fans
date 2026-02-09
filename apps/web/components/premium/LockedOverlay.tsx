"use client";

import { cn } from "@/lib/utils";

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
          className="absolute inset-0 flex flex-col items-center justify-center bg-neutral-900/60 transition-opacity duration-fast ease-premium-out"
          style={{ background: "linear-gradient(180deg, transparent 30%, rgba(28,25,23,0.75) 100%)" }}
        >
          <span className="sr-only">{label}</span>
          <svg
            className="h-8 w-8 shrink-0 text-white"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={1.5}
            stroke="currentColor"
            aria-hidden
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z"
            />
          </svg>
          <p className="mt-2 text-premium-small font-medium text-white">{label}</p>
          {onUnlockClick && (
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onUnlockClick();
              }}
              className="mt-3 rounded-premium-sm bg-white/90 px-3 py-1.5 text-premium-small font-medium text-neutral-900 hover:bg-white focus-visible:outline focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-neutral-900/60"
              aria-label="Subscribe to unlock this content"
            >
              Unlock
            </button>
          )}
        </div>
      )}
    </div>
  );
}
