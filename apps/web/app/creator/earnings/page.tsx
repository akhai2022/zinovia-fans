"use client";

import { useEffect, useState } from "react";
import { useRequireRole } from "@/lib/hooks/useRequireRole";
import { Page } from "@/components/brand/Page";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  getCreatorEarnings,
  type CreatorEarningsOut,
} from "@/features/creator-earnings/api";

function formatCents(cents: number, currency: string): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currency.toUpperCase(),
    minimumFractionDigits: 2,
  }).format(cents / 100);
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function typeLabel(t: string): string {
  switch (t) {
    case "SUBSCRIPTION": return "Subscription";
    case "TIP": return "Tip";
    case "PPV_POST": return "PPV Post";
    case "PPV_MESSAGE": return "PPV Message";
    case "REFUND": return "Refund";
    default: return t.replace(/_/g, " ");
  }
}

export default function EarningsPage() {
  const { authorized } = useRequireRole(["creator", "admin"]);
  const [data, setData] = useState<CreatorEarningsOut | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getCreatorEarnings({ days: 30, limit: 50 })
      .then(setData)
      .catch((err) => {
        setError(
          err && typeof err === "object" && "message" in err
            ? (err as { message: string }).message
            : "Failed to load earnings.",
        );
      })
      .finally(() => setLoading(false));
  }, []);

  if (!authorized) return null;

  if (loading) {
    return (
      <Page className="max-w-4xl space-y-6">
        <h1 className="font-display text-premium-h2 font-semibold text-foreground">
          Earnings
        </h1>
        <div className="grid gap-4 sm:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-24 w-full rounded-xl" />
          ))}
        </div>
        <Skeleton className="h-64 w-full rounded-xl" />
      </Page>
    );
  }

  if (error || !data) {
    return (
      <Page className="max-w-4xl space-y-6">
        <h1 className="font-display text-premium-h2 font-semibold text-foreground">
          Earnings
        </h1>
        <Card className="border-destructive/20 bg-destructive/5 p-6">
          <p className="text-sm text-destructive">{error || "No data available."}</p>
        </Card>
      </Page>
    );
  }

  const { summary, last_transactions, payout_method } = data;
  const cur = summary.currency || "usd";

  return (
    <Page className="max-w-4xl space-y-6">
      <h1 className="font-display text-premium-h2 font-semibold text-foreground">
        Earnings
      </h1>

      {/* Summary cards */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Gross (30 days)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-foreground">
              {formatCents(summary.gross_cents, cur)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Platform fees
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-muted-foreground">
              {formatCents(summary.fee_cents, cur)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Net earnings
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-emerald-600">
              {formatCents(summary.net_cents, cur)}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Payout status */}
      <Card>
        <CardHeader>
          <CardTitle>Payout method</CardTitle>
        </CardHeader>
        <CardContent>
          {payout_method.configured ? (
            <div className="space-y-1 text-sm">
              <p className="text-foreground">
                Payout status:{" "}
                <span className="font-medium">
                  {payout_method.payouts_enabled ? "Payouts enabled" : "Payouts pending"}
                </span>
              </p>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              No payout method configured. Contact support to set up payouts.
            </p>
          )}
        </CardContent>
      </Card>

      {/* Transactions */}
      <Card>
        <CardHeader>
          <CardTitle>Recent transactions</CardTitle>
        </CardHeader>
        <CardContent>
          {last_transactions.length === 0 ? (
            <p className="py-4 text-center text-sm text-muted-foreground">
              No transactions yet.
            </p>
          ) : (
            <>
              <div className="overflow-x-auto rounded-lg border border-border">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border bg-muted/50 text-left text-xs uppercase tracking-wider text-muted-foreground">
                      <th className="px-4 py-3 font-semibold">Date</th>
                      <th className="px-4 py-3 font-semibold">Type</th>
                      <th className="px-4 py-3 font-semibold text-right">Gross</th>
                      <th className="px-4 py-3 font-semibold text-right">Fee</th>
                      <th className="px-4 py-3 font-semibold text-right">Net</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {last_transactions.map((tx) => (
                      <tr key={tx.id} className="text-foreground transition-colors hover:bg-white/[0.03]">
                        <td className="px-4 py-3 whitespace-nowrap text-xs text-muted-foreground">
                          {formatDate(tx.created_at)}
                        </td>
                        <td className="px-4 py-3">
                          <span className="inline-flex items-center rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                            {typeLabel(tx.type)}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right font-mono">
                          {formatCents(tx.gross_cents, tx.currency || cur)}
                        </td>
                        <td className="px-4 py-3 text-right font-mono text-muted-foreground">
                          {formatCents(tx.fee_cents, tx.currency || cur)}
                        </td>
                        <td className="px-4 py-3 text-right font-mono text-emerald-400">
                          {formatCents(tx.net_cents, tx.currency || cur)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="mt-3 text-center text-xs text-muted-foreground">
                Showing last {last_transactions.length} transactions (30 days)
              </p>
            </>
          )}
        </CardContent>
      </Card>
    </Page>
  );
}
