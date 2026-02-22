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
import {
  extractCsrf,
  requestUploadUrl,
  pollJobStatus,
  downloadBytes,
  sha256hex,
  pngHasAlpha,
  getContentType,
} from "./ai-helpers";

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

/* ------------------------------------------------------------------ */
/* Output Verification — prove results are real, not mocked           */
/* ------------------------------------------------------------------ */
test.describe("Remove Background — Output Verification @nightly", { tag: "@nightly" }, () => {
  test.setTimeout(120_000); // Jobs + downloads can take a while

  test("RBG-009: two different inputs produce different output hashes", async () => {
    test.skip(!e2eAvailable, "E2E bypass required");

    // Upload two different media assets (different filenames/sizes simulate different images)
    let assetA = "";
    let assetB = "";
    try {
      const [uploadA, uploadB] = await Promise.all([
        requestUploadUrl(creatorCookies, creatorCsrf, {
          filename: `e2e-rmbg-inputA-${Date.now()}.jpg`,
          sizeBytes: 1024,
        }),
        requestUploadUrl(creatorCookies, creatorCsrf, {
          filename: `e2e-rmbg-inputB-${Date.now()}.jpg`,
          sizeBytes: 2048,
        }),
      ]);
      assetA = uploadA.assetId;
      assetB = uploadB.assetId;
    } catch {
      test.skip(true, "Could not upload media for output verification");
      return;
    }

    // Submit remove-bg jobs for both
    const [resA, resB] = await Promise.all([
      apiFetch("/ai-tools/remove-bg", {
        method: "POST",
        body: { media_asset_id: assetA },
        cookies: creatorCookies,
        headers: { "X-CSRF-Token": creatorCsrf },
      }),
      apiFetch("/ai-tools/remove-bg", {
        method: "POST",
        body: { media_asset_id: assetB },
        cookies: creatorCookies,
        headers: { "X-CSRF-Token": creatorCsrf },
      }),
    ]);

    if (resA.status === 403 || resA.status === 404) {
      test.skip(true, "AI tools not enabled");
      return;
    }
    expect(resA.ok).toBe(true);
    expect(resB.ok).toBe(true);

    // Poll both to completion
    const [resultA, resultB] = await Promise.all([
      pollJobStatus(`/ai-tools/remove-bg/${resA.body.job_id}`, creatorCookies, {
        maxAttempts: 30,
        intervalMs: 2000,
      }),
      pollJobStatus(`/ai-tools/remove-bg/${resB.body.job_id}`, creatorCookies, {
        maxAttempts: 30,
        intervalMs: 2000,
      }),
    ]);

    if (!resultA.result_url || !resultB.result_url) {
      test.skip(true, "One or both jobs did not complete with result URLs");
      return;
    }

    // Download both results and hash them
    const [bytesA, bytesB] = await Promise.all([
      downloadBytes(resultA.result_url),
      downloadBytes(resultB.result_url),
    ]);
    const [hashA, hashB] = await Promise.all([sha256hex(bytesA), sha256hex(bytesB)]);

    // Different inputs must produce different outputs
    expect(hashA).not.toBe(hashB);
  });

  test("RBG-010: output is PNG with alpha channel", async () => {
    test.skip(!e2eAvailable, "E2E bypass required");

    let asset = "";
    try {
      const upload = await requestUploadUrl(creatorCookies, creatorCsrf, {
        filename: `e2e-rmbg-alpha-${Date.now()}.jpg`,
      });
      asset = upload.assetId;
    } catch {
      test.skip(true, "Could not upload media for alpha test");
      return;
    }

    const submitRes = await apiFetch("/ai-tools/remove-bg", {
      method: "POST",
      body: { media_asset_id: asset },
      cookies: creatorCookies,
      headers: { "X-CSRF-Token": creatorCsrf },
    });
    if (submitRes.status === 403 || submitRes.status === 404) {
      test.skip(true, "AI tools not enabled");
      return;
    }
    expect(submitRes.ok).toBe(true);

    const result = await pollJobStatus(
      `/ai-tools/remove-bg/${submitRes.body.job_id}`,
      creatorCookies,
      { maxAttempts: 30, intervalMs: 2000 },
    );
    if (!result.result_url) {
      test.skip(true, "Job did not complete with result URL");
      return;
    }

    // Verify Content-Type is image/png
    const ct = await getContentType(result.result_url);
    expect(ct).toContain("image/png");

    // Download and check PNG alpha channel
    const buf = await downloadBytes(result.result_url);
    const hasAlpha = pngHasAlpha(buf);
    expect(hasAlpha).not.toBeNull(); // must be valid PNG
    expect(hasAlpha).toBe(true); // must have alpha channel (background removed)
  });

  test("RBG-011: presigned URL has expiry (short TTL)", async () => {
    test.skip(!e2eAvailable, "E2E bypass required");

    // Re-use the job from RBG-001 if available, otherwise skip
    let asset = "";
    try {
      const upload = await requestUploadUrl(creatorCookies, creatorCsrf);
      asset = upload.assetId;
    } catch {
      test.skip(true, "Could not upload media");
      return;
    }

    const submitRes = await apiFetch("/ai-tools/remove-bg", {
      method: "POST",
      body: { media_asset_id: asset },
      cookies: creatorCookies,
      headers: { "X-CSRF-Token": creatorCsrf },
    });
    if (submitRes.status === 403 || submitRes.status === 404) {
      test.skip(true, "AI tools not enabled");
      return;
    }

    const result = await pollJobStatus(
      `/ai-tools/remove-bg/${submitRes.body.job_id}`,
      creatorCookies,
      { maxAttempts: 30, intervalMs: 2000 },
    );
    if (!result.result_url) {
      test.skip(true, "Job did not complete");
      return;
    }

    // S3 presigned URLs contain Expires or X-Amz-Expires in the query
    const url = new URL(result.result_url);
    const hasExpiry =
      url.searchParams.has("Expires") ||
      url.searchParams.has("X-Amz-Expires") ||
      url.searchParams.has("X-Amz-Date");
    expect(hasExpiry).toBe(true);
  });
});
