"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { BillingService } from "@/features/billing/api";
import { Button } from "@/components/ui/button";
import { getApiErrorMessage } from "@/lib/errors";
import { buildBillingReturnUrls } from "@/features/billing/checkoutUrls";
import { apiFetch } from "@/lib/api/client";
import { uuidClient } from "@/lib/uuid";
import "@/lib/api";

type SubscribeCheckoutButtonProps = {
  creatorId: string;
  creatorHandle: string;
  price?: string;
  currency?: string;
  /** Already subscribed — hide the button */
  isSubscriber?: boolean;
};

export function SubscribeCheckoutButton({
  creatorId,
  creatorHandle,
  price,
  currency,
  isSubscriber = false,
}: SubscribeCheckoutButtonProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const idempotencyRef = useRef<string | null>(null);

  if (isSubscriber) return null;

  const onSubscribe = async () => {
    if (typeof window === "undefined" || loading) return;
    setLoading(true);
    setError(null);

    // Quick auth check: try /auth/me. If 401, redirect to login.
    try {
      await apiFetch("/auth/me", { method: "GET" });
    } catch (authErr) {
      const parsed = getApiErrorMessage(authErr);
      if (parsed.kind === "unauthorized") {
        const returnTo = `/creators/${creatorHandle}`;
        router.push(`/login?next=${encodeURIComponent(returnTo)}`);
        return;
      }
      // Network/other error — fall through to let the main call fail with a message
    }

    // Generate idempotency key for this click
    if (!idempotencyRef.current) {
      idempotencyRef.current = uuidClient();
    }

    try {
      const { successUrl, cancelUrl } = buildBillingReturnUrls(
        window.location.origin,
        `/creators/${creatorHandle}`,
        { creatorId, creatorHandle },
      );
      const response = await BillingService.billingCheckoutSubscription({
        creator_id: creatorId,
        success_url: successUrl,
        cancel_url: cancelUrl,
      });
      if (!response.checkout_url) {
        setError("Unable to start checkout. Please try again.");
        setLoading(false);
        idempotencyRef.current = null;
        return;
      }
      window.location.assign(response.checkout_url);
    } catch (err) {
      const parsed = getApiErrorMessage(err);
      if (parsed.kind === "unauthorized") {
        const returnTo = `/creators/${creatorHandle}`;
        router.push(`/login?next=${encodeURIComponent(returnTo)}`);
        return;
      }
      setError(parsed.message);
      setLoading(false);
      idempotencyRef.current = null;
    }
  };

  const priceLabel = price
    ? `Subscribe — ${parseFloat(price).toFixed(2)} ${(currency || "eur").toUpperCase()}/mo`
    : "Subscribe";

  return (
    <div className="flex flex-col items-end gap-1">
      <Button
        size="sm"
        className="btn-cta-primary gap-1.5 px-5 font-semibold"
        onClick={onSubscribe}
        disabled={loading}
      >
        {loading ? (
          "Starting..."
        ) : (
          <>
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
            </svg>
            {priceLabel}
          </>
        )}
      </Button>
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}
