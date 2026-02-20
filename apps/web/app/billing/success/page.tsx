"use client";

import { useEffect, useState, Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Page } from "@/components/brand/Page";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { apiFetch } from "@/lib/api/client";
import "@/lib/api";

const MAX_POLLS = 10;
const POLL_INTERVAL_MS = 2000;

function SuccessContent() {
  const searchParams = useSearchParams();
  const returnTo = searchParams.get("return") ?? "/feed";
  const creatorId = searchParams.get("creator_id");
  const creatorHandle = searchParams.get("creator_handle");
  const returnLabel = returnTo.startsWith("/creators/")
    ? `Back to @${creatorHandle || "creator"}`
    : "Go to feed";

  const [entitlementConfirmed, setEntitlementConfirmed] = useState(false);
  const [pollCount, setPollCount] = useState(0);
  const [polling, setPolling] = useState(!!creatorId);

  // Poll for entitlement if we have a creator_id (webhook may be delayed)
  useEffect(() => {
    if (!creatorId || entitlementConfirmed || pollCount >= MAX_POLLS) {
      setPolling(false);
      return;
    }
    const timer = setTimeout(async () => {
      try {
        const data = await apiFetch<{ items: Array<{ status: string; creator_user_id: string }> }>(
          "/billing/status",
          { method: "GET", query: { creator_user_id: creatorId } },
        );
        const active = data.items?.some((s) => s.status === "active");
        if (active) {
          setEntitlementConfirmed(true);
          setPolling(false);
        } else {
          setPollCount((c) => c + 1);
        }
      } catch {
        setPollCount((c) => c + 1);
      }
    }, POLL_INTERVAL_MS);
    return () => clearTimeout(timer);
  }, [creatorId, entitlementConfirmed, pollCount]);

  const headingText = creatorHandle
    ? `Subscribed to @${creatorHandle}`
    : "Payment successful";

  return (
    <Page className="flex min-h-[50vh] flex-col items-center justify-center gap-6">
      <Card className="w-full max-w-md">
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-green-100 text-green-600 dark:bg-green-900 dark:text-green-300">
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h1 className="font-display text-premium-h3 font-semibold text-foreground">
              {headingText}
            </h1>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {polling && (
            <div className="flex items-center gap-2 rounded-lg border border-border bg-muted/50 p-3">
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
              <p className="text-sm text-muted-foreground">
                Activating your subscription...
              </p>
            </div>
          )}
          {entitlementConfirmed && (
            <div className="rounded-lg border border-green-200 bg-green-50 p-3 dark:border-green-800 dark:bg-green-950">
              <p className="text-sm font-medium text-green-700 dark:text-green-300">
                Subscription active! You now have access to subscriber-only content.
              </p>
            </div>
          )}
          {!polling && !entitlementConfirmed && (
            <p className="text-sm text-muted-foreground">
              You&apos;re now subscribed. You can access subscriber-only content from this creator.
              If content doesn&apos;t appear immediately, please refresh in a few moments.
            </p>
          )}
          <div className="flex flex-wrap gap-3">
            {creatorHandle && (
              <Button asChild>
                <Link href={`/creators/${creatorHandle}`}>
                  View @{creatorHandle}
                </Link>
              </Button>
            )}
            <Button variant={creatorHandle ? "secondary" : "default"} asChild>
              <Link href="/feed">Go to feed</Link>
            </Button>
            <Button variant="ghost" size="sm" asChild>
              <Link href="/billing/manage">Manage subscriptions</Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </Page>
  );
}

export default function BillingSuccessPage() {
  return (
    <Suspense
      fallback={
        <Page className="flex min-h-[50vh] items-center justify-center">
          <p className="text-sm text-muted-foreground">Loading…</p>
        </Page>
      }
    >
      <SuccessContent />
    </Suspense>
  );
}
