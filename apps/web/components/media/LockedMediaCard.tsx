import { Button } from "@/components/ui/button";

function formatPrice(cents?: number | null, currency = "USD"): string {
  if (!cents) return "$0.00";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currency.toUpperCase(),
    minimumFractionDigits: 2,
  }).format(cents / 100);
}

export function LockedMediaCard({
  title = "Locked media",
  priceCents,
  currency = "usd",
  onUnlock,
  unavailable = false,
}: {
  title?: string;
  priceCents?: number | null;
  currency?: string;
  onUnlock?: () => void;
  unavailable?: boolean;
}) {
  return (
    <div className="relative overflow-hidden rounded-premium-lg border border-border bg-surface-alt p-4">
      <div className="absolute inset-0 bg-card/55 backdrop-blur-[2px]" aria-hidden />
      <div className="relative z-10 flex h-full flex-col items-start justify-end gap-2">
        <span className="rounded-full bg-surface px-2 py-1 text-xs font-semibold text-muted-foreground">
          LOCKED
        </span>
        <p className="text-sm font-semibold text-foreground">{title}</p>
        <p className="text-xs text-muted-foreground">
          {unavailable ? "Locked content unavailable" : `Unlock once for ${formatPrice(priceCents, currency)}`}
        </p>
        {!unavailable && onUnlock && (
          <Button size="sm" className="mt-1 bg-accent hover:bg-accent/90" onClick={onUnlock}>
            Unlock
          </Button>
        )}
      </div>
    </div>
  );
}
