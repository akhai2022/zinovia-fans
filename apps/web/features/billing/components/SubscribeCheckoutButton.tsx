"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { Icon } from "@/components/ui/icon";
import { Spinner } from "@/components/ui/spinner";
import { BillingService } from "@/features/billing/api";
import { Button } from "@/components/ui/button";
import { getApiErrorMessage } from "@/lib/errors";
import { buildBillingReturnUrls } from "@/features/billing/checkoutUrls";
import { uuidClient } from "@/lib/uuid";
import { useSession } from "@/lib/hooks/useSession";
import { useTranslation, interpolate } from "@/lib/i18n";
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
  const { user: sessionUser } = useSession();
  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const idempotencyRef = useRef<string | null>(null);

  if (isSubscriber) return null;

  const onSubscribe = async () => {
    if (typeof window === "undefined" || loading) return;
    setLoading(true);
    setError(null);

    // Auth check: redirect unauthenticated users to login
    if (!sessionUser) {
      const returnTo = `/creators/${creatorHandle}`;
      router.push(`/login?next=${encodeURIComponent(returnTo)}`);
      return;
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
        setError(t.subscribe.errorUnableToStartCheckout);
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
    ? interpolate(t.subscribe.subscribeWithPrice, {
        price: parseFloat(price).toFixed(2),
        currency: (currency || "eur").toUpperCase(),
      })
    : t.subscribe.subscribe;

  return (
    <div className="flex flex-col items-end gap-1">
      <Button
        size="sm"
        className="btn-cta-primary gap-1.5 px-5 font-semibold"
        onClick={onSubscribe}
        disabled={loading}
      >
        {loading ? (
          <>
            <Spinner className="icon-base" />
            {t.subscribe.starting}
          </>
        ) : (
          <>
            <Icon name="star" className="icon-base" />
            {priceLabel}
          </>
        )}
      </Button>
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}
