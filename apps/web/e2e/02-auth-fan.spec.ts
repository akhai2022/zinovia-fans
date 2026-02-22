/**
 * STEP 02 — Fan auth: signup, email verification, login, logout.
 */

import { test, expect } from "@playwright/test";
import {
  uniqueEmail,
  apiFetch,
  getVerificationToken,
  extractCookies,
} from "./helpers";

const PASSWORD = "E2eTestPass123!";

test.describe("Fan Signup & Verification", () => {
  const email = uniqueEmail("fan");

  test("fan signup via API returns 201 + sends verification email @smoke", { tag: "@smoke" }, async () => {
    const res = await apiFetch("/auth/signup", {
      method: "POST",
      body: { email, password: PASSWORD, display_name: "E2E Fan" },
    });
    expect([200, 201]).toContain(res.status);
    expect(res.body).toHaveProperty("user_id");
    expect(res.body).toHaveProperty("email_delivery_status");
  });

  test("verification token retrievable via dev endpoint", async () => {
    const token = await getVerificationToken(email);
    expect(token).toBeTruthy();
  });

  test("verify email via API sets session cookie", async () => {
    const token = await getVerificationToken(email);
    expect(token).toBeTruthy();

    const idempotencyKey = `e2e-verify-${Date.now()}`;
    const res = await apiFetch("/auth/verify-email", {
      method: "POST",
      body: { token },
      headers: { "Idempotency-Key": idempotencyKey },
    });
    expect(res.ok).toBe(true);
    const setCookie = res.headers.get("set-cookie") ?? "";
    expect(setCookie).toContain("access_token");
  });

  test("login after verification succeeds @smoke", { tag: "@smoke" }, async () => {
    const res = await apiFetch("/auth/login", {
      method: "POST",
      body: { email, password: PASSWORD },
    });
    expect(res.ok).toBe(true);
    const setCookie = res.headers.get("set-cookie") ?? "";
    expect(setCookie).toContain("access_token");
    expect(setCookie).toContain("csrf_token");
  });

  test("/auth/me returns user data with cookies", async () => {
    const login = await apiFetch("/auth/login", {
      method: "POST",
      body: { email, password: PASSWORD },
    });
    const cookies = extractCookies(login.headers.get("set-cookie") ?? "");

    const me = await apiFetch("/auth/me", { cookies });
    expect(me.ok).toBe(true);
    expect(me.body.email).toBe(email);
    expect(me.body.role).toBe("fan");
    expect(me.body).toHaveProperty("last_login_at");
  });
});

test.describe("Fan Login via UI", () => {
  const email = uniqueEmail("fanui");

  test.beforeAll(async () => {
    await apiFetch("/auth/signup", {
      method: "POST",
      body: { email, password: PASSWORD, display_name: "E2E Fan UI" },
    });
  });

  test("login form submits and redirects away from /login", async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel("Email").fill(email);
    await page.getByLabel("Password").fill(PASSWORD);
    await page.getByRole("button", { name: /sign in/i }).click();
    await page.waitForURL((url) => !url.pathname.includes("/login"), {
      timeout: 15000,
    });
    expect(page.url()).not.toContain("/login");
  });
});

test.describe("Fan Auth — Negative Cases", () => {
  test("wrong password returns 401", async () => {
    const res = await apiFetch("/auth/login", {
      method: "POST",
      body: { email: "nobody@test.zinovia.ai", password: "WrongPass999!" },
    });
    expect(res.status).toBe(401);
  });

  test("signup with short password returns 422", async () => {
    const res = await apiFetch("/auth/signup", {
      method: "POST",
      body: { email: uniqueEmail("short"), password: "ab", display_name: "X" },
    });
    expect(res.status).toBe(422);
  });

  test("duplicate email returns 409", async () => {
    const email = uniqueEmail("dup");
    await apiFetch("/auth/signup", {
      method: "POST",
      body: { email, password: PASSWORD, display_name: "Dup1" },
    });
    const res = await apiFetch("/auth/signup", {
      method: "POST",
      body: { email, password: PASSWORD, display_name: "Dup2" },
    });
    expect([400, 409]).toContain(res.status);
  });

  test("unauthenticated /auth/me returns 401 @smoke", { tag: "@smoke" }, async () => {
    const res = await apiFetch("/auth/me");
    expect(res.status).toBe(401);
  });
});
