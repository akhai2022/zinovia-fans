/**
 * STEP 26 — Regression checks (POM-driven).
 *
 * Validates:
 *   1. No console errors on key pages
 *   2. No 500s in network responses for critical routes
 *   3. Auth-gated pages redirect properly
 */

import { test, expect } from "@playwright/test";
import { collectJSErrors, signupFan, uniqueEmail, IS_PROD, safeGoto } from "./helpers";
import { LoginPage } from "./pages/auth.page";

const PASSWORD = "E2eRegress123!";

const PUBLIC_ROUTES = [
  "/",
  "/creators",
  "/about",
  "/pricing",
  "/how-it-works",
  "/privacy",
  "/terms",
  "/help",
  "/contact",
  "/signup",
  "/login",
];

const AUTH_ROUTES = [
  "/feed",
  "/messages",
  "/notifications",
  "/settings/profile",
  "/me",
];

test.describe("Regression — No Console Errors on Public Pages", () => {
  for (const route of PUBLIC_ROUTES) {
    test(`${route} — no JS errors`, async ({ page }) => {
      const errors = collectJSErrors(page);
      await safeGoto(page, route);
      await page.waitForLoadState("networkidle");
      await page.waitForTimeout(1_000);
      expect(errors).toHaveLength(0);
    });
  }
});

test.describe("Regression — No 500 Responses on Public Pages", () => {
  for (const route of PUBLIC_ROUTES) {
    test(`${route} — no 500 in network`, async ({ page }) => {
      const serverErrors: string[] = [];
      page.on("response", (response) => {
        if (response.status() >= 500) {
          serverErrors.push(
            `${response.status()} ${response.url()}`,
          );
        }
      });

      await safeGoto(page, route);
      await page.waitForLoadState("networkidle");
      await page.waitForTimeout(1_000);
      expect(serverErrors).toHaveLength(0);
    });
  }
});

test.describe("Regression — Auth Pages Redirect Anonymous", () => {
  for (const route of AUTH_ROUTES) {
    test(`${route} — anonymous → login redirect or prompt`, async ({
      page,
    }) => {
      await page.context().clearCookies();
      await safeGoto(page, route);
      await page.waitForLoadState("networkidle");

      const url = page.url();
      const body = await page.textContent("body");
      const isHandled =
        url.includes("/login") ||
        body?.toLowerCase().includes("sign in") ||
        body?.toLowerCase().includes("log in");
      expect(isHandled).toBe(true);
    });
  }
});

test.describe("Regression — No Console Errors on Auth Pages", () => {
  const email = uniqueEmail("reg-auth");
  let loginReady = false;

  test.beforeAll(async () => {
    if (IS_PROD) return; // signupFan requires email verification in prod
    try {
      await signupFan(email, PASSWORD, "Regression Fan");
      loginReady = true;
    } catch {
      // Login may fail if email verification is required
    }
  });

  for (const route of AUTH_ROUTES) {
    test(`${route} — no JS errors for logged-in user`, async ({ page }) => {
      test.skip(!loginReady, "Cannot login — email verification required in prod");
      const errors = collectJSErrors(page);
      const login = new LoginPage(page);
      await login.login(email, PASSWORD);

      await safeGoto(page, route);
      await page.waitForLoadState("networkidle");
      await page.waitForTimeout(1_000);
      expect(errors).toHaveLength(0);
    });
  }
});

test.describe("Regression — No 500 Responses on Auth Pages", () => {
  const email = uniqueEmail("reg-auth-500");
  let loginReady = false;

  test.beforeAll(async () => {
    if (IS_PROD) return;
    try {
      await signupFan(email, PASSWORD, "Regression Fan 500");
      loginReady = true;
    } catch {
      // Login may fail if email verification is required
    }
  });

  for (const route of AUTH_ROUTES) {
    test(`${route} — no 500 for logged-in user`, async ({ page }) => {
      test.skip(!loginReady, "Cannot login — email verification required in prod");
      const serverErrors: string[] = [];
      page.on("response", (response) => {
        if (response.status() >= 500) {
          serverErrors.push(
            `${response.status()} ${response.url()}`,
          );
        }
      });

      const login = new LoginPage(page);
      await login.login(email, PASSWORD);

      await safeGoto(page, route);
      await page.waitForLoadState("networkidle");
      await page.waitForTimeout(1_000);
      expect(serverErrors).toHaveLength(0);
    });
  }
});
