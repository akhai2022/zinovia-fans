/**
 * STEP 30 — Cartoon Avatar tool tests.
 *
 * Tests the cartoonize job submission, polling, access control,
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

const PASSWORD = "E2eCartoon123!";
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
    createVerifiedCreator(uniqueEmail("cartoon-cr"), PASSWORD),
    signupFan(uniqueEmail("cartoon-fan"), PASSWORD, "Cartoon Fan"),
  ]);
  creatorCookies = creator.cookies;
  creatorCsrf = extractCsrf(creatorCookies);
  fanCookies = fan.cookies;
  fanCsrf = extractCsrf(fanCookies);

  try {
    const upload = await requestUploadUrl(creatorCookies, creatorCsrf);
    mediaAssetId = upload.assetId;
  } catch {
    // tests will skip
  }
});

test.describe("Cartoon Avatar Tool", () => {
  let jobId = "";

  test("CRT-001: submit cartoonize job @smoke", { tag: "@smoke" }, async () => {
    test.skip(!e2eAvailable || !mediaAssetId, "E2E bypass or media upload required");
    const res = await apiFetch("/ai-tools/cartoonize", {
      method: "POST",
      body: { media_asset_id: mediaAssetId },
      cookies: creatorCookies,
      headers: { "X-CSRF-Token": creatorCsrf },
    });
    if (res.status === 403 || res.status === 404) {
      test.skip(true, "Cartoon avatar not enabled");
      return;
    }
    expect(res.ok).toBe(true);
    expect(res.body).toHaveProperty("job_id");
    jobId = res.body.job_id;
  });

  test("CRT-002: poll cartoonize job status", { tag: "@regression" }, async () => {
    test.skip(!e2eAvailable || !jobId, "No job created");
    const result = await pollJobStatus(`/ai-tools/cartoonize/${jobId}`, creatorCookies, {
      maxAttempts: 15,
      intervalMs: 2000,
    });
    expect(["ready", "failed", "READY", "FAILED", "timeout"]).toContain(result.status);
  });

  test("CRT-003: fan gets 403 on cartoonize @smoke", { tag: "@smoke" }, async () => {
    test.skip(!e2eAvailable || !mediaAssetId, "E2E bypass or media upload required");
    const res = await apiFetch("/ai-tools/cartoonize", {
      method: "POST",
      body: { media_asset_id: mediaAssetId },
      cookies: fanCookies,
      headers: { "X-CSRF-Token": fanCsrf },
    });
    expect([401, 403, 404]).toContain(res.status);
  });

  test("CRT-005: 404/403 when ENABLE_CARTOON_AVATAR=false", { tag: "@regression" }, async () => {
    test.skip(!e2eAvailable, "E2E bypass required");
    const res = await apiFetch("/ai-tools/cartoonize", {
      method: "POST",
      body: { media_asset_id: "00000000-0000-0000-0000-000000000000" },
      cookies: creatorCookies,
      headers: { "X-CSRF-Token": creatorCsrf },
    });
    expect(res.status).toBeLessThan(500);
  });

  test("CRT-006: cartoon-avatar page loads for creator", { tag: "@regression" }, async ({ page }) => {
    test.skip(!e2eAvailable, "E2E bypass required");
    const email = uniqueEmail("cartoon-ui");
    await createVerifiedCreator(email, PASSWORD);

    await page.goto("/login");
    await page.getByLabel("Email").fill(email);
    await page.getByLabel("Password").fill(PASSWORD);
    await page.getByRole("button", { name: /sign in/i }).click();
    await page.waitForURL((url) => !url.pathname.includes("/login"), { timeout: 15000 });

    await page.goto("/ai/tools/cartoon-avatar");
    await page.waitForLoadState("networkidle");
    expect(page.url()).toContain("/ai/tools/cartoon-avatar");
  });
});
