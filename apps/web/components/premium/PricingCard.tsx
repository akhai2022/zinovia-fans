"use client";

import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { SubscriptionOffer } from "@/types/creator";

interface PricingCardProps {
  offer: SubscriptionOffer;
  creatorName: string;
  ctaLabel?: string;
  onCtaClick?: () => void;
  className?: string;
  /** Optional badge, e.g. "Most popular" */
  badge?: string | null;
  /** Disable CTA (e.g. while loading) */
  disabled?: boolean;
  /** Shown below button when disabled to avoid confusion */
  disabledHelper?: string | null;
}

export function PricingCard({
  offer,
  creatorName,
  ctaLabel,
  onCtaClick,
  className,
  badge,
  disabled = false,
  disabledHelper,
}: PricingCardProps) {
  const priceLabel = `$${offer.price}/${offer.interval}`;
  const cta = ctaLabel ?? `Subscribe — $${offer.price}/${offer.interval}`;

  return (
    <Card
      className={cn(
        "rounded-premium-xl border-neutral-200 shadow-premium-sm",
        className
      )}
    >
      {badge && (
        <div className="rounded-t-premium-xl bg-accent-50 px-4 py-1.5 text-center text-premium-label font-medium uppercase tracking-wide text-accent-700">
          {badge}
        </div>
      )}
      <CardHeader className="pb-2">
        <h3 className="text-premium-h3 text-foreground">
          Subscribe to {creatorName}
        </h3>
        <p className="text-premium-body-sm text-muted-foreground">
          {priceLabel} · Billed monthly
        </p>
      </CardHeader>
      <CardContent className="space-y-3">
        <ul className="space-y-2" role="list">
          {offer.perks.map((perk, i) => (
            <li
              key={i}
              className="flex items-center gap-2 text-premium-body-sm text-foreground"
            >
              <span
                className="text-success-500"
                aria-hidden
              >
                <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
                  <path
                    fillRule="evenodd"
                    d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                    clipRule="evenodd"
                  />
                </svg>
              </span>
              {perk}
            </li>
          ))}
          {offer.dm_included && (
            <li className="flex items-center gap-2 text-premium-body-sm text-muted-foreground">
              <span className="text-success-500" aria-hidden>
                <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
                  <path
                    fillRule="evenodd"
                    d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                    clipRule="evenodd"
                  />
                </svg>
              </span>
              Subscriber-only DMs included
            </li>
          )}
        </ul>
        <p className="text-premium-small text-muted-foreground">
          Cancel anytime. Access until the end of your billing period.
        </p>
      </CardContent>
      <CardFooter className="flex flex-col gap-2 pt-2">
        <button
          type="button"
          onClick={onCtaClick}
          disabled={disabled}
          className={cn(
            "w-full rounded-premium-sm py-2.5 text-premium-body-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-500 focus-visible:ring-offset-2 disabled:pointer-events-none",
            disabled
              ? "bg-neutral-200 text-neutral-500 cursor-not-allowed"
              : "bg-accent-600 text-white hover:bg-accent-700"
          )}
          aria-label={cta}
        >
          {cta}
        </button>
        {disabled && disabledHelper && (
          <p className="text-premium-small text-muted-foreground" role="status">
            {disabledHelper}
          </p>
        )}
        <p className="text-premium-small text-muted-foreground">
          Secure payment. Your card is never shared with the creator.
        </p>
      </CardFooter>
    </Card>
  );
}
