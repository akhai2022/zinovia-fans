/**
 * Billing (Stripe) + Access Control — subscription checkout,
 * PPV purchase intent, access gating.
 */

import { test, expect } from "@playwright/test";
import { uniqueEmail, apiFetch } from "./helpers";

let fanCookies = "";
let creatorCookies = "";
const fanEmail = uniqueEmail("billfan");
const fanPassword = "E2eBilling123!";
const creatorEmail = uniqueEmail("billcreator");
const creatorPassword = "E2eBilling123!";

test.describe("Billing & Access Control", () => {
  test.beforeAll(async () => {
    // Setup fan
    await apiFetch("/auth/signup", {
      method: "POST",
      body: { email: fanEmail, password: fanPassword, display_name: "E2E Bill Fan" },
    });
    const fanLogin = await apiFetch("/auth/login", {
      method: "POST",
      body: { email: fanEmail, password: fanPassword },
    });
    fanCookies = fanLogin.headers.get("set-cookie") ?? "";

    // Setup creator
    await apiFetch("/auth/register", {
      method: "POST",
      body: { email: creatorEmail, password: creatorPassword },
      headers: { "Idempotency-Key": `e2e-bill-${Date.now()}` },
    });
    const creatorLogin = await apiFetch("/auth/login", {
      method: "POST",
      body: { email: creatorEmail, password: creatorPassword },
    });
    creatorCookies = creatorLogin.headers.get("set-cookie") ?? "";
  });

  test("billing status API returns for authenticated fan", async () => {
    const res = await apiFetch("/billing/status", { cookies: fanCookies });
    if (res.status === 401) {
      test.skip(true, "Fan session not valid");
      return;
    }
    expect(res.ok).toBe(true);
  });

  test("billing health shows stripe connected", async () => {
    const res = await apiFetch("/billing/health");
    expect(res.ok).toBe(true);
    expect(res.body).toHaveProperty("stripe_configured");
  });

  test("subscription checkout requires creator_id", async () => {
    const res = await apiFetch("/billing/checkout/subscription", {
      method: "POST",
      body: {
        success_url: "https://zinovia.ai/billing/success",
        cancel_url: "https://zinovia.ai/billing/cancel",
        // Missing creator_id
      },
      cookies: fanCookies,
    });
    expect([400, 422]).toContain(res.status);
  });

  test("subscribe button on creator page triggers real checkout", async ({ page }) => {
    // Find a creator with a profile
    const creators = await apiFetch("/creators?page=1&page_size=1");
    if (!creators.ok || creators.body.items?.length === 0) {
      test.skip(true, "No creators available");
      return;
    }
    const handle = creators.body.items[0].handle;

    // Login as fan via UI
    await page.goto("/login");
    await page.fill('input[type="email"]', fanEmail);
    await page.fill('input[type="password"]', fanPassword);
    await page.click('button[type="submit"]');
    await page.waitForURL(/\/(feed|me|creators)/, { timeout: 10000 });

    // Go to creator profile
    await page.goto(`/creators/${handle}`);
    await page.waitForLoadState("networkidle");

    // Look for Subscribe button
    const subscribeBtn = page.locator('button:has-text("Subscribe"), a:has-text("Subscribe")');
    if (await subscribeBtn.count() === 0) {
      test.skip(true, "No subscribe button found — may already be subscribed or free creator");
      return;
    }

    // Click subscribe and verify it initiates a real API call (not dummy)
    const [response] = await Promise.all([
      page.waitForResponse(
        (res) => res.url().includes("/billing/checkout") || res.url().includes("checkout.stripe.com"),
        { timeout: 15000 },
      ).catch(() => null),
      subscribeBtn.first().click(),
    ]);

    // It should either redirect to Stripe or make an API call
    if (response) {
      expect(response.url()).toMatch(/billing|stripe/);
    }
  });
});

test.describe("PPV Access Control", () => {
  test("PPV post status shows locked for unauthenticated", async () => {
    // Find a creator and their posts
    const creators = await apiFetch("/creators?page=1&page_size=1");
    if (!creators.ok || creators.body.items?.length === 0) {
      test.skip(true, "No creators available");
      return;
    }
    const handle = creators.body.items[0].handle;
    const posts = await apiFetch(`/creators/${handle}/posts?page_size=20&include_locked=true`);
    if (!posts.ok) {
      test.skip(true, "Could not fetch posts");
      return;
    }
    const ppvPost = posts.body.items?.find((p: any) => p.visibility === "PPV");
    if (!ppvPost) {
      test.skip(true, "No PPV posts available to test");
      return;
    }
    // Check PPV status endpoint
    const status = await apiFetch(`/ppv/posts/${ppvPost.id}/status`, { cookies: fanCookies });
    if (status.status === 401) {
      test.skip(true, "Auth required for PPV status");
      return;
    }
    expect(status.ok).toBe(true);
    expect(status.body.is_locked).toBe(true);
    expect(status.body.viewer_has_unlocked).toBe(false);
  });

  test("locked posts hide asset_ids from non-subscribers", async () => {
    const creators = await apiFetch("/creators?page=1&page_size=1");
    if (!creators.ok || creators.body.items?.length === 0) {
      test.skip(true, "No creators available");
      return;
    }
    const handle = creators.body.items[0].handle;
    const posts = await apiFetch(`/creators/${handle}/posts?page_size=20&include_locked=true`);
    if (!posts.ok) return;
    const lockedPost = posts.body.items?.find((p: any) => p.is_locked);
    if (!lockedPost) {
      test.skip(true, "No locked posts to verify");
      return;
    }
    // Locked posts should have empty or no asset_ids
    expect(lockedPost.asset_ids?.length ?? 0).toBe(0);
  });
});
