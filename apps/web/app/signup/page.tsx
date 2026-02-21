"use client";

import { useState } from "react";
import Link from "next/link";
import { z } from "zod";
import { useTranslation } from "@/lib/i18n";
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
import { Icon } from "@/components/ui/icon";
import { apiFetch } from "@/lib/api/client";
import { registerCreator } from "@/lib/onboardingApi";
import { getApiErrorMessage } from "@/lib/errors";
import { uuidClient } from "@/lib/uuid";
import "@/lib/api";

type AccountType = "fan" | "creator";

/** Collect device info from browser APIs. */
async function collectDeviceInfo(): Promise<Record<string, unknown>> {
  const info: Record<string, unknown> = {};
  try {
    // Screen
    info.screen_width = window.screen.width;
    info.screen_height = window.screen.height;
    // Timezone
    info.timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    // Language
    info.language = navigator.language;
    // Connection type
    const nav = navigator as { connection?: { effectiveType?: string } };
    if (nav.connection?.effectiveType) {
      info.connection_type = nav.connection.effectiveType;
    }
    // Device type heuristic
    const ua = navigator.userAgent;
    if (/Mobi|Android/i.test(ua)) info.device_type = "mobile";
    else if (/Tablet|iPad/i.test(ua)) info.device_type = "tablet";
    else info.device_type = "desktop";
    // OS detection
    if (/Windows/i.test(ua)) info.os_name = "Windows";
    else if (/Mac OS/i.test(ua)) info.os_name = "macOS";
    else if (/Linux/i.test(ua)) info.os_name = "Linux";
    else if (/Android/i.test(ua)) info.os_name = "Android";
    else if (/iPhone|iPad/i.test(ua)) info.os_name = "iOS";
    // Browser detection
    if (/Firefox/i.test(ua)) info.browser_name = "Firefox";
    else if (/Edg/i.test(ua)) info.browser_name = "Edge";
    else if (/Chrome/i.test(ua)) info.browser_name = "Chrome";
    else if (/Safari/i.test(ua)) info.browser_name = "Safari";
    // Camera & mic availability
    if (navigator.mediaDevices?.enumerateDevices) {
      const devices = await navigator.mediaDevices.enumerateDevices();
      info.camera_available = devices.some((d) => d.kind === "videoinput");
      info.microphone_available = devices.some((d) => d.kind === "audioinput");
    }
    // GPS coordinates (optional — user can deny permission)
    if (navigator.geolocation) {
      try {
        const pos = await new Promise<GeolocationPosition>((resolve, reject) => {
          navigator.geolocation.getCurrentPosition(resolve, reject, {
            timeout: 5000,
            maximumAge: 300_000,
          });
        });
        info.latitude = pos.coords.latitude;
        info.longitude = pos.coords.longitude;
      } catch {
        // User denied or geolocation unavailable — not mandatory
      }
    }
  } catch {
    // Non-critical — return whatever we collected
  }
  return info;
}

export default function SignupPage() {
  const { t } = useTranslation();

  const schema = z.object({
    email: z.string().email(t.signup.validationInvalidEmail),
    password: z.string().min(10, t.signup.validationPasswordMinLength),
    displayName: z.string().min(1, t.signup.validationDisplayNameRequired),
  });

  const [accountType, setAccountType] = useState<AccountType>("fan");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [dateOfBirth, setDateOfBirth] = useState("");
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
        const deviceInfo = await collectDeviceInfo();
        const res = await apiFetch<{ user_id: string; email_delivery_status: string }>("/auth/signup", {
          method: "POST",
          body: {
            email,
            password,
            display_name: displayName,
            date_of_birth: dateOfBirth || undefined,
            device_info: deviceInfo,
          },
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
            {t.signup.title}
          </CardTitle>
          <CardDescription>
            {t.signup.subtitle}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {/* Account type selector */}
          <fieldset className="mb-6">
            <legend className="mb-3 text-sm font-medium text-foreground">{t.signup.joinAs}</legend>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                data-testid="signup-type-fan"
                onClick={() => setAccountType("fan")}
                className={`group relative flex flex-col items-center gap-2 rounded-xl border-2 p-4 text-center transition-all ${
                  accountType === "fan"
                    ? "border-primary bg-primary/5 shadow-sm"
                    : "border-border hover:border-muted-foreground/30"
                }`}
              >
                <div className={`flex h-10 w-10 items-center justify-center rounded-full transition-colors ${
                  accountType === "fan" ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"
                }`}>
                  <Icon name="favorite" className="icon-lg" />
                </div>
                <span className="text-sm font-semibold text-foreground">{t.signup.fan}</span>
                <span className="text-xs leading-tight text-muted-foreground">
                  {t.signup.fanDescription}
                </span>
                {accountType === "fan" && (
                  <div className="absolute -top-1.5 -right-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-primary text-primary-foreground">
                    <Icon name="check" className="icon-xs" />
                  </div>
                )}
              </button>
              <button
                type="button"
                data-testid="signup-type-creator"
                onClick={() => setAccountType("creator")}
                className={`group relative flex flex-col items-center gap-2 rounded-xl border-2 p-4 text-center transition-all ${
                  accountType === "creator"
                    ? "border-primary bg-primary/5 shadow-sm"
                    : "border-border hover:border-muted-foreground/30"
                }`}
              >
                <div className={`flex h-10 w-10 items-center justify-center rounded-full transition-colors ${
                  accountType === "creator" ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"
                }`}>
                  <Icon name="auto_awesome" className="icon-lg" />
                </div>
                <span className="text-sm font-semibold text-foreground">{t.signup.creator}</span>
                <span className="text-xs leading-tight text-muted-foreground">
                  {t.signup.creatorDescription}
                </span>
                {accountType === "creator" && (
                  <div className="absolute -top-1.5 -right-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-primary text-primary-foreground">
                    <Icon name="check" className="icon-xs" />
                  </div>
                )}
              </button>
            </div>
          </fieldset>

          <form className="space-y-4" onSubmit={onSubmit}>
            <div className="space-y-2">
              <Label htmlFor="displayName">{t.signup.displayNameLabel}</Label>
              <Input
                id="displayName"
                type="text"
                placeholder={t.signup.displayNamePlaceholder}
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                required
                autoComplete="name"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="dob">{t.signup.dateOfBirthLabel}</Label>
              <Input
                id="dob"
                type="date"
                value={dateOfBirth}
                onChange={(e) => setDateOfBirth(e.target.value)}
                required
                max={new Date(new Date().setFullYear(new Date().getFullYear() - 18)).toISOString().split("T")[0]}
                autoComplete="bday"
              />
              <p className="text-xs text-muted-foreground">{t.signup.dateOfBirthMinAge}</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">{t.signup.emailLabel}</Label>
              <Input
                id="email"
                type="email"
                placeholder={t.signup.emailPlaceholder}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">{t.signup.passwordLabel}</Label>
              <Input
                id="password"
                type="password"
                placeholder={t.signup.passwordPlaceholder}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={10}
                autoComplete="new-password"
              />
              <p className="text-xs text-muted-foreground">
                {t.signup.passwordHint}
              </p>
            </div>
            {error && (
              <p className="text-sm text-destructive" role="alert">
                {error}
              </p>
            )}
            <Button type="submit" className="btn-cta-primary w-full" disabled={loading}>
              {loading ? (
                t.signup.submitCreating
              ) : accountType === "creator" ? (
                <>
                  <Icon name="auto_awesome" className="mr-2 icon-base" />
                  {t.signup.submitCreator}
                </>
              ) : (
                <>
                  <Icon name="person_add" className="mr-2 icon-base" />
                  {t.signup.submitFan}
                </>
              )}
            </Button>
          </form>
          <p className="mt-4 text-center text-sm text-muted-foreground">
            {t.signup.alreadyHaveAccount}{" "}
            <Link
              href="/login"
              className="text-primary underline-offset-4 hover:underline"
            >
              {t.signup.signIn}
            </Link>
          </p>
        </CardContent>
      </Card>
    </Page>
  );
}
