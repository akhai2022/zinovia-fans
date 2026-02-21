"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Page } from "@/components/brand/Page";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { createKycSession, getOnboardingStatus } from "@/lib/onboardingApi";
import { getApiErrorMessage } from "@/lib/errors";
import { uuidClient } from "@/lib/uuid";
import { useTranslation, interpolate } from "@/lib/i18n";
import "@/lib/api";

export default function OnboardingPage() {
  const router = useRouter();
  const { t } = useTranslation();
  const [status, setStatus] = useState<{ state: string; checklist: Record<string, boolean> } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingStatus, setLoadingStatus] = useState(true);

  useEffect(() => {
    getOnboardingStatus()
      .then(setStatus)
      .catch(() => router.replace("/login?next=/onboarding"))
      .finally(() => setLoadingStatus(false));
  }, [router]);

  const onStartVerification = async () => {
    setError(null);
    setLoading(true);
    try {
      const idempotencyKey = uuidClient();
      const res = await createKycSession(idempotencyKey);
      window.location.href = res.redirect_url;
    } catch (err) {
      setError(getApiErrorMessage(err).message);
      setLoading(false);
    }
  };

  if (loadingStatus) {
    return (
      <Page className="flex min-h-[60vh] items-center justify-center">
        <p className="text-muted-foreground">{t.onboarding.loading}</p>
      </Page>
    );
  }

  if (!status) return null;

  const { state, checklist } = status;
  const allDone = checklist.kyc_approved;

  return (
    <Page className="flex min-h-[70vh] items-center justify-center hero-bg">
      <Card className="w-full max-w-md border-border shadow-premium-md">
        <CardHeader>
          <CardTitle className="font-display text-premium-h3">{t.onboarding.title}</CardTitle>
          <CardDescription>{t.onboarding.description}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <p className="text-sm font-medium">{interpolate(t.onboarding.statusLabel, { state })}</p>
            <ul className="space-y-1 text-sm">
              <li className={checklist.email_verified ? "text-muted-foreground line-through" : ""}>
                {checklist.email_verified ? "✓" : "○"} {t.onboarding.checklistEmailVerified}
              </li>
              <li className={checklist.kyc_started ? "text-muted-foreground line-through" : ""}>
                {checklist.kyc_started ? "✓" : "○"} {t.onboarding.checklistKycStarted}
              </li>
              <li className={checklist.kyc_approved ? "text-muted-foreground line-through" : ""}>
                {checklist.kyc_approved ? "✓" : "○"} {t.onboarding.checklistKycApproved}
              </li>
            </ul>
          </div>
          {!allDone && (
            <Button
              onClick={onStartVerification}
              disabled={loading || !checklist.email_verified}
            >
              {loading ? t.onboarding.redirecting : checklist.kyc_started ? t.onboarding.resumeVerification : t.onboarding.startVerification}
            </Button>
          )}
          {allDone && (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                {t.onboarding.verificationCompleteMessage}
              </p>
              <div className="flex flex-col gap-2 sm:flex-row">
                <Button
                  onClick={() => router.push("/settings/profile")}
                >
                  {t.onboarding.setUpProfile}
                </Button>
                <Button
                  variant="secondary"
                  onClick={() => router.push("/creator/post/new")}
                >
                  {t.onboarding.createFirstPost}
                </Button>
              </div>
            </div>
          )}
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
