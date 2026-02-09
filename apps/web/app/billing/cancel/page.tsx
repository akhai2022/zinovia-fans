"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { Page } from "@/components/brand/Page";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";

function CancelContent() {
  const searchParams = useSearchParams();
  const returnTo = searchParams.get("return") ?? "/creators";
  const returnLabel = returnTo.startsWith("/creators/") && returnTo !== "/creators"
    ? "Back to creator"
    : "Browse creators";

  return (
    <Page className="flex min-h-[50vh] flex-col items-center justify-center gap-6">
      <Card className="w-full max-w-md">
        <CardHeader>
          <h1 className="text-xl font-semibold tracking-tight text-foreground">
            Payment canceled
          </h1>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            You didn’t complete the subscription. You can try again anytime from the creator’s page.
          </p>
          <div className="flex flex-wrap gap-3">
            <Button asChild>
              <Link href={returnTo}>{returnLabel}</Link>
            </Button>
            <Button variant="outline" asChild>
              <Link href="/feed">Feed</Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </Page>
  );
}

export default function BillingCancelPage() {
  return (
    <Suspense
      fallback={
        <Page className="flex min-h-[50vh] items-center justify-center">
          <p className="text-sm text-muted-foreground">Loading…</p>
        </Page>
      }
    >
      <CancelContent />
    </Suspense>
  );
}
