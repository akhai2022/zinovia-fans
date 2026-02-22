"use client";

import { useState } from "react";
import Link from "next/link";
import { Page } from "@/components/brand/Page";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { apiFetch } from "@/lib/api/client";
import { getApiErrorMessage } from "@/lib/errors";
import { Icon } from "@/components/ui/icon";
import "@/lib/api";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await apiFetch("/auth/forgot-password", {
        method: "POST",
        body: { email },
      });
      setSent(true);
    } catch (err) {
      setError(getApiErrorMessage(err).message);
    } finally {
      setLoading(false);
    }
  };

  if (sent) {
    return (
      <Page className="flex min-h-[70vh] items-center justify-center hero-bg">
        <Card className="w-full max-w-md border-border shadow-premium-md">
          <CardHeader>
            <CardTitle className="font-display text-premium-h3">Check your email</CardTitle>
            <CardDescription>
              If an account exists with that email, we&apos;ve sent a password reset link. Check your inbox and spam folder.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button variant="secondary" className="w-full" asChild>
              <Link href="/login"><Icon name="arrow_back" className="mr-1.5 icon-sm" />Back to sign in</Link>
            </Button>
          </CardContent>
        </Card>
      </Page>
    );
  }

  return (
    <Page className="flex min-h-[70vh] items-center justify-center hero-bg">
      <Card className="w-full max-w-md border-border shadow-premium-md">
        <CardHeader>
          <CardTitle className="font-display text-premium-h3">Reset password</CardTitle>
          <CardDescription>
            Enter your email and we&apos;ll send you a link to reset your password.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form className="space-y-4" onSubmit={onSubmit}>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
              />
            </div>
            {error && (
              <p className="text-sm text-destructive" role="alert">{error}</p>
            )}
            <Button type="submit" className="w-full" disabled={loading}>
              <Icon name="send" className="mr-1.5 icon-sm" />{loading ? "Sending..." : "Send reset link"}
            </Button>
          </form>
          <p className="mt-4 text-center text-sm text-muted-foreground">
            <Link href="/login" className="text-primary underline-offset-4 hover:underline">
              Back to sign in
            </Link>
          </p>
        </CardContent>
      </Card>
    </Page>
  );
}
