"use client";

import { useState } from "react";
import { Icon } from "@/components/ui/icon";
import { Spinner } from "@/components/ui/spinner";
import { createPpvPostIntent } from "@/lib/api/ppv";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { useTranslation, interpolate } from "@/lib/i18n";

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
  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const formattedPrice = formatPrice(priceCents, currency);

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
        setError(t.ppv.errorUnableToInitialize);
        setLoading(false);
        return;
      }
      window.location.assign(intent.checkout_url);
    } catch (err) {
      setError(err instanceof Error ? err.message : t.ppv.errorFailedToStart);
      setLoading(false);
    }
  };

  return (
    <Modal open onClose={onClose} title={interpolate(t.ppv.unlockForPrice, { price: formattedPrice })}>
      {error && (
        <div className="space-y-2">
          <p className="text-sm text-destructive">{error}</p>
          <Button size="sm" variant="outline" onClick={startPayment} className="gap-1.5">
            <Icon name="refresh" className="icon-base" />
            {t.ppv.retryButton}
          </Button>
        </div>
      )}
      {!error && (
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            {t.ppv.paymentRedirectDescription}
          </p>
          <Button size="sm" onClick={startPayment} disabled={loading} className="gap-1.5">
            {loading ? (
              <>
                <Spinner className="icon-base" />
                {t.ppv.redirecting}
              </>
            ) : (
              <>
                <Icon name="lock_open" className="icon-base" />
                {interpolate(t.ppv.payButton, { price: formattedPrice })}
              </>
            )}
          </Button>
        </div>
      )}
    </Modal>
  );
}
