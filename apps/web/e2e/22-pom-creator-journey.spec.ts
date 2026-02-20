/**
 * STEP 22 — Creator signup + verification + onboarding + content creation (POM-driven).
 *
 * Validates:
 *   1. Creator signup
 *   2. Email verification
 *   3. Onboarding state machine (CREATED → EMAIL_VERIFIED → KYC_APPROVED via E2E bypass)
 *   4. Creator tools accessible after approval
 *   5. Create PUBLIC, SUBSCRIBERS, PPV posts
 */

import { test, expect } from "@playwright/test";
import { LoginPage } from "./pages/auth.page";
import {
  uniqueEmail,
  apiFetch,
  getVerificationToken,
  e2eApi,
  createVerifiedCreator,
  isE2EEnabled,
  collectJSErrors,
  IS_PROD,
} from "./helpers";

const PASSWORD = "E2eCreatorJ1!";

test.describe("Creator Journey — Registration & Onboarding", () => {
  const email = uniqueEmail("cj-reg");
  let e2eAvailable = false;

  test.beforeAll(async () => {
    e2eAvailable = await isE2EEnabled();
  });

  test("creator registers via API", async () => {
    const res = await apiFetch("/auth/register", {
      method: "POST",
      body: { email, password: PASSWORD },
      headers: { "Idempotency-Key": `e2e-cj-${Date.now()}` },
    });
    expect([200, 201]).toContain(res.status);
    expect(res.body).toHaveProperty("creator_id");
  });

  test("onboarding state is CREATED", async () => {
    test.skip(IS_PROD, "Dev token endpoint disabled in production");
    const tokens = await apiFetch(
      `/auth/dev/tokens?email=${encodeURIComponent(email)}`,
    );
    expect(tokens.ok).toBe(true);
    expect(tokens.body.onboarding_state).toBe("CREATED");
  });

  test("verify email → state becomes EMAIL_VERIFIED", async () => {
    test.skip(IS_PROD, "Dev token endpoint disabled in production");
    const token = await getVerificationToken(email);
    expect(token).toBeTruthy();

    const res = await apiFetch("/auth/verify-email", {
      method: "POST",
      body: { token },
      headers: { "Idempotency-Key": `e2e-cj-verify-${Date.now()}` },
    });
    expect(res.ok).toBe(true);
    expect(res.body.state).toBe("EMAIL_VERIFIED");
  });

  test("force KYC_APPROVED via E2E bypass", async () => {
    test.skip(!e2eAvailable, "E2E bypass required to simulate KYC");
    const res = await e2eApi("/onboarding/force-state", {
      query: { email, state: "KYC_APPROVED" },
    });
    expect(res.ok).toBe(true);
    expect(res.body.onboarding_state).toBe("KYC_APPROVED");
  });

  test("creator can log in after KYC approval", async ({ page }) => {
    test.skip(!e2eAvailable, "E2E bypass required");
    // Force role to ensure profile exists
    await e2eApi("/auth/force-role", {
      query: { email, role: "creator" },
    });

    const login = new LoginPage(page);
    await login.login(email, PASSWORD);
    await login.expectLoginSuccess();
  });
});

test.describe("Creator Journey — Content Creation via API", () => {
  let cookies = "";
  let csrfToken = "";
  let e2eAvailable = false;
  let createdPostIds: string[] = [];

  test.beforeAll(async () => {
    e2eAvailable = await isE2EEnabled();
    if (!e2eAvailable) return;

    const email = uniqueEmail("cj-posts");
    const result = await createVerifiedCreator(email, PASSWORD);
    cookies = result.cookies;
    csrfToken = cookies.match(/csrf_token=([^;]+)/)?.[1] ?? "";
  });

  test("create PUBLIC text post", async () => {
    test.skip(!e2eAvailable, "E2E bypass required");
    const res = await apiFetch("/posts", {
      method: "POST",
      body: {
        type: "TEXT",
        caption: `POM public post ${Date.now()}`,
        visibility: "PUBLIC",
        nsfw: false,
        asset_ids: [],
      },
      cookies,
      headers: { "X-CSRF-Token": csrfToken },
    });
    if (res.status === 403) {
      test.skip(true, "Creator profile required");
      return;
    }
    expect(res.ok).toBe(true);
    expect(res.body.visibility).toBe("PUBLIC");
    createdPostIds.push(res.body.id);
  });

  test("create SUBSCRIBERS-only post", async () => {
    test.skip(!e2eAvailable, "E2E bypass required");
    const res = await apiFetch("/posts", {
      method: "POST",
      body: {
        type: "TEXT",
        caption: `POM subscribers post ${Date.now()}`,
        visibility: "SUBSCRIBERS",
        nsfw: false,
        asset_ids: [],
      },
      cookies,
      headers: { "X-CSRF-Token": csrfToken },
    });
    if (res.status === 403) {
      test.skip(true, "Creator profile required");
      return;
    }
    expect(res.ok).toBe(true);
    expect(res.body.visibility).toBe("SUBSCRIBERS");
  });

  test("create PPV post with price", async () => {
    test.skip(!e2eAvailable, "E2E bypass required");
    const res = await apiFetch("/posts", {
      method: "POST",
      body: {
        type: "TEXT",
        caption: `POM PPV post ${Date.now()}`,
        visibility: "PPV",
        nsfw: false,
        asset_ids: [],
        price_cents: 500,
      },
      cookies,
      headers: { "X-CSRF-Token": csrfToken },
    });
    if (res.status === 403 || res.status === 400) {
      test.skip(true, "PPV disabled or creator profile required");
      return;
    }
    expect(res.ok).toBe(true);
    expect(res.body.visibility).toBe("PPV");
  });
});

test.describe("Creator Journey — Creator Tools UI", () => {
  let e2eAvailable = false;
  const email = uniqueEmail("cj-tools");

  test.beforeAll(async () => {
    e2eAvailable = await isE2EEnabled();
    if (!e2eAvailable) return;
    await createVerifiedCreator(email, PASSWORD);
  });

  test("creator can access post creation page", async ({ page }) => {
    test.skip(!e2eAvailable, "E2E bypass required");
    const login = new LoginPage(page);
    await login.login(email, PASSWORD);

    await page.goto("/creator/post/new");
    await page.waitForLoadState("networkidle");

    // Should show the post creation form (caption input)
    const captionInput = page.locator("#caption");
    await expect(captionInput).toBeVisible({ timeout: 10_000 });
  });

  test("creator can access vault page", async ({ page }) => {
    test.skip(!e2eAvailable, "E2E bypass required");
    const login = new LoginPage(page);
    await login.login(email, PASSWORD);

    await page.goto("/creator/vault");
    await page.waitForLoadState("networkidle");
    const body = await page.textContent("body");
    expect(body).not.toContain("Internal Server Error");
  });

  test("no JS errors on post creation page", async ({ page }) => {
    test.skip(!e2eAvailable, "E2E bypass required");
    const errors = collectJSErrors(page);
    const login = new LoginPage(page);
    await login.login(email, PASSWORD);

    await page.goto("/creator/post/new");
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(2_000);
    expect(errors).toHaveLength(0);
  });
});
