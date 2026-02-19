"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ApiError } from "@zinovia/contracts";
import { Page } from "@/components/brand/Page";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/ui/toast";
import { apiFetch } from "@/lib/api/client";
import "@/lib/api";

const MIN_PASSWORD_LENGTH = 10;

const ERROR_MESSAGES: Record<string, string> = {
  wrong_current_password: "Current password is incorrect.",
  same_as_current: "New password must be different from the current one.",
};

function getPasswordStrength(pw: string): { label: string; color: string; percent: number } {
  let score = 0;
  if (pw.length >= 10) score++;
  if (pw.length >= 14) score++;
  if (/[A-Z]/.test(pw)) score++;
  if (/[a-z]/.test(pw)) score++;
  if (/[0-9]/.test(pw)) score++;
  if (/[^A-Za-z0-9]/.test(pw)) score++;

  if (score <= 2) return { label: "Weak", color: "bg-destructive", percent: 25 };
  if (score <= 3) return { label: "Fair", color: "bg-amber-500", percent: 50 };
  if (score <= 4) return { label: "Good", color: "bg-emerald-400", percent: 75 };
  return { label: "Strong", color: "bg-emerald-500", percent: 100 };
}

export default function SecuritySettingsPage() {
  const router = useRouter();
  const { addToast } = useToast();

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
      addToast("Password changed successfully.", "success");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        router.replace("/login?next=/settings/security");
        return;
      }
      let detail = "";
      if (err instanceof ApiError && err.body && typeof err.body === "object" && "detail" in err.body) {
        detail = String((err.body as { detail?: unknown }).detail);
      }
      const message = ERROR_MESSAGES[detail] || detail || "Failed to change password.";
      addToast(message, "error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Page className="space-y-4">
      <h1 className="font-display text-premium-h2 font-semibold text-foreground">Security</h1>
      <Card>
        <CardHeader>
          <CardTitle>Change password</CardTitle>
          <CardDescription>
            Enter your current password and choose a new one. Minimum {MIN_PASSWORD_LENGTH} characters.
            Use a mix of uppercase, lowercase, numbers, and symbols.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={onSubmit} className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="currentPassword">Current password</Label>
              <Input
                id="currentPassword"
                type="password"
                autoComplete="current-password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                placeholder="Enter current password"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="newPassword">New password</Label>
              <Input
                id="newPassword"
                type="password"
                autoComplete="new-password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="At least 10 characters"
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
                    Strength: <span className="font-medium">{strength.label}</span>
                  </p>
                </div>
              )}
              {passwordTooShort && (
                <p className="text-xs text-destructive">
                  Must be at least {MIN_PASSWORD_LENGTH} characters.
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Confirm new password</Label>
              <Input
                id="confirmPassword"
                type="password"
                autoComplete="new-password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Re-enter new password"
              />
              {mismatch && (
                <p className="text-xs text-destructive">Passwords do not match.</p>
              )}
            </div>
            <Button type="submit" disabled={!canSubmit}>
              {loading ? "Changing..." : "Change password"}
            </Button>
          </form>
        </CardContent>
      </Card>
      <div className="flex gap-2">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/settings/profile">Back to profile</Link>
        </Button>
      </div>
    </Page>
  );
}
