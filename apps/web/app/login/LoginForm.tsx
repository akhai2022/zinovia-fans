"use client";

import { useState } from "react";
import Link from "next/link";
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
import { getApiErrorMessage } from "@/lib/errors";
import { useTranslation } from "@/lib/i18n";
import "@/lib/api";

interface LoginFormProps {
  /** Safe redirect target after login (validated server-side). */
  next: string;
  /** True when the server-side session check failed (API down). */
  sessionUnavailable?: boolean;
}

export function LoginForm({ next, sessionUnavailable }: LoginFormProps) {
  const { t } = useTranslation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const onSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await apiFetch("/auth/login", {
        method: "POST",
        body: { email, password },
      });
      // Full navigation avoids Next.js router state issues after login.
      window.location.href = next;
      return;
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
            {t.login.title}
          </CardTitle>
          <CardDescription>
            {t.login.description}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {sessionUnavailable && (
            <div className="mb-4 rounded-brand border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-200">
              {t.login.sessionUnavailableWarning}
            </div>
          )}
          <form className="space-y-4" onSubmit={onSubmit}>
            <div className="space-y-2">
              <Label htmlFor="email">{t.login.emailLabel}</Label>
              <Input
                id="email"
                type="email"
                placeholder={t.login.emailPlaceholder}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">{t.login.passwordLabel}</Label>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="current-password"
              />
            </div>
            {error && (
              <p className="text-sm text-destructive" role="alert">
                {error}
              </p>
            )}
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? t.login.submitLoading : t.login.submit}
            </Button>
          </form>
          <p className="mt-4 text-center text-sm text-muted-foreground">
            {t.login.noAccountPrompt}{" "}
            <Link
              href="/signup"
              className="text-primary underline-offset-4 hover:underline"
            >
              {t.login.signUpLink}
            </Link>
          </p>
          <p className="mt-2 text-center text-sm text-muted-foreground">
            <Link
              href="/forgot-password"
              className="text-primary underline-offset-4 hover:underline"
            >
              {t.login.forgotPasswordLink}
            </Link>
          </p>
        </CardContent>
      </Card>
    </Page>
  );
}
