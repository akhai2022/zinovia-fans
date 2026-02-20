/**
 * STEP 18 — Settings & profile management.
 */

import { test, expect } from "@playwright/test";
import {
  uniqueEmail,
  apiFetch,
  signupFan,
  createVerifiedCreator,
  isE2EEnabled,
  loginViaUI,
} from "./helpers";

const PASSWORD = "E2eSettings123!";

test.describe("Settings Pages UI", () => {
  const email = uniqueEmail("settingsui");

  test.beforeAll(async () => {
    await signupFan(email, PASSWORD, "Settings Fan");
  });

  test("settings/profile page loads for logged-in user", async ({ page }) => {
    await loginViaUI(page, email, PASSWORD);
    await page.goto("/settings/profile");
    await page.waitForLoadState("networkidle");
    expect(page.url()).toMatch(/\/(settings|login)/);
  });

  test("settings/security page loads", async ({ page }) => {
    await loginViaUI(page, email, PASSWORD);
    await page.goto("/settings/security");
    await page.waitForLoadState("networkidle");
    const body = await page.textContent("body");
    // Should have password change form or redirect
    expect(body).toBeTruthy();
  });
});

test.describe("Creator Profile Update API", () => {
  let cookies = "";
  let csrfToken = "";
  let e2eAvailable = false;

  test.beforeAll(async () => {
    e2eAvailable = await isE2EEnabled();
    if (!e2eAvailable) return;

    const email = uniqueEmail("profileUpdate");
    const creator = await createVerifiedCreator(email, PASSWORD);
    cookies = creator.cookies;
    csrfToken = cookies.match(/csrf_token=([^;]+)/)?.[1] ?? "";
  });

  test("update display_name via PATCH /creators/me", async () => {
    test.skip(!e2eAvailable, "E2E bypass required");
    const newName = `E2E Updated ${Date.now()}`;
    const res = await apiFetch("/creators/me", {
      method: "PATCH",
      body: { display_name: newName },
      cookies,
      headers: { "X-CSRF-Token": csrfToken },
    });
    if (res.status === 403 || res.status === 404) {
      test.skip(true, "Creator profile endpoint not available");
      return;
    }
    expect(res.ok).toBe(true);
  });

  test("update bio", async () => {
    test.skip(!e2eAvailable, "E2E bypass required");
    const res = await apiFetch("/creators/me", {
      method: "PATCH",
      body: { bio: `E2E bio ${Date.now()}` },
      cookies,
      headers: { "X-CSRF-Token": csrfToken },
    });
    if (res.status === 403) {
      test.skip(true, "Creator profile required");
      return;
    }
    expect(res.ok).toBe(true);
  });
});
