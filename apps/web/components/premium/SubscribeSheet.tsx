"use client";

import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { PricingCard } from "./PricingCard";
import { cn } from "@/lib/utils";
import type { SubscriptionOffer } from "@/types/creator";

export interface SubscribeSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  creatorName: string;
  offer: SubscriptionOffer;
  onSubscribe: () => void;
  loading?: boolean;
  /** When set, CTA is disabled and this message is shown (e.g. payments not configured) */
  disabledHelper?: string | null;
}

export function SubscribeSheet({
  open,
  onOpenChange,
  creatorName,
  offer,
  onSubscribe,
  loading = false,
  disabledHelper,
}: SubscribeSheetProps) {
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") onOpenChange(false);
    };
    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [open, onOpenChange]);

  useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  if (!open) return null;

  const overlay = (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="subscribe-sheet-title"
      className="fixed inset-0 z-50 flex items-end justify-center md:items-center"
      onClick={() => onOpenChange(false)}
    >
      <div
        className="absolute inset-0 bg-overlay transition-opacity duration-normal ease-premium-out"
        style={{ backgroundColor: "var(--bg-overlay)" }}
        aria-hidden
      />
      <div
        ref={panelRef}
        className={cn(
          "relative z-50 w-full max-w-lg overflow-auto rounded-t-premium-lg bg-card shadow-premium-xl transition-transform duration-normal ease-premium-out",
          "md:rounded-premium-lg md:max-h-[90vh]"
        )}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-4 md:p-6">
          <div className="mb-4 flex items-center justify-between md:mb-6">
            <h2
              id="subscribe-sheet-title"
              className="text-premium-h3 text-foreground"
            >
              Subscribe to {creatorName}
            </h2>
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              className="rounded-premium-sm p-1 text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-500 focus-visible:ring-offset-2"
              aria-label="Close"
            >
              <span className="sr-only">Close</span>
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          <PricingCard
            offer={offer}
            creatorName={creatorName}
            ctaLabel={loading ? "Starting…" : disabledHelper ? "Unavailable" : undefined}
            onCtaClick={onSubscribe}
            disabled={loading || Boolean(disabledHelper)}
            disabledHelper={disabledHelper ?? undefined}
            badge={null}
          />
        </div>
      </div>
    </div>
  );

  return typeof document !== "undefined"
    ? createPortal(overlay, document.body)
    : null;
}
