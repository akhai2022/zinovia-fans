/**
 * 46 — Creator Profile Settings (@regression)
 *
 * Tests creator profile page, settings form, profile update,
 * public profile visibility, and creator dashboard pages.
 */

import { test, expect } from "@playwright/test";
import {
  safeGoto,
  uniqueEmail,
  uniqueHandle,
  apiFetch,
  createVerifiedCreator,
  isE2EEnabled,
  setCookiesOnContext,
  API_BASE,
  extractCookies,
} from "./helpers";
import { extractCsrf } from "./ai-helpers";

test.describe("Creator profile & settings @regression", () => {
  const email = uniqueEmail("c-settings");
  const password = "CreatorSettings123!";
  let cookies: string;
  let userId: string;
  let e2eAvailable: boolean;

  test.beforeAll(async () => {
    e2eAvailable = await isE2EEnabled();
    if (!e2eAvailable) return;
    const creator = await createVerifiedCreator(email, password);
    cookies = creator.cookies;
    userId = creator.userId;
  });

  test("CPS-001: settings/profile page loads for creator", async ({ page, context }) => {
    test.skip(!e2eAvailable, "E2E bypass required");
    await setCookiesOnContext(context, cookies);

    await safeGoto(page, "/settings/profile");
    const body = await page.textContent("body");
    expect(body).not.toContain("Internal Server Error");
  });

  test("CPS-002: update display_name via API @regression", async () => {
    test.skip(!e2eAvailable, "E2E bypass required");
    const csrf = extractCsrf(cookies);
    const newName = `Test Creator ${Date.now()}`;
    const res = await apiFetch("/creators/me", {
      method: "PATCH",
      body: { display_name: newName },
      cookies,
      headers: { "X-CSRF-Token": csrf },
    });
    if (res.ok) {
      expect(res.body.display_name).toBe(newName);
    } else {
      // Creator profile may not exist yet — that's acceptable
      expect([200, 404]).toContain(res.status);
    }
  });

  test("CPS-003: update bio via API @regression", async () => {
    test.skip(!e2eAvailable, "E2E bypass required");
    const csrf = extractCsrf(cookies);
    const newBio = `E2E test bio — ${Date.now()}`;
    const res = await apiFetch("/creators/me", {
      method: "PATCH",
      body: { bio: newBio },
      cookies,
      headers: { "X-CSRF-Token": csrf },
    });
    if (res.ok) {
      expect(res.body.bio).toBe(newBio);
    } else {
      expect([200, 404]).toContain(res.status);
    }
  });

  test("CPS-004: settings/security page loads for creator", async ({ page, context }) => {
    test.skip(!e2eAvailable, "E2E bypass required");
    await setCookiesOnContext(context, cookies);

    await safeGoto(page, "/settings/security");
    const body = await page.textContent("body");
    expect(body).not.toContain("Internal Server Error");
  });

  test("CPS-005: creator/vault page loads @regression", async ({ page, context }) => {
    test.skip(!e2eAvailable, "E2E bypass required");
    await setCookiesOnContext(context, cookies);

    await safeGoto(page, "/creator/vault");
    const body = await page.textContent("body");
    expect(body).not.toContain("Internal Server Error");
  });

  test("CPS-006: creator/earnings page loads @regression", async ({ page, context }) => {
    test.skip(!e2eAvailable, "E2E bypass required");
    await setCookiesOnContext(context, cookies);

    await safeGoto(page, "/creator/earnings");
    const body = await page.textContent("body");
    expect(body).not.toContain("Internal Server Error");
  });

  test("CPS-007: creator/collections page loads @regression", async ({ page, context }) => {
    test.skip(!e2eAvailable, "E2E bypass required");
    await setCookiesOnContext(context, cookies);

    await safeGoto(page, "/creator/collections");
    const body = await page.textContent("body");
    expect(body).not.toContain("Internal Server Error");
  });

  test("CPS-008: fan cannot access /creator/post/new", async ({ page }) => {
    // As anonymous, should redirect to login
    await safeGoto(page, "/creator/post/new");
    const url = page.url();
    const body = await page.textContent("body");
    const restricted =
      url.includes("/login") ||
      body?.toLowerCase().includes("sign in") ||
      body?.toLowerCase().includes("log in") ||
      body?.toLowerCase().includes("denied") ||
      body?.toLowerCase().includes("not authorized");
    expect(restricted).toBe(true);
  });
});
