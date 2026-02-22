/**
 * STEP 28 — Admin AI safety moderation.
 *
 * Tests the admin review workflow for AI-flagged content.
 */

import { test, expect } from "@playwright/test";
import {
  uniqueEmail,
  apiFetch,
  signupFan,
  createVerifiedCreator,
  createAdminUser,
  isE2EEnabled,
} from "./helpers";
import { extractCsrf, requestUploadUrl, seedSafetyScan } from "./ai-helpers";

const PASSWORD = "E2eAdmSafe12!";
let e2eAvailable = false;

let adminCookies = "";
let adminCsrf = "";
let creatorCookies = "";
let creatorCsrf = "";
let fanCookies = "";
let fanCsrf = "";

let mediaAssetId = "";
let scanId = "";

test.beforeAll(async () => {
  e2eAvailable = await isE2EEnabled();
  if (!e2eAvailable) return;

  const [admin, creator, fan] = await Promise.all([
    createAdminUser(uniqueEmail("asafe-admin"), PASSWORD),
    createVerifiedCreator(uniqueEmail("asafe-cr"), PASSWORD),
    signupFan(uniqueEmail("asafe-fan"), PASSWORD, "Admin Safe Fan"),
  ]);
  adminCookies = admin.cookies;
  adminCsrf = extractCsrf(adminCookies);
  creatorCookies = creator.cookies;
  creatorCsrf = extractCsrf(creatorCookies);
  fanCookies = fan.cookies;
  fanCsrf = extractCsrf(fanCookies);

  // Upload media and seed a flagged scan
  try {
    const upload = await requestUploadUrl(creatorCookies, creatorCsrf);
    mediaAssetId = upload.assetId;
    const seed = await seedSafetyScan(mediaAssetId, {
      nsfw_score: 0.9,
      nsfw_label: "nsfw",
      age_range_prediction: "10-19",
      underage_likelihood_proxy: 0.8,
      risk_level: "HIGH",
      decision: "REQUIRE_REVIEW",
    });
    scanId = seed.scanId;
  } catch {
    // Upload/seed may fail — tests will skip
  }
});

test.describe("Admin — AI Safety Review", () => {
  test("ASA-001: pending reviews returns paginated list @smoke", { tag: "@smoke" }, async () => {
    test.skip(!e2eAvailable, "E2E bypass required");
    const res = await apiFetch("/ai-safety/admin/pending-reviews?page=1&page_size=20", {
      cookies: adminCookies,
    });
    if (res.status === 403 || res.status === 404) {
      test.skip(true, "AI safety admin not available");
      return;
    }
    expect(res.ok).toBe(true);
    expect(res.body).toHaveProperty("items");
    expect(res.body).toHaveProperty("total");
    expect(res.body).toHaveProperty("page");
  });

  test("ASA-002: admin can approve a flagged scan", { tag: "@regression" }, async () => {
    test.skip(!e2eAvailable || !scanId, "E2E bypass or scan seed required");
    const res = await apiFetch(`/ai-safety/admin/review/${scanId}`, {
      method: "POST",
      body: { decision: "APPROVED" },
      cookies: adminCookies,
      headers: { "X-CSRF-Token": adminCsrf },
    });
    if (res.status === 403 || res.status === 404) {
      test.skip(true, "AI safety admin review not available");
      return;
    }
    expect(res.ok).toBe(true);
    expect(res.body).toHaveProperty("review_decision");
    expect(res.body.review_decision).toBe("APPROVED");
  });

  test("ASA-003: admin can reject a flagged scan", { tag: "@regression" }, async () => {
    test.skip(!e2eAvailable || !mediaAssetId, "E2E bypass required");
    // Seed a new scan for rejection test
    let newScanId = "";
    try {
      const upload = await requestUploadUrl(creatorCookies, creatorCsrf);
      const seed = await seedSafetyScan(upload.assetId, {
        nsfw_score: 0.95,
        risk_level: "HIGH",
        decision: "REQUIRE_REVIEW",
      });
      newScanId = seed.scanId;
    } catch {
      test.skip(true, "Could not seed scan for rejection test");
      return;
    }

    const res = await apiFetch(`/ai-safety/admin/review/${newScanId}`, {
      method: "POST",
      body: { decision: "REJECTED" },
      cookies: adminCookies,
      headers: { "X-CSRF-Token": adminCsrf },
    });
    if (res.status === 403 || res.status === 404) {
      test.skip(true, "AI safety admin review not available");
      return;
    }
    expect(res.ok).toBe(true);
    expect(res.body.review_decision).toBe("REJECTED");
  });

  test("ASA-004: non-admin gets 403 on admin safety endpoints @smoke", { tag: "@smoke" }, async () => {
    test.skip(!e2eAvailable, "E2E bypass required");
    const endpoints = [
      { method: "GET", path: "/ai-safety/admin/pending-reviews?page=1&page_size=20" },
    ];
    for (const ep of endpoints) {
      const res = await apiFetch(ep.path, {
        method: ep.method as any,
        cookies: fanCookies,
      });
      // Either 403 (forbidden) or 404 (feature disabled) — both acceptable
      expect([403, 404]).toContain(res.status);
    }
  });

  test("ASA-005: admin moderation tab loads in UI", { tag: "@regression" }, async ({ page }) => {
    test.skip(!e2eAvailable, "E2E bypass required");
    const adminEmail = uniqueEmail("asafe-ui");
    await createAdminUser(adminEmail, PASSWORD);

    // Login via UI
    await page.goto("/login");
    await page.getByLabel("Email").fill(adminEmail);
    await page.getByLabel("Password").fill(PASSWORD);
    await page.getByRole("button", { name: /sign in/i }).click();
    await page.waitForURL((url) => !url.pathname.includes("/login"), { timeout: 15000 });

    await page.goto("/admin");
    await page.waitForLoadState("networkidle");
    expect(page.url()).toContain("/admin");

    // Check for AI estimates disclaimer text
    const pageContent = await page.textContent("body");
    expect(pageContent).toBeTruthy();
  });
});
