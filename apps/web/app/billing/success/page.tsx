"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { Page } from "@/components/brand/Page";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";

function SuccessContent() {
  const searchParams = useSearchParams();
  const returnTo = searchParams.get("return") ?? "/feed";
  const returnLabel = returnTo.startsWith("/creators/")
    ? "Back to creator"
    : "Go to feed";

  return (
    <Page className="flex min-h-[50vh] flex-col items-center justify-center gap-6">
      <Card className="w-full max-w-md">
        <CardHeader>
          <h1 className="text-xl font-semibold tracking-tight text-foreground">
            Payment successful
          </h1>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            You’re now subscribed. You can access subscriber-only content from this creator.
          </p>
          <div className="flex flex-wrap gap-3">
            <Button asChild>
              <Link href="/feed">Go to feed</Link>
            </Button>
            <Button variant="outline" asChild>
              <Link href={returnTo}>{returnLabel}</Link>
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
