"use client";

import { useState } from "react";
import { createPpvPostIntent } from "@/lib/api/ppv";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";

function formatPrice(cents: number, currency: string): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currency.toUpperCase(),
    minimumFractionDigits: 2,
  }).format(cents / 100);
}

export function PostUnlockButton({
  postId,
  priceCents,
  currency,
  onClose,
  onUnlocked,
}: {
  postId: string;
  priceCents: number;
  currency: string;
  onClose: () => void;
  onUnlocked: () => void;
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const startPayment = async () => {
    setLoading(true);
    setError(null);
    try {
      const intent = await createPpvPostIntent(postId);
      if (intent.status === "ALREADY_UNLOCKED") {
        onUnlocked();
        return;
      }
      if (!intent.checkout_url) {
        setError("Unable to initialize payment.");
        setLoading(false);
        return;
      }
      window.location.assign(intent.checkout_url);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to start payment.");
      setLoading(false);
    }
  };

  return (
    <Modal open onClose={onClose} title={`Unlock for ${formatPrice(priceCents, currency)}`}>
      {error && (
        <div className="space-y-2">
          <p className="text-sm text-destructive">{error}</p>
          <Button size="sm" variant="outline" onClick={startPayment}>
            Retry
          </Button>
        </div>
      )}
      {!error && (
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            You will be redirected to our payment processor to complete the purchase.
          </p>
          <Button size="sm" onClick={startPayment} disabled={loading}>
            {loading ? "Redirecting..." : `Pay ${formatPrice(priceCents, currency)}`}
          </Button>
        </div>
      )}
    </Modal>
  );
}
