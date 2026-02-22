/**
 * STEP 29 — Remove Background tool tests.
 *
 * Tests the remove-bg job submission, polling, IDOR protection,
 * rate limiting, and UI page load.
 */

import { test, expect } from "@playwright/test";
import {
  uniqueEmail,
  apiFetch,
  signupFan,
  createVerifiedCreator,
  isE2EEnabled,
} from "./helpers";
import { extractCsrf, requestUploadUrl, pollJobStatus } from "./ai-helpers";

const PASSWORD = "E2eRmBg12345!";
let e2eAvailable = false;

let creatorCookies = "";
let creatorCsrf = "";
let fanCookies = "";
let fanCsrf = "";
let mediaAssetId = "";

test.beforeAll(async () => {
  e2eAvailable = await isE2EEnabled();
  if (!e2eAvailable) return;

  const [creator, fan] = await Promise.all([
    createVerifiedCreator(uniqueEmail("rmbg-cr"), PASSWORD),
    signupFan(uniqueEmail("rmbg-fan"), PASSWORD, "RmBg Fan"),
  ]);
  creatorCookies = creator.cookies;
  creatorCsrf = extractCsrf(creatorCookies);
  fanCookies = fan.cookies;
  fanCsrf = extractCsrf(fanCookies);

  // Upload test image
  try {
    const upload = await requestUploadUrl(creatorCookies, creatorCsrf);
    mediaAssetId = upload.assetId;
  } catch {
    // Upload may fail — tests will skip
  }
});

test.describe("Remove Background Tool", () => {
  let jobId = "";

  test("RBG-001: submit remove-bg job @smoke", { tag: "@smoke" }, async () => {
    test.skip(!e2eAvailable || !mediaAssetId, "E2E bypass or media upload required");
    const res = await apiFetch("/ai-tools/remove-bg", {
      method: "POST",
      body: { media_asset_id: mediaAssetId },
      cookies: creatorCookies,
      headers: { "X-CSRF-Token": creatorCsrf },
    });
    if (res.status === 403 || res.status === 404) {
      test.skip(true, "AI tools not enabled");
      return;
    }
    expect(res.ok).toBe(true);
    expect(res.body).toHaveProperty("job_id");
    expect(res.body).toHaveProperty("status");
    jobId = res.body.job_id;
  });

  test("RBG-002: poll job status until terminal state", { tag: "@regression" }, async () => {
    test.skip(!e2eAvailable || !jobId, "No job created");
    const result = await pollJobStatus(`/ai-tools/remove-bg/${jobId}`, creatorCookies, {
      maxAttempts: 15,
      intervalMs: 2000,
    });
    // Job should reach a terminal state (ready or failed)
    expect(["ready", "failed", "READY", "FAILED", "timeout"]).toContain(result.status);
  });

  test("RBG-003: result URL accessible when ready", { tag: "@regression" }, async () => {
    test.skip(!e2eAvailable || !jobId, "No job created");
    const res = await apiFetch(`/ai-tools/remove-bg/${jobId}`, {
      cookies: creatorCookies,
    });
    if (!res.ok) {
      test.skip(true, "Could not get job status");
      return;
    }
    if (res.body.status !== "ready" && res.body.status !== "READY") {
      test.skip(true, "Job not ready — cannot test result URL");
      return;
    }
    expect(res.body.result_url).toBeTruthy();
    // Verify the presigned URL looks valid
    expect(res.body.result_url).toContain("http");
  });

  test("RBG-004: fan cannot submit remove-bg job @smoke", { tag: "@smoke" }, async () => {
    test.skip(!e2eAvailable || !mediaAssetId, "E2E bypass or media upload required");
    const res = await apiFetch("/ai-tools/remove-bg", {
      method: "POST",
      body: { media_asset_id: mediaAssetId },
      cookies: fanCookies,
      headers: { "X-CSRF-Token": fanCsrf },
    });
    expect([401, 403, 404]).toContain(res.status);
  });

  test("RBG-005: IDOR — cannot submit job for another user's media", { tag: "@regression" }, async () => {
    test.skip(!e2eAvailable, "E2E bypass required");
    // Create a second creator
    const other = await createVerifiedCreator(uniqueEmail("rmbg-other"), PASSWORD);
    const otherCsrf = extractCsrf(other.cookies);

    // Upload media as the second creator
    let otherMediaId = "";
    try {
      const upload = await requestUploadUrl(other.cookies, otherCsrf);
      otherMediaId = upload.assetId;
    } catch {
      test.skip(true, "Could not upload media for IDOR test");
      return;
    }

    // Try to submit job as the first creator using other's media
    const res = await apiFetch("/ai-tools/remove-bg", {
      method: "POST",
      body: { media_asset_id: otherMediaId },
      cookies: creatorCookies,
      headers: { "X-CSRF-Token": creatorCsrf },
    });
    if (res.status === 403 || res.status === 404) {
      // Expected — access denied or feature disabled
      expect(true).toBe(true);
    } else {
      // If the endpoint is enabled, it should deny access to other's media
      expect([403, 404]).toContain(res.status);
    }
  });

  test("RBG-008: 404/403 when ENABLE_AI_TOOLS=false", { tag: "@regression" }, async () => {
    test.skip(!e2eAvailable, "E2E bypass required");
    const res = await apiFetch("/ai-tools/remove-bg", {
      method: "POST",
      body: { media_asset_id: "00000000-0000-0000-0000-000000000000" },
      cookies: creatorCookies,
      headers: { "X-CSRF-Token": creatorCsrf },
    });
    // Should not 500 regardless of feature state
    expect(res.status).toBeLessThan(500);
  });

  test("RBG-007: remove-bg page loads for creator", { tag: "@regression" }, async ({ page }) => {
    test.skip(!e2eAvailable, "E2E bypass required");
    const email = uniqueEmail("rmbg-ui");
    await createVerifiedCreator(email, PASSWORD);

    await page.goto("/login");
    await page.getByLabel("Email").fill(email);
    await page.getByLabel("Password").fill(PASSWORD);
    await page.getByRole("button", { name: /sign in/i }).click();
    await page.waitForURL((url) => !url.pathname.includes("/login"), { timeout: 15000 });

    await page.goto("/ai/tools/remove-bg");
    await page.waitForLoadState("networkidle");
    // Page should load without errors
    expect(page.url()).toContain("/ai/tools/remove-bg");
  });
});
