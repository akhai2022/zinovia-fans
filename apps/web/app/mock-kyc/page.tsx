"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { useCallback, useState } from "react";
import Link from "next/link";
import { Page } from "@/components/brand/Page";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { kycMockComplete } from "@/lib/onboardingApi";
import { getApiErrorMessage } from "@/lib/errors";
import "@/lib/api";

/**
 * Staging-only: simulates KYC provider completion.
 * Only intended when NEXT_PUBLIC_ENV=staging or local.
 */
function MockKycContent() {
  const searchParams = useSearchParams();
  const sessionId = searchParams.get("session_id");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const isStaging =
    process.env.NEXT_PUBLIC_ENV === "staging" ||
    process.env.NEXT_PUBLIC_ENV === "local" ||
    !process.env.NEXT_PUBLIC_ENV;

  const complete = useCallback(
    async (status: "APPROVED" | "REJECTED") => {
      if (!sessionId) {
        setError("Missing session_id in URL");
        return;
      }
      setError(null);
      setLoading(true);
      try {
        await kycMockComplete(sessionId, status);
        setDone(true);
      } catch (err) {
        setError(getApiErrorMessage(err).message);
      } finally {
        setLoading(false);
      }
    },
    [sessionId]
  );

  if (!sessionId) {
    return (
      <Page className="flex min-h-[60vh] items-center justify-center">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>Mock KYC</CardTitle>
            <CardDescription>Missing session_id. This page is only for staging flows.</CardDescription>
          </CardHeader>
          <CardContent>
            <Link href="/onboarding">
              <Button variant="outline">Back to onboarding</Button>
            </Link>
          </CardContent>
        </Card>
      </Page>
    );
  }

  if (!isStaging) {
    return (
      <Page className="flex min-h-[60vh] items-center justify-center">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>Not available</CardTitle>
            <CardDescription>Mock KYC is only available in staging.</CardDescription>
          </CardHeader>
        </Card>
      </Page>
    );
  }

  if (done) {
    return (
      <Page className="flex min-h-[60vh] items-center justify-center">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>Verification complete</CardTitle>
            <CardDescription>Your mock KYC has been processed.</CardDescription>
          </CardHeader>
          <CardContent>
            <Link href="/onboarding">
              <Button>Return to onboarding</Button>
            </Link>
          </CardContent>
        </Card>
      </Page>
    );
  }

  return (
    <Page className="flex min-h-[60vh] items-center justify-center">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Mock KYC verification</CardTitle>
          <CardDescription>Simulate the KYC provider flow. Choose an outcome.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          <div className="flex gap-2">
            <Button
              onClick={() => complete("APPROVED")}
              disabled={loading}
            >
              {loading ? "Processing…" : "Approve"}
            </Button>
            <Button
              variant="danger"
              onClick={() => complete("REJECTED")}
              disabled={loading}
            >
              Reject
            </Button>
          </div>
          {error && (
            <p className="text-sm text-destructive" role="alert">
              {error}
            </p>
          )}
        </CardContent>
      </Card>
    </Page>
  );
}

export default function MockKycPage() {
  return (
    <Suspense fallback={
      <Page className="flex min-h-[60vh] items-center justify-center">
        <p className="text-muted-foreground">Loading…</p>
      </Page>
    }>
      <MockKycContent />
    </Suspense>
  );
}
