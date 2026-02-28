"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Page } from "@/components/brand/Page";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { createKycSession, getOnboardingStatus } from "@/lib/onboardingApi";
import { getApiErrorMessage } from "@/lib/errors";
import { uuidClient } from "@/lib/uuid";
import { useTranslation } from "@/lib/i18n";
import { Icon } from "@/components/ui/icon";
import "@/lib/api";

type Step = {
  key: string;
  icon: string;
  label: string;
  description: string;
  done: boolean;
  current: boolean;
};

export default function OnboardingPage() {
  const router = useRouter();
  const { t } = useTranslation();
  const [status, setStatus] = useState<{ state: string; checklist: Record<string, boolean> } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingStatus, setLoadingStatus] = useState(true);

  useEffect(() => {
    getOnboardingStatus()
      .then((s) => {
        setStatus(s);
        // Auto-start KYC if email is verified but KYC not yet started
        if (
          s.checklist.email_verified &&
          !s.checklist.kyc_started &&
          !s.checklist.kyc_approved &&
          s.state !== "KYC_SUBMITTED" &&
          s.state !== "KYC_REJECTED"
        ) {
          setLoading(true);
          const idempotencyKey = uuidClient();
          createKycSession(idempotencyKey)
            .then((res) => {
              window.location.href = res.redirect_url;
            })
            .catch((err) => {
              setError(getApiErrorMessage(err).message);
              setLoading(false);
            });
        }
      })
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
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          <p className="text-sm text-muted-foreground">{t.onboarding.loading}</p>
        </div>
      </Page>
    );
  }

  if (!status) return null;

  const { state, checklist } = status;
  const allDone = checklist.kyc_approved;

  // Build step list
  const steps: Step[] = [
    {
      key: "email",
      icon: "mark_email_read",
      label: t.onboarding.checklistEmailVerified,
      description: "Your email has been verified.",
      done: checklist.email_verified,
      current: !checklist.email_verified,
    },
    {
      key: "kyc",
      icon: "verified_user",
      label: t.onboarding.checklistKycStarted,
      description: "Upload your ID and selfie for verification.",
      done: checklist.kyc_approved,
      current: checklist.email_verified && !checklist.kyc_approved,
    },
    {
      key: "profile",
      icon: "person",
      label: t.onboarding.setUpProfile,
      description: "Add your avatar, banner, and bio.",
      done: false, // We don't track profile completion in checklist
      current: checklist.kyc_approved,
    },
    {
      key: "post",
      icon: "edit_square",
      label: t.onboarding.createFirstPost,
      description: "Share your first content with fans.",
      done: false,
      current: false,
    },
  ];

  // Show KYC pending/submitted status
  const kycPending = state === "KYC_SUBMITTED";
  const kycRejected = state === "KYC_REJECTED";

  return (
    <Page className="flex min-h-[70vh] items-center justify-center hero-bg">
      <Card className="w-full max-w-lg border-border shadow-premium-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
            <Icon name={allDone ? "celebration" : "rocket_launch"} className="text-2xl text-primary" />
          </div>
          <CardTitle className="font-display text-premium-h3">
            {allDone ? t.onboarding.verificationCompleteMessage : t.onboarding.title}
          </CardTitle>
          <CardDescription>
            {allDone
              ? "You are ready to start creating. Set up your profile and post your first content."
              : t.onboarding.description}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          {/* Step indicators */}
          <div className="space-y-3">
            {steps.map((step, i) => (
              <div
                key={step.key}
                className={`flex items-start gap-3 rounded-lg border p-3 transition-colors ${
                  step.done
                    ? "border-emerald-500/30 bg-emerald-500/5"
                    : step.current
                      ? "border-primary/40 bg-primary/5"
                      : "border-border bg-card/50 opacity-50"
                }`}
              >
                {/* Step number/check */}
                <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-semibold ${
                  step.done
                    ? "bg-emerald-500/20 text-emerald-400"
                    : step.current
                      ? "bg-primary/20 text-primary"
                      : "bg-muted text-muted-foreground"
                }`}>
                  {step.done ? (
                    <Icon name="check" className="icon-sm" />
                  ) : (
                    <span>{i + 1}</span>
                  )}
                </div>
                {/* Step content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <Icon name={step.icon} className={`icon-sm ${step.done ? "text-emerald-400" : step.current ? "text-primary" : "text-muted-foreground"}`} />
                    <span className={`text-sm font-medium ${step.done ? "text-emerald-400 line-through" : "text-foreground"}`}>
                      {step.label}
                    </span>
                  </div>
                  <p className="mt-0.5 text-xs text-muted-foreground">{step.description}</p>
                </div>
              </div>
            ))}
          </div>

          {/* KYC submitted — waiting for review */}
          {kycPending && (
            <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-4 text-center">
              <Icon name="hourglass_top" className="mx-auto mb-1 text-2xl text-amber-400" />
              <p className="text-sm font-medium text-amber-400">Verification under review</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Your documents are being reviewed. This usually takes a few hours. You will be notified once approved.
              </p>
            </div>
          )}

          {/* KYC rejected — can retry */}
          {kycRejected && (
            <div className="rounded-lg border border-red-500/30 bg-red-500/5 p-4 text-center">
              <Icon name="error" className="mx-auto mb-1 text-2xl text-red-400" />
              <p className="text-sm font-medium text-red-400">Verification rejected</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Please retry with clearer documents. Make sure your ID is fully visible and your selfie is well-lit.
              </p>
            </div>
          )}

          {/* Action buttons */}
          {!allDone && checklist.email_verified && !kycPending && (
            <Button
              onClick={onStartVerification}
              disabled={loading}
              className="w-full"
              size="lg"
            >
              <Icon name="verified_user" className="mr-1.5 icon-sm" />
              {loading
                ? t.onboarding.redirecting
                : kycRejected
                  ? "Retry Verification"
                  : checklist.kyc_started
                    ? t.onboarding.resumeVerification
                    : t.onboarding.startVerification}
            </Button>
          )}

          {allDone && (
            <div className="flex flex-col gap-2 sm:flex-row">
              <Button
                onClick={() => router.push("/settings/profile")}
                className="flex-1"
                size="lg"
              >
                <Icon name="person" className="mr-1.5 icon-sm" />{t.onboarding.setUpProfile}
              </Button>
              <Button
                variant="secondary"
                onClick={() => router.push("/creator/post/new")}
                className="flex-1"
                size="lg"
              >
                <Icon name="edit_square" className="mr-1.5 icon-sm" />{t.onboarding.createFirstPost}
              </Button>
            </div>
          )}

          {error && (
            <p className="text-sm text-destructive text-center" role="alert">
              {error}
            </p>
          )}
        </CardContent>
      </Card>
    </Page>
  );
}
