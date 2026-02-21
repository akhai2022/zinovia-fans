"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Page } from "@/components/brand/Page";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { apiFetch } from "@/lib/api/client";
import { getApiErrorMessage } from "@/lib/errors";
import "@/lib/api";

type PurchaseItem = {
  id: string;
  type: string;
  status: string;
  amount_cents: number;
  currency: string;
  creator_handle: string | null;
  creator_display_name: string | null;
  post_id: string | null;
  transaction_id: string | null;
  created_at: string;
};

type PurchaseHistory = {
  items: PurchaseItem[];
  total: number;
};

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
    case "PPV_POST":
      return "PPV Post Unlock";
    case "PPV_MESSAGE":
      return "PPV Message Unlock";
    case "TIP":
      return "Tip";
    case "SUBSCRIPTION":
      return "Subscription";
    default:
      return t.replace(/_/g, " ");
  }
}

function statusBadge(status: string) {
  const base = "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium";
  switch (status) {
    case "SUCCEEDED":
      return <span className={`${base} bg-emerald-500/10 text-emerald-400`}>Completed</span>;
    case "REQUIRES_PAYMENT":
      return <span className={`${base} bg-amber-500/10 text-amber-400`}>Pending</span>;
    case "CANCELED":
      return <span className={`${base} bg-muted text-muted-foreground`}>Canceled</span>;
    case "REFUNDED":
      return <span className={`${base} bg-blue-500/10 text-blue-400`}>Refunded</span>;
    case "DISPUTED":
      return <span className={`${base} bg-destructive/10 text-destructive`}>Disputed</span>;
    default:
      return <span className={`${base} bg-muted text-muted-foreground`}>{status}</span>;
  }
}

export default function PurchasesPage() {
  const router = useRouter();
  const [data, setData] = useState<PurchaseHistory | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const fetchPurchases = useCallback(async () => {
    try {
      const result = await apiFetch<PurchaseHistory>("/billing/purchases", {
        method: "GET",
        query: { limit: 100 },
      });
      setData(result);
      setError(null);
    } catch (err) {
      const { kind, message } = getApiErrorMessage(err);
      if (kind === "unauthorized") {
        router.replace("/login?next=/billing/purchases");
        return;
      }
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    fetchPurchases();
  }, [fetchPurchases]);

  if (loading) {
    return (
      <Page className="max-w-3xl space-y-4">
        <h1 className="font-display text-premium-h2 font-semibold text-foreground">
          Purchase History
        </h1>
        <Card>
          <CardContent className="space-y-3 p-6">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-16 w-full" />
            ))}
          </CardContent>
        </Card>
      </Page>
    );
  }

  const purchases = data?.items ?? [];
  const selected = selectedId ? purchases.find((p) => p.id === selectedId) : null;

  return (
    <Page className="max-w-3xl space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-premium-h2 font-semibold text-foreground">
          Purchase History
        </h1>
        <p className="text-sm text-muted-foreground">
          {data?.total ?? 0} total transactions
        </p>
      </div>

      {error && (
        <Card className="border-destructive/20 bg-destructive/5 p-4">
          <p className="text-sm text-destructive">{error}</p>
        </Card>
      )}

      {purchases.length === 0 && !error && (
        <Card className="py-12 text-center">
          <p className="font-display text-lg font-semibold text-foreground">
            No purchases yet
          </p>
          <p className="mt-2 text-sm text-muted-foreground">
            Unlock premium content from creators to see your purchases here.
          </p>
          <Button size="sm" className="mt-4" asChild>
            <Link href="/creators">Discover creators</Link>
          </Button>
        </Card>
      )}

      {purchases.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>All Purchases</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto rounded-lg border border-border">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/50 text-left text-xs uppercase tracking-wider text-muted-foreground">
                    <th className="px-4 py-3 font-semibold">Date</th>
                    <th className="px-4 py-3 font-semibold">Type</th>
                    <th className="px-4 py-3 font-semibold">Creator</th>
                    <th className="px-4 py-3 font-semibold">Status</th>
                    <th className="px-4 py-3 font-semibold text-right">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {purchases.map((purchase) => (
                    <tr
                      key={purchase.id}
                      onClick={() => setSelectedId(selectedId === purchase.id ? null : purchase.id)}
                      className={`cursor-pointer text-foreground transition-colors hover:bg-white/[0.03] ${selectedId === purchase.id ? "bg-primary/5" : ""}`}
                    >
                      <td className="px-4 py-3 whitespace-nowrap text-xs text-muted-foreground">
                        {formatDate(purchase.created_at)}
                      </td>
                      <td className="px-4 py-3">
                        <span className="inline-flex items-center rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                          {typeLabel(purchase.type)}
                        </span>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        {purchase.creator_display_name || purchase.creator_handle || "Unknown"}
                      </td>
                      <td className="px-4 py-3">
                        {statusBadge(purchase.status)}
                      </td>
                      <td className="px-4 py-3 text-right font-mono font-medium">
                        {formatCents(purchase.amount_cents, purchase.currency)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="mt-3 text-center text-xs text-muted-foreground">
              Showing {purchases.length} of {data?.total ?? 0} transactions
            </p>
          </CardContent>
        </Card>
      )}

      {/* Receipt detail panel */}
      {selected && (
        <Card id="receipt">
          <CardHeader>
            <CardTitle>Receipt</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-lg border border-border bg-muted/20 p-4 space-y-3">
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">Transaction ID</span>
                <span className="text-sm font-mono text-foreground">
                  {selected.transaction_id || selected.id.slice(0, 12)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">Type</span>
                <span className="text-sm text-foreground">{typeLabel(selected.type)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">Status</span>
                {statusBadge(selected.status)}
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">Creator</span>
                <span className="text-sm text-foreground">
                  {selected.creator_display_name || "—"}
                  {selected.creator_handle && (
                    <span className="ml-1 text-muted-foreground">@{selected.creator_handle}</span>
                  )}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">Date</span>
                <span className="text-sm text-foreground">{formatDate(selected.created_at)}</span>
              </div>
              <div className="border-t border-border pt-3 flex justify-between">
                <span className="text-sm font-semibold text-foreground">Amount</span>
                <span className="text-sm font-semibold text-foreground">
                  {formatCents(selected.amount_cents, selected.currency)}
                </span>
              </div>
            </div>
            <p className="text-xs text-muted-foreground text-center">
              Zinovia.ai · Digital content access · Delivered electronically
            </p>
          </CardContent>
        </Card>
      )}

      <div className="flex gap-3">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/billing/manage">Manage subscriptions</Link>
        </Button>
        <Button variant="ghost" size="sm" asChild>
          <Link href="/feed">Back to feed</Link>
        </Button>
      </div>
    </Page>
  );
}
