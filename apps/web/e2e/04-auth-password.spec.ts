/**
 * STEP 04 — Password reset & change workflows.
 */

import { test, expect } from "@playwright/test";
import {
  uniqueEmail,
  apiFetch,
  getResetToken,
  extractCookies,
} from "./helpers";

const PASSWORD = "E2ePassOld123!";
const NEW_PASSWORD = "E2ePassNew456!";

test.describe("Forgot Password & Reset", () => {
  const email = uniqueEmail("pwreset");

  test.beforeAll(async () => {
    await apiFetch("/auth/signup", {
      method: "POST",
      body: { email, password: PASSWORD, display_name: "PW Reset User" },
    });
  });

  test("forgot-password returns 200 (no user enumeration)", async () => {
    const res = await apiFetch("/auth/forgot-password", {
      method: "POST",
      body: { email },
    });
    expect(res.ok).toBe(true);
    expect(res.body.status).toBe("ok");
  });

  test("forgot-password for unknown email also returns 200", async () => {
    const res = await apiFetch("/auth/forgot-password", {
      method: "POST",
      body: { email: "nonexistent@test.zinovia.ai" },
    });
    expect(res.ok).toBe(true);
  });

  test("reset token is available via dev endpoint", async () => {
    const token = await getResetToken(email);
    expect(token).toBeTruthy();
  });

  test("reset-password with valid token succeeds", async () => {
    const token = await getResetToken(email);
    expect(token).toBeTruthy();

    const res = await apiFetch("/auth/reset-password", {
      method: "POST",
      body: { token, new_password: NEW_PASSWORD },
    });
    expect(res.ok).toBe(true);
  });

  test("login with new password works", async () => {
    const res = await apiFetch("/auth/login", {
      method: "POST",
      body: { email, password: NEW_PASSWORD },
    });
    expect(res.ok).toBe(true);
  });

  test("login with old password fails", async () => {
    const res = await apiFetch("/auth/login", {
      method: "POST",
      body: { email, password: PASSWORD },
    });
    expect(res.status).toBe(401);
  });
});

test.describe("Change Password (authenticated)", () => {
  const email = uniqueEmail("pwchange");

  test.beforeAll(async () => {
    await apiFetch("/auth/signup", {
      method: "POST",
      body: { email, password: PASSWORD, display_name: "PW Change User" },
    });
  });

  test("change password with correct current password succeeds", async () => {
    const login = await apiFetch("/auth/login", {
      method: "POST",
      body: { email, password: PASSWORD },
    });
    const cookies = extractCookies(login.headers.get("set-cookie") ?? "");
    const csrf = cookies.match(/csrf_token=([^;]+)/)?.[1] ?? "";

    const res = await apiFetch("/auth/change-password", {
      method: "POST",
      body: { current_password: PASSWORD, new_password: NEW_PASSWORD },
      cookies,
      headers: { "X-CSRF-Token": csrf },
    });
    expect(res.ok).toBe(true);
  });

  test("change password with wrong current password fails", async () => {
    const login = await apiFetch("/auth/login", {
      method: "POST",
      body: { email, password: NEW_PASSWORD },
    });
    const cookies = extractCookies(login.headers.get("set-cookie") ?? "");
    const csrf = cookies.match(/csrf_token=([^;]+)/)?.[1] ?? "";

    const res = await apiFetch("/auth/change-password", {
      method: "POST",
      body: { current_password: "WrongCurrent123!", new_password: "Another12345!" },
      cookies,
      headers: { "X-CSRF-Token": csrf },
    });
    expect(res.ok).toBe(false);
    expect([400, 401, 403]).toContain(res.status);
  });
});

test.describe("Reset Password — Negative Cases", () => {
  test("reset with invalid token fails", async () => {
    const res = await apiFetch("/auth/reset-password", {
      method: "POST",
      body: { token: "invalid-token-12345", new_password: NEW_PASSWORD },
    });
    expect(res.ok).toBe(false);
    expect([400, 404]).toContain(res.status);
  });

  test("reset with short password returns 422", async () => {
    const res = await apiFetch("/auth/reset-password", {
      method: "POST",
      body: { token: "any-token", new_password: "ab" },
    });
    expect(res.status).toBe(422);
  });
});
