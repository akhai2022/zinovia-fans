"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Icon } from "@/components/ui/icon";
import { Spinner } from "@/components/ui/spinner";
import { Button } from "@/components/ui/button";
import { useSession } from "@/lib/hooks/useSession";
import { useTranslation, interpolate } from "@/lib/i18n";
import { createTipIntent } from "@/features/payments/api";
import { getApiErrorMessage } from "@/lib/errors";

const PRESET_AMOUNTS = [200, 500, 1000, 2500]; // cents
const DEFAULT_CURRENCY = "eur";

interface TipButtonProps {
  creatorId: string;
  creatorHandle?: string;
}

export function TipButton({ creatorId, creatorHandle }: TipButtonProps) {
  const router = useRouter();
  const { user: sessionUser } = useSession();
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [amountStr, setAmountStr] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const currency = DEFAULT_CURRENCY;

  const handleOpen = () => {
    if (!sessionUser) {
      const returnTo = creatorHandle ? `/creators/${creatorHandle}` : "/";
      router.push(`/login?next=${encodeURIComponent(returnTo)}`);
      return;
    }
    setOpen(true);
    setError(null);
    setAmountStr("");
  };

  const handleSend = async () => {
    const amount = parseFloat(amountStr);
    if (isNaN(amount) || amount <= 0) return;
    const amountCents = Math.round(amount * 100);

    if (amountCents < 100) {
      setError(interpolate(t.tip.errorMinAmount, { min: "1.00", currency: currency.toUpperCase() }));
      return;
    }
    if (amountCents > 50000) {
      setError(interpolate(t.tip.errorMaxAmount, { max: "500.00", currency: currency.toUpperCase() }));
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const result = await createTipIntent({
        creator_id: creatorId,
        amount_cents: amountCents,
        currency,
      });
      if (result.checkout_url) {
        window.location.assign(result.checkout_url);
      } else {
        setError(t.tip.errorFailed);
        setLoading(false);
      }
    } catch (err) {
      const parsed = getApiErrorMessage(err);
      if (parsed.kind === "unauthorized") {
        const returnTo = creatorHandle ? `/creators/${creatorHandle}` : "/";
        router.push(`/login?next=${encodeURIComponent(returnTo)}`);
        return;
      }
      setError(parsed.message || t.tip.errorFailed);
      setLoading(false);
    }
  };

  const selectPreset = (cents: number) => {
    setAmountStr((cents / 100).toFixed(2));
    setError(null);
  };

  if (!open) {
    return (
      <Button variant="secondary" size="sm" onClick={handleOpen}>
        <Icon name="volunteer_activism" className="mr-1 icon-base" />
        {t.tip.tipButton}
      </Button>
    );
  }

  return (
    <div className="flex flex-col gap-2 rounded-lg border border-border bg-card p-3 shadow-sm">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold text-foreground">{t.tip.tipTitle}</p>
        <button
          type="button"
          onClick={() => { setOpen(false); setLoading(false); }}
          className="text-muted-foreground hover:text-foreground"
          aria-label="Close"
        >
          <Icon name="close" className="icon-base" />
        </button>
      </div>
      <p className="text-xs text-muted-foreground">{t.tip.tipDescription}</p>

      {/* Preset amounts */}
      <div className="flex flex-wrap gap-1.5">
        {PRESET_AMOUNTS.map((cents) => (
          <button
            key={cents}
            type="button"
            onClick={() => selectPreset(cents)}
            className="rounded-full border border-border px-3 py-1 text-xs font-medium text-foreground hover:bg-muted transition-colors"
          >
            {(cents / 100).toFixed(0)} {currency.toUpperCase()}
          </button>
        ))}
      </div>

      {/* Custom amount input */}
      <div className="flex gap-2">
        <input
          type="number"
          min="1"
          step="0.01"
          value={amountStr}
          onChange={(e) => { setAmountStr(e.target.value); setError(null); }}
          placeholder={t.tip.amountPlaceholder}
          className="h-9 flex-1 rounded border border-input bg-background px-3 text-sm"
          disabled={loading}
        />
        <Button size="sm" onClick={handleSend} disabled={loading || !amountStr}>
          {loading ? (
            <>
              <Spinner className="mr-1 icon-sm" />
              {t.tip.sending}
            </>
          ) : (
            t.tip.sendTip
          )}
        </Button>
      </div>

      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}
