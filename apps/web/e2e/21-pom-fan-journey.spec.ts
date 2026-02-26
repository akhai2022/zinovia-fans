/**
 * STEP 21 — Fan signup + verification + login + feed (POM-driven UI flow).
 *
 * Validates:
 *   1. Signup via UI form
 *   2. Email verification via dev token endpoint (non-prod only)
 *   3. Login via UI
 *   4. Feed loads for authenticated fan
 *   5. Search works
 */

import { test, expect } from "@playwright/test";
import { SignupPage, LoginPage } from "./pages/auth.page";
import { FeedPage } from "./pages/feed.page";
import {
  uniqueEmail,
  apiFetch,
  getVerificationToken,
  collectJSErrors,
  IS_PROD,
} from "./helpers";

const PASSWORD = "E2eFanJourney1!";

test.describe("Fan Journey — Signup via UI", () => {
  const email = uniqueEmail("fj-signup");

  test("fan signup form submits successfully", async ({ page }) => {
    const signup = new SignupPage(page);
    await signup.goto();

    // Verify form elements are visible
    await expect(signup.emailInput).toBeVisible();
    await expect(signup.passwordInput).toBeVisible();
    await expect(signup.fanToggle).toBeVisible();

    await signup.selectFanType();
    await signup.fillForm("Journey Fan", email, PASSWORD);
    await signup.submit();

    // After submission, page may navigate away OR show a success/verification message
    try {
      await page.waitForURL(
        (url) => !url.pathname.includes("/signup"),
        { timeout: 15_000 },
      );
      expect(page.url()).not.toContain("/signup");
    } catch {
      // In production, signup may stay on the same page with a success message
      const body = await page.textContent("body");
      const hasSuccessIndicator =
        body?.toLowerCase().includes("verify") ||
        body?.toLowerCase().includes("check your email") ||
        body?.toLowerCase().includes("confirmation") ||
        body?.toLowerCase().includes("success");
      expect(hasSuccessIndicator).toBe(true);
    }
  });
});

test.describe("Fan Journey — Verification + Login + Feed", () => {
  const email = uniqueEmail("fj-login");
  let verified = false;

  test.beforeAll(async () => {
    if (IS_PROD) {
      // In production, dev/tokens endpoint is unavailable.
      // Use signupFan which does signup + login (login works even without
      // email verification for fans created via API in some configs).
      // But we can't guarantee verification — so we'll skip verification-dependent tests.
      await apiFetch("/auth/signup", {
        method: "POST",
        body: { email, password: PASSWORD, display_name: "Journey Fan 2" },
      });
      return;
    }
    // Non-prod: create fan and verify via dev endpoint
    await apiFetch("/auth/signup", {
      method: "POST",
      body: { email, password: PASSWORD, display_name: "Journey Fan 2" },
    });
    const token = await getVerificationToken(email);
    if (token) {
      const res = await apiFetch("/auth/verify-email", {
        method: "POST",
        body: { token },
        headers: { "Idempotency-Key": `e2e-verify-${Date.now()}` },
      });
      verified = res.ok;
    }
  });

  test("verification token is retrievable (non-prod only)", async () => {
    test.skip(IS_PROD, "Dev token endpoint disabled in production");
    expect(verified).toBe(true);
  });

  test("verify email via API succeeds (non-prod only)", async () => {
    test.skip(IS_PROD, "Dev token endpoint disabled in production");
    expect(verified).toBe(true);
  });

  test("login via UI and see feed", async ({ page }) => {
    test.skip(IS_PROD && !verified, "Cannot login without email verification in prod");
    const login = new LoginPage(page);
    await login.login(email, PASSWORD);
    await login.expectLoginSuccess();

    const feed = new FeedPage(page);
    await feed.goto();
    await feed.expectFeedLoaded();
    await feed.expectNoServerErrors();
  });

  test("search page accessible for logged-in fan", async ({ page }) => {
    test.skip(IS_PROD && !verified, "Cannot login without email verification in prod");
    const login = new LoginPage(page);
    await login.login(email, PASSWORD);

    await page.goto("/search");
    await page.waitForLoadState("networkidle");
    expect(page.url()).toContain("/search");
    const body = await page.textContent("body");
    expect(body).not.toContain("Internal Server Error");
  });

  test("no JS errors on feed page", async ({ page }) => {
    test.skip(IS_PROD && !verified, "Cannot login without email verification in prod");
    const errors = collectJSErrors(page);
    const login = new LoginPage(page);
    await login.login(email, PASSWORD);

    await page.goto("/feed");
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(2_000);
    expect(errors).toHaveLength(0);
  });
});
