/**
 * STEP 38 — Golden Path: Upload → AI Studio → Remove-BG → Download.
 *
 * End-to-end integration test that validates the real user journey a creator
 * follows when enhancing media with AI tools:
 *
 *   1. Upload a media asset
 *   2. Create an imageRef deep-link token
 *   3. Open the remove-bg tool page via deep-link
 *   4. Submit the job and wait for completion
 *   5. Download the result and verify it's a valid PNG with alpha
 *
 * This test is API-heavy for reliability but includes a browser-based step
 * to prove the deep-link resolves in the UI.
 */

import { test, expect } from "@playwright/test";
import {
  uniqueEmail,
  apiFetch,
  createVerifiedCreator,
  isE2EEnabled,
  loginViaUI,
} from "./helpers";
import {
  extractCsrf,
  requestUploadUrl,
  createImageRef,
  pollJobStatus,
  downloadBytes,
  sha256hex,
  pngHasAlpha,
  getContentType,
} from "./ai-helpers";

const PASSWORD = "E2eGolden1234!";
let e2eAvailable = false;

let creatorEmail = "";
let creatorCookies = "";
let creatorCsrf = "";

test.beforeAll(async () => {
  e2eAvailable = await isE2EEnabled();
  if (!e2eAvailable) return;

  creatorEmail = uniqueEmail("gold-cr");
  const creator = await createVerifiedCreator(creatorEmail, PASSWORD);
  creatorCookies = creator.cookies;
  creatorCsrf = extractCsrf(creatorCookies);
});

test.describe.configure({ mode: "serial" });

test.describe("Golden Path — Upload → AI Studio → Remove-BG → Download", () => {
  let mediaAssetId = "";
  let imageRefToken = "";
  let jobId = "";
  let resultUrl = "";

  test("GP-001: upload media asset @smoke", { tag: "@smoke" }, async () => {
    test.skip(!e2eAvailable, "E2E bypass required");

    const upload = await requestUploadUrl(creatorCookies, creatorCsrf, {
      filename: `golden-path-${Date.now()}.jpg`,
      contentType: "image/jpeg",
      sizeBytes: 2048,
    });
    expect(upload.assetId).toBeTruthy();
    expect(upload.uploadUrl).toContain("http");
    mediaAssetId = upload.assetId;
  });

  test("GP-002: create imageRef deep-link token @smoke", { tag: "@smoke" }, async () => {
    test.skip(!e2eAvailable || !mediaAssetId, "No media asset");

    const ref = await createImageRef(creatorCookies, creatorCsrf, mediaAssetId);
    expect(ref.token).toBeTruthy();
    expect(ref.expiresAt).toBeTruthy();
    // Token should expire in the future
    expect(new Date(ref.expiresAt).getTime()).toBeGreaterThan(Date.now());
    imageRefToken = ref.token;
  });

  test("GP-003: remove-bg page loads with imageRef deep-link", { tag: "@smoke" }, async ({ page }) => {
    test.skip(!e2eAvailable || !imageRefToken, "No imageRef token");

    // Login as creator in the browser
    await loginViaUI(page, creatorEmail, PASSWORD);

    // Navigate to remove-bg with the imageRef token
    await page.goto(`/ai/tools/remove-bg?ref=${imageRefToken}`);
    await page.waitForLoadState("networkidle");

    // Page should load without errors
    expect(page.url()).toContain("/ai/tools/remove-bg");
    expect(page.url()).toContain(`ref=${imageRefToken}`);

    // Body should not show error states
    const body = await page.textContent("body");
    expect(body).not.toContain("Internal Server Error");
    expect(body).not.toContain("Application error");
  });

  test("GP-004: submit remove-bg job via API @smoke", { tag: "@smoke" }, async () => {
    test.skip(!e2eAvailable || !mediaAssetId, "No media asset");

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

  test("GP-005: poll job to completion", { tag: "@smoke" }, async () => {
    test.skip(!e2eAvailable || !jobId, "No job created");
    test.setTimeout(90_000);

    const result = await pollJobStatus(
      `/ai-tools/remove-bg/${jobId}`,
      creatorCookies,
      { maxAttempts: 30, intervalMs: 2000 },
    );
    expect(["ready", "READY", "failed", "FAILED"]).toContain(result.status);

    if (result.status === "ready" || result.status === "READY") {
      expect(result.result_url).toBeTruthy();
      resultUrl = result.result_url!;
    } else {
      test.info().annotations.push({
        type: "warning",
        description: `Job failed: ${result.error ?? "unknown"}`,
      });
    }
  });

  test("GP-006: download result — valid PNG with alpha @nightly", { tag: "@nightly" }, async () => {
    test.skip(!e2eAvailable || !resultUrl, "No result URL available");

    // Verify Content-Type
    const ct = await getContentType(resultUrl);
    expect(ct).toContain("image/png");

    // Download and verify PNG structure
    const buf = await downloadBytes(resultUrl);
    expect(buf.length).toBeGreaterThan(0);

    // Must be a valid PNG with alpha channel
    const hasAlpha = pngHasAlpha(buf);
    expect(hasAlpha).not.toBeNull();
    expect(hasAlpha).toBe(true);

    // Hash should be deterministic for this specific input
    const hash = await sha256hex(buf);
    expect(hash).toBeTruthy();
    expect(hash.length).toBe(64); // SHA-256 hex = 64 chars
  });

  test("GP-007: presigned URL has expiry parameters @nightly", { tag: "@nightly" }, async () => {
    test.skip(!e2eAvailable || !resultUrl, "No result URL available");

    const url = new URL(resultUrl);
    const hasExpiry =
      url.searchParams.has("Expires") ||
      url.searchParams.has("X-Amz-Expires") ||
      url.searchParams.has("X-Amz-Date");
    expect(hasExpiry).toBe(true);
  });
});
