"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Page } from "@/components/brand/Page";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/ui/toast";
import { ApiClientError, apiFetch } from "@/lib/api/client";
import { getApiErrorCode } from "@/lib/errors";
import { useTranslation, interpolate } from "@/lib/i18n";
import "@/lib/api";

const MIN_PASSWORD_LENGTH = 10;

const ERROR_CODE_KEYS: Record<string, "errorWrongCurrentPassword" | "errorSameAsCurrent"> = {
  wrong_current_password: "errorWrongCurrentPassword",
  same_as_current: "errorSameAsCurrent",
};

type StrengthKey = "strengthWeak" | "strengthFair" | "strengthGood" | "strengthStrong";

function getPasswordStrength(pw: string): { key: StrengthKey; color: string; percent: number } {
  let score = 0;
  if (pw.length >= 10) score++;
  if (pw.length >= 14) score++;
  if (/[A-Z]/.test(pw)) score++;
  if (/[a-z]/.test(pw)) score++;
  if (/[0-9]/.test(pw)) score++;
  if (/[^A-Za-z0-9]/.test(pw)) score++;

  if (score <= 2) return { key: "strengthWeak", color: "bg-destructive", percent: 25 };
  if (score <= 3) return { key: "strengthFair", color: "bg-amber-500", percent: 50 };
  if (score <= 4) return { key: "strengthGood", color: "bg-emerald-400", percent: 75 };
  return { key: "strengthStrong", color: "bg-emerald-500", percent: 100 };
}

export default function SecuritySettingsPage() {
  const router = useRouter();
  const { addToast } = useToast();
  const { t } = useTranslation();

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const strength = getPasswordStrength(newPassword);
  const passwordTooShort = newPassword.length > 0 && newPassword.length < MIN_PASSWORD_LENGTH;
  const mismatch = confirmPassword.length > 0 && newPassword !== confirmPassword;
  const canSubmit =
    currentPassword.length > 0 &&
    newPassword.length >= MIN_PASSWORD_LENGTH &&
    newPassword === confirmPassword &&
    !loading;

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    setLoading(true);
    try {
      await apiFetch("/auth/change-password", {
        method: "POST",
        body: { current_password: currentPassword, new_password: newPassword },
      });
      addToast(t.security.toastPasswordChanged, "success");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err) {
      if (err instanceof ApiClientError && err.status === 401) {
        router.replace("/login?next=/settings/security");
        return;
      }
      const code = getApiErrorCode(err);
      const key = ERROR_CODE_KEYS[code];
      const message = key ? t.security[key] : t.security.errorFailedToChange;
      addToast(message, "error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Page className="space-y-4">
      <h1 className="font-display text-premium-h2 font-semibold text-foreground">{t.security.title}</h1>
      <Card>
        <CardHeader>
          <CardTitle>{t.security.changePasswordTitle}</CardTitle>
          <CardDescription>
            {interpolate(t.security.changePasswordDescription, { minLength: String(MIN_PASSWORD_LENGTH) })}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={onSubmit} className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="currentPassword">{t.security.currentPasswordLabel}</Label>
              <Input
                id="currentPassword"
                type="password"
                autoComplete="current-password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                placeholder={t.security.currentPasswordPlaceholder}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="newPassword">{t.security.newPasswordLabel}</Label>
              <Input
                id="newPassword"
                type="password"
                autoComplete="new-password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder={t.security.newPasswordPlaceholder}
              />
              {newPassword.length > 0 && (
                <div className="space-y-1">
                  <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${strength.color}`}
                      style={{ width: `${strength.percent}%` }}
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {t.security.strengthLabel} <span className="font-medium">{t.security[strength.key]}</span>
                  </p>
                </div>
              )}
              {passwordTooShort && (
                <p className="text-xs text-destructive">
                  {interpolate(t.security.passwordMinLengthError, { minLength: String(MIN_PASSWORD_LENGTH) })}
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirmPassword">{t.security.confirmPasswordLabel}</Label>
              <Input
                id="confirmPassword"
                type="password"
                autoComplete="new-password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder={t.security.confirmPasswordPlaceholder}
              />
              {mismatch && (
                <p className="text-xs text-destructive">{t.security.passwordsDoNotMatch}</p>
              )}
            </div>
            <Button type="submit" disabled={!canSubmit}>
              {loading ? t.security.submitChanging : t.security.submitChangePassword}
            </Button>
          </form>
        </CardContent>
      </Card>
      <div className="flex gap-2">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/settings/profile">{t.security.backToProfile}</Link>
        </Button>
      </div>
    </Page>
  );
}
