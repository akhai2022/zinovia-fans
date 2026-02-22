"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { z } from "zod";
import { Page } from "@/components/brand/Page";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Icon } from "@/components/ui/icon";
import { resendVerificationEmail, verifyEmail } from "@/lib/onboardingApi";
import { getApiErrorMessage } from "@/lib/errors";
import { uuidClient } from "@/lib/uuid";
import "@/lib/api";

const schema = z.object({ token: z.string().min(1, "Token is required") });

export default function VerifyEmailPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [token, setToken] = useState("");
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [resendLoading, setResendLoading] = useState(false);
  const [resendStatus, setResendStatus] = useState<string | null>(null);

  const [autoVerifying, setAutoVerifying] = useState(false);

  useEffect(() => {
    const fromQuery = searchParams.get("token");
    if (fromQuery) {
      setToken(fromQuery);
      // Auto-verify when token comes from URL (email link click)
      setAutoVerifying(true);
      setLoading(true);
      const idempotencyKey = uuidClient();
      verifyEmail(fromQuery, idempotencyKey)
        .then((res) => {
          // API sets session cookie — redirect directly, no login needed
          const next = res.role === "creator" ? "/onboarding" : "/feed";
          window.location.href = next;
        })
        .catch((err) => {
          setError(getApiErrorMessage(err).message);
          setAutoVerifying(false);
          setLoading(false);
        });
    }
  }, [searchParams, router]);

  const onResend = async () => {
    setError(null);
    setResendStatus(null);
    const parsed = z.string().email("Valid email is required").safeParse(email);
    if (!parsed.success) {
      setError(parsed.error.errors.map((e) => e.message).join("; "));
      return;
    }
    setResendLoading(true);
    try {
      const idempotencyKey = uuidClient();
      const res = await resendVerificationEmail(email, idempotencyKey);
      if (res.email_delivery_status === "failed") {
        setResendStatus("Delivery failed. Please contact support.");
        return;
      }
      setResendStatus("Verification email sent. Check your inbox.");
    } catch (err) {
      setError(getApiErrorMessage(err).message);
    } finally {
      setResendLoading(false);
    }
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const parsed = schema.safeParse({ token });
    if (!parsed.success) {
      setError(parsed.error.errors.map((e) => e.message).join("; "));
      return;
    }
    setLoading(true);
    try {
      const idempotencyKey = uuidClient();
      const res = await verifyEmail(token, idempotencyKey);
      // API sets session cookie — redirect directly, no login needed
      const next = res.role === "creator" ? "/onboarding" : "/feed";
      window.location.href = next;
    } catch (err) {
      setError(getApiErrorMessage(err).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Page className="flex min-h-[70vh] items-center justify-center hero-bg">
      <Card className="w-full max-w-md border-border shadow-premium-md">
        <CardHeader>
          <CardTitle className="font-display text-premium-h3">Verify your email</CardTitle>
          <CardDescription>
            We sent you a verification link. If you have a token, you can paste it below.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {autoVerifying && (
            <div className="flex flex-col items-center gap-3 py-6">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
              <p className="text-sm text-muted-foreground">Verifying your email...</p>
            </div>
          )}
          {searchParams.get("delivery") === "failed" && !autoVerifying && (
            <p className="mb-3 text-sm text-warning">
              Your account was created, but verification email delivery failed. You can try resending below.
            </p>
          )}
          {!autoVerifying && (
            <>
              <div className="mb-6 space-y-3 rounded-brand border border-border bg-surface-alt p-4">
                <div className="space-y-2">
                  <Label htmlFor="email">Email for resend</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="you@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </div>
                <Button type="button" variant="secondary" className="w-full" onClick={onResend} disabled={resendLoading}>
                  <Icon name="send" className="mr-1.5 icon-sm" />{resendLoading ? "Sending…" : "Resend verification email"}
                </Button>
                {resendStatus && <p className="text-sm text-muted-foreground">{resendStatus}</p>}
              </div>
              <form className="space-y-4" onSubmit={onSubmit}>
                <div className="space-y-2">
                  <Label htmlFor="token">Verification token</Label>
                  <Input
                    id="token"
                    type="text"
                    placeholder="Paste your token"
                    value={token}
                    onChange={(e) => setToken(e.target.value)}
                    required
                  />
                </div>
                {error && (
                  <p className="text-sm text-destructive" role="alert">
                    {error}
                  </p>
                )}
                <Button type="submit" className="w-full" disabled={loading}>
                  <Icon name="verified" className="mr-1.5 icon-sm" />{loading ? "Verifying…" : "Verify email"}
                </Button>
              </form>
              <p className="mt-4 text-center text-sm text-muted-foreground">
                After verification, you will be signed in automatically.
              </p>
            </>
          )}
        </CardContent>
      </Card>
    </Page>
  );
}
