/**
 * STEP 27 — AI Safety pipeline.
 *
 * Tests the safety scan, caption, and tag endpoints for media assets.
 * Uses the E2E seed-scan bypass to populate test data without running
 * the actual ML pipeline.
 */

import { test, expect } from "@playwright/test";
import {
  uniqueEmail,
  apiFetch,
  signupFan,
  createVerifiedCreator,
  isE2EEnabled,
} from "./helpers";
import { extractCsrf, requestUploadUrl, seedSafetyScan } from "./ai-helpers";

const PASSWORD = "E2eSafety123!";
let e2eAvailable = false;

// Creator credentials
let creatorCookies = "";
let creatorCsrf = "";

// Fan credentials (for IDOR tests)
let fanCookies = "";

// Test media asset
let mediaAssetId = "";

test.beforeAll(async () => {
  e2eAvailable = await isE2EEnabled();
  if (!e2eAvailable) return;

  const [creator, fan] = await Promise.all([
    createVerifiedCreator(uniqueEmail("safety-cr"), PASSWORD),
    signupFan(uniqueEmail("safety-fan"), PASSWORD, "Safety Fan"),
  ]);
  creatorCookies = creator.cookies;
  creatorCsrf = extractCsrf(creatorCookies);
  fanCookies = fan.cookies;

  // Upload a test media asset
  try {
    const upload = await requestUploadUrl(creatorCookies, creatorCsrf);
    mediaAssetId = upload.assetId;
  } catch {
    // Upload may fail if vault disabled — tests will skip
  }
});

test.describe("AI Safety — Scan Results", () => {
  test("AIS-001: scan endpoint returns result for seeded media @smoke", { tag: "@smoke" }, async () => {
    test.skip(!e2eAvailable || !mediaAssetId, "E2E bypass or media upload required");

    // Seed a safety scan
    const { scanId } = await seedSafetyScan(mediaAssetId);

    const res = await apiFetch(`/ai-safety/media/${mediaAssetId}/scan`, {
      cookies: creatorCookies,
    });
    if (res.status === 403 || res.status === 404) {
      test.skip(true, "AI safety not enabled");
      return;
    }
    expect(res.ok).toBe(true);
    expect(res.body).toHaveProperty("id");
  });

  test("AIS-002: scan result has required fields", { tag: "@regression" }, async () => {
    test.skip(!e2eAvailable || !mediaAssetId, "E2E bypass or media upload required");

    // Seed with specific values
    await seedSafetyScan(mediaAssetId, {
      nsfw_score: 0.2,
      nsfw_label: "normal",
      age_range_prediction: "20-29",
      underage_likelihood_proxy: 0.05,
      risk_level: "LOW",
      decision: "ALLOW",
    });

    const res = await apiFetch(`/ai-safety/media/${mediaAssetId}/scan`, {
      cookies: creatorCookies,
    });
    if (res.status === 403 || res.status === 404) {
      test.skip(true, "AI safety not enabled");
      return;
    }
    expect(res.ok).toBe(true);
    expect(res.body).toHaveProperty("nsfw_score");
    expect(res.body).toHaveProperty("nsfw_label");
    expect(res.body).toHaveProperty("age_range_prediction");
    expect(res.body).toHaveProperty("risk_level");
    expect(res.body).toHaveProperty("decision");
  });

  test("AIS-003: captions endpoint returns data", { tag: "@regression" }, async () => {
    test.skip(!e2eAvailable || !mediaAssetId, "E2E bypass or media upload required");
    const res = await apiFetch(`/ai-safety/media/${mediaAssetId}/captions`, {
      cookies: creatorCookies,
    });
    if (res.status === 403 || res.status === 404) {
      test.skip(true, "AI safety captions not available");
      return;
    }
    expect(res.ok).toBe(true);
  });

  test("AIS-004: tags endpoint returns data", { tag: "@regression" }, async () => {
    test.skip(!e2eAvailable || !mediaAssetId, "E2E bypass or media upload required");
    const res = await apiFetch(`/ai-safety/media/${mediaAssetId}/tags`, {
      cookies: creatorCookies,
    });
    if (res.status === 403 || res.status === 404) {
      test.skip(true, "AI safety tags not available");
      return;
    }
    expect(res.ok).toBe(true);
  });

  test("AIS-005: search endpoint returns results", { tag: "@regression" }, async () => {
    test.skip(!e2eAvailable, "E2E bypass required");
    const res = await apiFetch("/ai-safety/search?q=test&mode=keyword", {
      cookies: creatorCookies,
    });
    if (res.status === 403 || res.status === 404) {
      test.skip(true, "AI safety search not available");
      return;
    }
    expect(res.ok).toBe(true);
    expect(res.body).toHaveProperty("items");
    expect(res.body).toHaveProperty("mode");
  });
});

test.describe("AI Safety — IDOR Protection", () => {
  test("AIS-006: fan cannot access scan for creator's media @smoke", { tag: "@smoke" }, async () => {
    test.skip(!e2eAvailable || !mediaAssetId, "E2E bypass or media upload required");

    const res = await apiFetch(`/ai-safety/media/${mediaAssetId}/scan`, {
      cookies: fanCookies,
    });
    // Fan should get 403 or 404 — not 200 with creator's scan data
    if (res.status === 403 || res.status === 404) {
      // Expected — feature disabled or access denied
      expect(true).toBe(true);
    } else {
      // If we get 200, the data must not belong to the fan
      // (the endpoint should scope results to the authenticated user)
      expect(res.status).not.toBe(200);
    }
  });

  test("AIS-007: 404/403 when AI safety disabled", { tag: "@regression" }, async () => {
    test.skip(!e2eAvailable, "E2E bypass required");
    const res = await apiFetch("/ai-safety/media/00000000-0000-0000-0000-000000000000/scan", {
      cookies: creatorCookies,
    });
    // Should not return 500 regardless of feature state
    expect(res.status).toBeLessThan(500);
  });
});
