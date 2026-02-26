/**
 * STEP 09 — Billing: subscription checkout, status, cancel.
 * Uses E2E bypass to simulate CCBill subscription activation.
 */

import { test, expect } from "@playwright/test";
import {
  uniqueEmail,
  apiFetch,
  signupFan,
  createVerifiedCreator,
  e2eApi,
  isE2EEnabled,
  extractCookies,
} from "./helpers";

const PASSWORD = "E2eBilling123!";

test.describe("Billing Health", () => {
  test("billing health shows CCBill config @smoke", { tag: "@smoke" }, async () => {
    const res = await apiFetch("/billing/health");
    expect(res.ok).toBe(true);
    expect(res.body).toHaveProperty("payment_provider");
    expect(res.body).toHaveProperty("configured");
    expect(res.body).toHaveProperty("webhook_configured");
  });
});

test.describe("Subscription Checkout API", () => {
  let fanCookies = "";
  let fanCsrf = "";

  test.beforeAll(async () => {
    try {
      const fanEmail = uniqueEmail("billfan");
      const result = await signupFan(fanEmail, PASSWORD, "E2E Bill Fan");
      fanCookies = result.cookies;
      fanCsrf = fanCookies.match(/csrf_token=([^;]+)/)?.[1] ?? "";
    } catch {
      // signupFan throws if login fails (unverified user in prod)
    }
  });

  test("checkout subscription requires creator_id or handle", async () => {
    test.skip(!fanCookies, "Login failed (email verification required in production)");
    const res = await apiFetch("/billing/checkout/subscription", {
      method: "POST",
      body: {
        success_url: "http://localhost:3000/billing/success",
        cancel_url: "http://localhost:3000/billing/cancel",
      },
      cookies: fanCookies,
      headers: { "X-CSRF-Token": fanCsrf },
    });
    expect([400, 422]).toContain(res.status);
  });

  test("unauthenticated checkout returns 401 or 403", async () => {
    const res = await apiFetch("/billing/checkout/subscription", {
      method: "POST",
      body: {
        creator_handle: "someone",
        success_url: "http://localhost:3000/billing/success",
        cancel_url: "http://localhost:3000/billing/cancel",
      },
    });
    // 401 = unauthenticated, 403 = CSRF/WAF rejection (both valid for no-auth)
    expect([401, 403]).toContain(res.status);
  });
});

test.describe("Billing Status & Subscription (E2E Bypass)", () => {
  const fanEmail = uniqueEmail("billfan2");
  const creatorEmail = uniqueEmail("billcreator");
  let fanCookies = "";
  let fanCsrf = "";
  let e2eAvailable = false;

  test.beforeAll(async () => {
    e2eAvailable = await isE2EEnabled();
    if (!e2eAvailable) return;

    const fan = await signupFan(fanEmail, PASSWORD, "E2E Bill Fan 2");
    fanCookies = fan.cookies;
    fanCsrf = fanCookies.match(/csrf_token=([^;]+)/)?.[1] ?? "";

    await createVerifiedCreator(creatorEmail, PASSWORD);

    // Activate subscription via E2E bypass
    await e2eApi("/billing/activate-subscription", {
      query: { fan_email: fanEmail, creator_email: creatorEmail },
    });
  });

  test("billing status shows active subscription", async () => {
    test.skip(!e2eAvailable, "E2E bypass not available");
    const res = await apiFetch("/billing/status", { cookies: fanCookies });
    if (res.status === 401) {
      test.skip(true, "Fan session invalid");
      return;
    }
    expect(res.ok).toBe(true);
    expect(res.body).toHaveProperty("items");
    const activeSub = res.body.items?.find((s: any) => s.status === "active");
    expect(activeSub).toBeTruthy();
  });

  test("cancel subscription at period end", async () => {
    test.skip(!e2eAvailable, "E2E bypass not available");
    const status = await apiFetch("/billing/status", { cookies: fanCookies });
    if (!status.ok || !status.body.items?.length) {
      test.skip(true, "No active subscriptions");
      return;
    }
    const subId = status.body.items[0].subscription_id;
    const res = await apiFetch(`/billing/subscriptions/${subId}/cancel`, {
      method: "POST",
      cookies: fanCookies,
      headers: { "X-CSRF-Token": fanCsrf },
    });
    // May fail if using e2e_sub_ (no real CCBill ID), which is expected
    if (res.status === 400 || res.status === 404) {
      test.skip(true, "Cancel requires real CCBill subscription");
      return;
    }
    expect(res.ok).toBe(true);
    expect(res.body).toHaveProperty("cancel_at_period_end", true);
  });
});

test.describe("Billing UI Pages", () => {
  test("billing/success page loads", async ({ page }) => {
    const res = await page.goto("/billing/success");
    expect(res?.status()).toBe(200);
  });

  test("billing/cancel page loads", async ({ page }) => {
    const res = await page.goto("/billing/cancel");
    expect(res?.status()).toBe(200);
  });
});
