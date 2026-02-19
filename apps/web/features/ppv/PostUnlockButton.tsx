"use client";

import { useEffect, useState } from "react";
import { Elements, PaymentElement, useElements, useStripe } from "@stripe/react-stripe-js";
import { loadStripe } from "@stripe/stripe-js";
import { apiFetch } from "@/lib/apiFetch";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";

const STRIPE_PK = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY || "";
const stripePromise = STRIPE_PK ? loadStripe(STRIPE_PK) : null;

interface PpvPostIntentOut {
  purchase_id: string | null;
  client_secret: string | null;
  amount_cents: number;
  currency: string;
  status: string;
}

function formatPrice(cents: number, currency: string): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currency.toUpperCase(),
    minimumFractionDigits: 2,
  }).format(cents / 100);
}

function PaymentForm({ onSuccess }: { onSuccess: () => void }) {
  const stripe = useStripe();
  const elements = useElements();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    if (!stripe || !elements) return;
    setSubmitting(true);
    setError(null);
    const res = await stripe.confirmPayment({
      elements,
      redirect: "if_required",
    });
    if (res.error) {
      setError(res.error.message || "Payment failed.");
      setSubmitting(false);
      return;
    }
    onSuccess();
    setSubmitting(false);
  };

  return (
    <div className="space-y-3">
      <PaymentElement />
      {error && <p className="text-sm text-destructive">{error}</p>}
      <Button size="sm" onClick={submit} disabled={submitting || !stripe || !elements}>
        {submitting ? "Processing..." : "Confirm unlock"}
      </Button>
    </div>
  );
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
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const startPayment = async () => {
    setLoading(true);
    setError(null);
    try {
      const intent: PpvPostIntentOut = await apiFetch(`/ppv/posts/${postId}/create-intent`, {
        method: "POST",
      });
      if (intent.status === "ALREADY_UNLOCKED") {
        onUnlocked();
        return;
      }
      if (!intent.client_secret) {
        setError("Unable to initialize payment.");
        setLoading(false);
        return;
      }
      setClientSecret(intent.client_secret);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to start payment.");
    }
    setLoading(false);
  };

  useEffect(() => {
    startPayment();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <Modal open onClose={onClose} title={`Unlock for ${formatPrice(priceCents, currency)}`}>
      {loading && <p className="text-sm text-muted-foreground">Preparing payment...</p>}
      {error && (
        <div className="space-y-2">
          <p className="text-sm text-destructive">{error}</p>
          <Button size="sm" variant="outline" onClick={startPayment}>
            Retry
          </Button>
        </div>
      )}
      {clientSecret && stripePromise && (
        <Elements stripe={stripePromise} options={{ clientSecret }}>
          <PaymentForm onSuccess={onUnlocked} />
        </Elements>
      )}
      {!stripePromise && !loading && (
        <p className="text-sm text-destructive">Payment system unavailable. Please try again later.</p>
      )}
    </Modal>
  );
}
