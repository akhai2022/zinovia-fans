"use client";

import { useState } from "react";
import Link from "next/link";
import { z } from "zod";
import { Page } from "@/components/brand/Page";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { apiFetch } from "@/lib/api/client";
import { registerCreator } from "@/lib/onboardingApi";
import { getApiErrorMessage } from "@/lib/errors";
import { uuidClient } from "@/lib/uuid";
import "@/lib/api";

type AccountType = "fan" | "creator";

const schema = z.object({
  email: z.string().email("Invalid email"),
  password: z.string().min(10, "Password must be at least 10 characters"),
  displayName: z.string().min(1, "Display name is required"),
});

export default function SignupPage() {
  const [accountType, setAccountType] = useState<AccountType>("fan");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const parsed = schema.safeParse({ email, password, displayName });
    if (!parsed.success) {
      setError(parsed.error.errors.map((err) => err.message).join("; "));
      return;
    }
    setLoading(true);
    try {
      if (accountType === "creator") {
        const idempotencyKey = uuidClient();
        const res = await registerCreator(email, password, idempotencyKey);
        sessionStorage.setItem("onboarding_creator_id", res.creator_id);
        const deliveryFailed = res.email_delivery_status === "failed";
        window.location.href = deliveryFailed
          ? "/verify-email?delivery=failed"
          : "/verify-email";
      } else {
        // Fan signup: create account and redirect to email verification
        const res = await apiFetch<{ user_id: string; email_delivery_status: string }>("/auth/signup", {
          method: "POST",
          body: { email, password, display_name: displayName },
        });
        const deliveryFailed = res.email_delivery_status === "failed";
        window.location.href = deliveryFailed
          ? "/verify-email?delivery=failed"
          : "/verify-email";
      }
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
          <CardTitle className="font-display text-premium-h3">
            Create your account
          </CardTitle>
          <CardDescription>
            Join Zinovia as a fan or creator.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {/* Account type selector */}
          <div className="mb-6 flex gap-2 rounded-xl border border-border bg-muted/50 p-1">
            <button
              type="button"
              data-testid="signup-type-fan"
              onClick={() => setAccountType("fan")}
              className={`flex-1 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                accountType === "fan"
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Fan
            </button>
            <button
              type="button"
              data-testid="signup-type-creator"
              onClick={() => setAccountType("creator")}
              className={`flex-1 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                accountType === "creator"
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Creator
            </button>
          </div>

          <p className="mb-4 text-xs text-muted-foreground">
            {accountType === "fan"
              ? "Follow creators, subscribe to exclusive content, and support your favorites."
              : "Share your content, build your audience, and earn from subscriptions."}
          </p>

          <form className="space-y-4" onSubmit={onSubmit}>
            <div className="space-y-2">
              <Label htmlFor="displayName">Display name</Label>
              <Input
                id="displayName"
                type="text"
                placeholder="Your name"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                required
                autoComplete="name"
              />
            </div>
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
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={10}
                autoComplete="new-password"
              />
              <p className="text-xs text-muted-foreground">
                At least 10 characters
              </p>
            </div>
            {error && (
              <p className="text-sm text-destructive" role="alert">
                {error}
              </p>
            )}
            <Button type="submit" className="w-full" disabled={loading}>
              {loading
                ? "Creating…"
                : accountType === "creator"
                  ? "Create creator account"
                  : "Create account"}
            </Button>
          </form>
          <p className="mt-4 text-center text-sm text-muted-foreground">
            Already have an account?{" "}
            <Link
              href="/login"
              className="text-primary underline-offset-4 hover:underline"
            >
              Sign in
            </Link>
          </p>
        </CardContent>
      </Card>
    </Page>
  );
}
