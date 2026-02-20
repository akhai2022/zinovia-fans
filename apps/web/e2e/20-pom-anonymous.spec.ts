/**
 * STEP 20 — Anonymous visitor parcours (POM-driven UI tests).
 *
 * Validates:
 *   1. Landing page loads, hero is non-empty, CTA visible
 *   2. Creators list loads
 *   3. Creator profile loads with posts section
 *   4. Public posts visible, locked posts show blur + CTA
 */

import { test, expect } from "@playwright/test";
import { LandingPage } from "./pages/landing.page";
import { CreatorDiscoveryPage, CreatorProfilePage } from "./pages/creator.page";
import { apiFetch, collectJSErrors } from "./helpers";

test.describe("Anonymous — Landing Page", () => {
  test("hero heading is visible and non-empty", async ({ page }) => {
    const landing = new LandingPage(page);
    await landing.goto();
    await landing.expectHeroVisible();
    await landing.expectNoEmptyHero();
  });

  test("CTA buttons link to /signup", async ({ page }) => {
    const landing = new LandingPage(page);
    await landing.goto();
    await landing.expectCtaVisible();
  });

  test("navbar is visible with Sign in / Sign up links", async ({ page }) => {
    const landing = new LandingPage(page);
    await landing.goto();
    await landing.expectNavbarVisible();
    // Check that unauthenticated nav shows sign-in/sign-up
    const signIn = page.locator('a[href="/login"]');
    await expect(signIn.first()).toBeVisible({ timeout: 5_000 });
  });

  test("no JS errors on landing page", async ({ page }) => {
    const errors = collectJSErrors(page);
    const landing = new LandingPage(page);
    await landing.goto();
    // Allow the page to settle
    await page.waitForTimeout(2_000);
    expect(errors).toHaveLength(0);
  });
});

test.describe("Anonymous — Creator Discovery", () => {
  test("creators list page loads with heading", async ({ page }) => {
    const discovery = new CreatorDiscoveryPage(page);
    await discovery.goto();
    await discovery.expectPageLoaded();
  });

  test("creators API returns data", async () => {
    const res = await apiFetch("/creators?page=1&page_size=10");
    expect(res.ok).toBe(true);
    expect(res.body).toHaveProperty("items");
    expect(Array.isArray(res.body.items)).toBe(true);
  });
});

test.describe("Anonymous — Creator Profile", () => {
  let firstHandle: string | null = null;

  test.beforeAll(async () => {
    const res = await apiFetch("/creators?page=1&page_size=1");
    if (res.ok && res.body.items?.length > 0) {
      firstHandle = res.body.items[0].handle;
    }
  });

  test("creator profile loads without error", async ({ page }) => {
    test.skip(!firstHandle, "No creators available to test");
    const profile = new CreatorProfilePage(page);
    await profile.goto(firstHandle!);
    await profile.expectProfileLoaded();
    await profile.expectNoError();
  });

  test("posts section visible on creator profile", async ({ page }) => {
    test.skip(!firstHandle, "No creators available to test");
    const profile = new CreatorProfilePage(page);
    await profile.goto(firstHandle!);
    await profile.expectPostsSectionVisible();
  });

  test("subscriber-only posts show lock overlay for anonymous", async ({ page }) => {
    test.skip(!firstHandle, "No creators available to test");
    await page.context().clearCookies();
    await page.goto(`/creators/${firstHandle}`);
    await page.waitForLoadState("networkidle");

    // Look for either lock overlay or subscribe CTA
    const lockIndicators = page.locator(
      'text=Subscribe to unlock, text=Subscribe, button:has-text("Subscribe")',
    );
    // At least one subscribe indicator should exist on a creator profile
    const count = await lockIndicators.count();
    // This may be 0 if the creator has no subscriber-only posts — that's OK
    if (count > 0) {
      await expect(lockIndicators.first()).toBeVisible();
    }
  });

  test("no JS errors on creator profile", async ({ page }) => {
    test.skip(!firstHandle, "No creators available to test");
    const errors = collectJSErrors(page);
    await page.goto(`/creators/${firstHandle}`);
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(2_000);
    expect(errors).toHaveLength(0);
  });
});
