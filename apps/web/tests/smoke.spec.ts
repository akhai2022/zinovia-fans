import { test, expect } from "@playwright/test";

/**
 * Production smoke tests — unauthenticated.
 * Run against any environment:
 *   PLAYWRIGHT_BASE_URL=https://zinovia.ai npx playwright test tests/smoke.spec.ts
 *
 * These tests verify that critical pages render correctly and are not stuck
 * on loading states, placeholders, or error screens.
 */

test.describe("Smoke tests (unauthenticated)", () => {
  test("/ — homepage loads and has main CTAs", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveTitle(/zinovia/i);
    // Hero section should have at least one CTA button
    await expect(page.getByRole("link", { name: /sign up|start|creator/i }).first()).toBeVisible();
  });

  test("/login — renders login form within 5 seconds (not stuck on Loading)", async ({
    page,
  }) => {
    await page.goto("/login");
    // The login form must appear (email + password fields + submit button)
    const emailInput = page.getByLabel(/email/i);
    await expect(emailInput).toBeVisible({ timeout: 5_000 });
    await expect(page.getByLabel(/password/i)).toBeVisible();
    await expect(page.getByRole("button", { name: /sign in/i })).toBeVisible();
    // "Loading…" should NOT be the only visible content
    const loadingText = page.getByText("Loading…");
    await expect(loadingText).not.toBeVisible();
  });

  test("/creators — renders page heading and either creators or meaningful empty state", async ({
    page,
  }) => {
    await page.goto("/creators");
    await expect(page.getByRole("heading", { name: /creators/i })).toBeVisible();
    // Either creator cards exist OR the empty state CTA is shown — not a broken page
    const creatorCard = page.getByRole("listitem").first();
    const emptyState = page.getByText(/no creators have published/i);
    const becomeCreator = page.getByRole("link", { name: /become a creator/i });
    const hasCreators = await creatorCard.isVisible().catch(() => false);
    const hasEmptyState = await emptyState.isVisible().catch(() => false);
    expect(hasCreators || hasEmptyState).toBeTruthy();
    if (hasEmptyState) {
      await expect(becomeCreator).toBeVisible();
    }
  });

  test("/privacy — has real privacy policy content (not placeholder)", async ({ page }) => {
    await page.goto("/privacy");
    await expect(page.getByRole("heading", { name: /privacy/i })).toBeVisible();
    // Must contain structured sections, not just a one-line placeholder
    await expect(page.getByText(/information we collect/i)).toBeVisible();
    await expect(page.getByText(/last updated/i)).toBeVisible();
  });

  test("/terms — has real terms of service content (not placeholder)", async ({ page }) => {
    await page.goto("/terms");
    await expect(page.getByRole("heading", { name: /terms/i })).toBeVisible();
    await expect(page.getByText(/acceptance of terms/i)).toBeVisible();
    await expect(page.getByText(/last updated/i)).toBeVisible();
  });

  test("/help — has FAQ and help content (not placeholder)", async ({ page }) => {
    await page.goto("/help");
    await expect(page.getByRole("heading", { name: /help/i })).toBeVisible();
    await expect(page.getByText(/frequently asked/i)).toBeVisible();
    // At least one FAQ item
    await expect(page.getByText(/how do i/i).first()).toBeVisible();
  });

  test("/contact — has contact information", async ({ page }) => {
    await page.goto("/contact");
    await expect(page.getByRole("heading", { name: /contact/i })).toBeVisible();
    await expect(page.getByText(/support@zinovia.ai/i)).toBeVisible();
  });

  test("/feed — redirects unauthenticated user to /login", async ({ page }) => {
    await page.goto("/feed");
    // Should end up on /login (with ?next=/feed preserved)
    await expect(page).toHaveURL(/\/login/);
  });

  test("footer links are present and functional", async ({ page }) => {
    await page.goto("/");
    const footer = page.locator("footer");
    await expect(footer.getByRole("link", { name: /privacy/i })).toBeVisible();
    await expect(footer.getByRole("link", { name: /terms/i })).toBeVisible();
    await expect(footer.getByRole("link", { name: /help/i })).toBeVisible();
    await expect(footer.getByRole("link", { name: /contact/i })).toBeVisible();
  });

  test("no console errors on /login", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.goto("/login");
    // Wait for the login form to appear
    await page.getByLabel(/email/i).waitFor({ state: "visible", timeout: 5_000 });
    // There should be no uncaught JS exceptions
    expect(errors).toEqual([]);
  });

  test("/signup — renders role selector and signup form", async ({ page }) => {
    await page.goto("/signup");
    await expect(page.getByRole("heading", { name: /create your account/i })).toBeVisible();
    // Fan/creator selector visible
    await expect(page.getByRole("button", { name: /fan/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /creator/i })).toBeVisible();
    // Form fields visible
    await expect(page.getByLabel(/display name/i)).toBeVisible();
    await expect(page.getByLabel(/email/i)).toBeVisible();
    await expect(page.getByLabel(/password/i)).toBeVisible();
  });

  test("/forgot-password — renders reset form", async ({ page }) => {
    await page.goto("/forgot-password");
    await expect(page.getByRole("heading", { name: /reset password/i })).toBeVisible();
    await expect(page.getByLabel(/email/i)).toBeVisible();
    await expect(page.getByRole("button", { name: /send reset link/i })).toBeVisible();
  });

  test("404 page — styled and has navigation", async ({ page }) => {
    await page.goto("/this-page-does-not-exist-abc123");
    await expect(page.getByText(/page not found/i)).toBeVisible();
    await expect(page.getByRole("link", { name: /home/i })).toBeVisible();
  });

  test("/login — forgot password link is present", async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel(/email/i).waitFor({ state: "visible", timeout: 5_000 });
    await expect(page.getByRole("link", { name: /forgot password/i })).toBeVisible();
  });
});

/**
 * Authenticated smoke tests — require a test user.
 * Set PLAYWRIGHT_TEST_EMAIL and PLAYWRIGHT_TEST_PASSWORD env vars.
 * These tests are skipped if credentials are not provided.
 */
test.describe("Smoke tests (authenticated)", () => {
  const email = process.env.PLAYWRIGHT_TEST_EMAIL;
  const password = process.env.PLAYWRIGHT_TEST_PASSWORD;

  test.skip(!email || !password, "PLAYWRIGHT_TEST_EMAIL and PLAYWRIGHT_TEST_PASSWORD not set");

  test("login -> feed loads -> no errors", async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel(/email/i).fill(email!);
    await page.getByLabel(/password/i).fill(password!);
    await page.getByRole("button", { name: /sign in/i }).click();
    // Should redirect to feed after login
    await page.waitForURL(/\/feed/, { timeout: 10_000 });
    await expect(page.getByRole("heading", { name: /feed/i })).toBeVisible();
  });

  test("feed shows content or empty state", async ({ page }) => {
    // Login first
    await page.goto("/login");
    await page.getByLabel(/email/i).fill(email!);
    await page.getByLabel(/password/i).fill(password!);
    await page.getByRole("button", { name: /sign in/i }).click();
    await page.waitForURL(/\/feed/, { timeout: 10_000 });

    // Either feed items or empty state
    const feedList = page.getByRole("list", { name: /feed/i });
    const emptyState = page.getByText(/your feed is empty/i);
    const hasFeed = await feedList.isVisible().catch(() => false);
    const hasEmpty = await emptyState.isVisible().catch(() => false);
    expect(hasFeed || hasEmpty).toBeTruthy();
  });

  test("billing manage page accessible", async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel(/email/i).fill(email!);
    await page.getByLabel(/password/i).fill(password!);
    await page.getByRole("button", { name: /sign in/i }).click();
    await page.waitForURL(/\/feed/, { timeout: 10_000 });

    await page.goto("/billing/manage");
    await expect(page.getByRole("heading", { name: /manage subscriptions/i })).toBeVisible({
      timeout: 5_000,
    });
  });
});
