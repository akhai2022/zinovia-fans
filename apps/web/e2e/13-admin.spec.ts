/**
 * STEP 13 — Admin moderation: creators, posts, force-verify.
 */

import { test, expect } from "@playwright/test";
import {
  uniqueEmail,
  apiFetch,
  createAdminUser,
  registerCreator,
  isE2EEnabled,
} from "./helpers";

const PASSWORD = "E2eAdmin1234!";
let adminCookies = "";
let adminCsrf = "";
let e2eAvailable = false;

test.beforeAll(async () => {
  e2eAvailable = await isE2EEnabled();
  if (!e2eAvailable) return;

  const adminEmail = uniqueEmail("admin");
  const admin = await createAdminUser(adminEmail, PASSWORD);
  adminCookies = admin.cookies;
  adminCsrf = adminCookies.match(/csrf_token=([^;]+)/)?.[1] ?? "";
});

test.describe("Admin — Creator Moderation", () => {
  test("list creators", async () => {
    test.skip(!e2eAvailable, "E2E bypass required");
    const res = await apiFetch("/admin/creators?page=1&page_size=10", {
      cookies: adminCookies,
    });
    expect(res.ok).toBe(true);
    expect(res.body).toHaveProperty("items");
    expect(res.body).toHaveProperty("total");
  });

  test("verify a creator", async () => {
    test.skip(!e2eAvailable, "E2E bypass required");
    const creatorEmail = uniqueEmail("adminTarget");
    await registerCreator(creatorEmail, PASSWORD);

    // Get the creator user_id
    const tokens = await apiFetch(`/auth/dev/tokens?email=${encodeURIComponent(creatorEmail)}`);
    if (!tokens.ok || !tokens.body.user_id) {
      test.skip(true, "Could not find creator user_id");
      return;
    }
    const userId = tokens.body.user_id;

    const res = await apiFetch(`/admin/creators/${userId}/action`, {
      method: "POST",
      body: { action: "verify", reason: "E2E test verification" },
      cookies: adminCookies,
      headers: { "X-CSRF-Token": adminCsrf },
    });
    expect(res.ok).toBe(true);
  });

  test("non-admin returns 403 for admin endpoints", async () => {
    const fanEmail = uniqueEmail("notadmin");
    await apiFetch("/auth/signup", {
      method: "POST",
      body: { email: fanEmail, password: PASSWORD, display_name: "Not Admin" },
    });
    const login = await apiFetch("/auth/login", {
      method: "POST",
      body: { email: fanEmail, password: PASSWORD },
    });
    const fanCookies = (login.headers.get("set-cookie") ?? "")
      .split(",").map(c => c.split(";")[0].trim()).join("; ");

    const res = await apiFetch("/admin/creators?page=1&page_size=10", {
      cookies: fanCookies,
    });
    expect(res.status).toBe(403);
  });
});

test.describe("Admin — Post Moderation", () => {
  test("list posts", async () => {
    test.skip(!e2eAvailable, "E2E bypass required");
    const res = await apiFetch("/admin/posts?page=1&page_size=10", {
      cookies: adminCookies,
    });
    expect(res.ok).toBe(true);
    expect(res.body).toHaveProperty("items");
  });
});

test.describe("Admin — Force Verify Email", () => {
  test("force verify email for stuck creator", async () => {
    test.skip(!e2eAvailable, "E2E bypass required");
    const creatorEmail = uniqueEmail("forceVerify");
    const idempotencyKey = `e2e-forceverify-${Date.now()}`;
    await apiFetch("/auth/register", {
      method: "POST",
      body: { email: creatorEmail, password: PASSWORD },
      headers: { "Idempotency-Key": idempotencyKey },
    });

    const res = await apiFetch(`/admin/force-verify-email?email=${encodeURIComponent(creatorEmail)}`, {
      method: "POST",
      cookies: adminCookies,
      headers: { "X-CSRF-Token": adminCsrf },
    });
    expect(res.ok).toBe(true);
    expect(res.body.status).toMatch(/verified|already_verified/);
  });
});

test.describe("Admin — Token Lookup", () => {
  test("get tokens for a user", async () => {
    test.skip(!e2eAvailable, "E2E bypass required");
    const email = uniqueEmail("tokenLookup");
    const idempotencyKey = `e2e-tokenlookup-${Date.now()}`;
    await apiFetch("/auth/register", {
      method: "POST",
      body: { email, password: PASSWORD },
      headers: { "Idempotency-Key": idempotencyKey },
    });

    const res = await apiFetch(`/admin/tokens?email=${encodeURIComponent(email)}`, {
      cookies: adminCookies,
    });
    expect(res.ok).toBe(true);
    expect(res.body).toHaveProperty("user_id");
    expect(res.body).toHaveProperty("verification_token");
  });
});

test.describe("Admin UI", () => {
  test("/admin page loads for admin user @smoke", { tag: "@smoke" }, async ({ page }) => {
    test.skip(!e2eAvailable, "E2E bypass required");
    // Set cookies on the browser context
    const adminEmail = uniqueEmail("adminui");
    const admin = await createAdminUser(adminEmail, PASSWORD);

    // Login via UI
    await page.goto("/login");
    await page.getByLabel("Email").fill(adminEmail);
    await page.getByLabel("Password").fill(PASSWORD);
    await page.getByRole("button", { name: /sign in/i }).click();
    await page.waitForURL((url) => !url.pathname.includes("/login"), { timeout: 15000 });

    await page.goto("/admin");
    await page.waitForLoadState("networkidle");
    expect(page.url()).toContain("/admin");
  });
});
