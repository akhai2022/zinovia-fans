"use client";

import { useState } from "react";
import { BillingService } from "@/features/billing/api";
import { Button } from "@/components/ui/button";
import { getApiErrorMessage } from "@/lib/errors";
import { buildBillingReturnUrls } from "@/features/billing/checkoutUrls";

type SubscribeCheckoutButtonProps = {
  creatorId: string;
  creatorHandle: string;
};

export function SubscribeCheckoutButton({
  creatorId,
  creatorHandle,
}: SubscribeCheckoutButtonProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onSubscribe = async () => {
    if (typeof window === "undefined") return;
    setLoading(true);
    setError(null);
    try {
      const { successUrl, cancelUrl } = buildBillingReturnUrls(
        window.location.origin,
        `/creators/${creatorHandle}`
      );
      const response = await BillingService.billingCheckoutSubscription({
        creator_id: creatorId,
        success_url: successUrl,
        cancel_url: cancelUrl,
      });
      if (!response.checkout_url) {
        setError("Unable to start checkout. Please try again.");
        setLoading(false);
        return;
      }
      window.location.assign(response.checkout_url);
    } catch (err) {
      setError(getApiErrorMessage(err).message);
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col items-end gap-1">
      <Button size="sm" onClick={onSubscribe} disabled={loading}>
        {loading ? "Starting..." : "Subscribe"}
      </Button>
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}
