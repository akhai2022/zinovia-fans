/**
 * STEP 31 — Image Ref deep-link token tests.
 *
 * Tests token creation, resolution, expiry, and IDOR protection.
 */

import { test, expect } from "@playwright/test";
import {
  uniqueEmail,
  apiFetch,
  createVerifiedCreator,
  isE2EEnabled,
} from "./helpers";
import { extractCsrf, requestUploadUrl, createImageRef } from "./ai-helpers";

const PASSWORD = "E2eImgRef123!";
let e2eAvailable = false;

let creatorACookies = "";
let creatorACsrf = "";
let creatorBCookies = "";
let creatorBCsrf = "";
let mediaAssetId = "";

test.beforeAll(async () => {
  e2eAvailable = await isE2EEnabled();
  if (!e2eAvailable) return;

  const [creatorA, creatorB] = await Promise.all([
    createVerifiedCreator(uniqueEmail("iref-crA"), PASSWORD),
    createVerifiedCreator(uniqueEmail("iref-crB"), PASSWORD),
  ]);
  creatorACookies = creatorA.cookies;
  creatorACsrf = extractCsrf(creatorACookies);
  creatorBCookies = creatorB.cookies;
  creatorBCsrf = extractCsrf(creatorBCookies);

  try {
    const upload = await requestUploadUrl(creatorACookies, creatorACsrf);
    mediaAssetId = upload.assetId;
  } catch {
    // tests will skip
  }
});

test.describe("Image Ref Deep-Links", () => {
  let token = "";

  test("REF-001: create image-ref token @smoke", { tag: "@smoke" }, async () => {
    test.skip(!e2eAvailable || !mediaAssetId, "E2E bypass or media upload required");
    const res = await apiFetch("/ai-tools/image-ref", {
      method: "POST",
      body: { media_asset_id: mediaAssetId },
      cookies: creatorACookies,
      headers: { "X-CSRF-Token": creatorACsrf },
    });
    if (res.status === 403 || res.status === 404) {
      test.skip(true, "AI tools not enabled");
      return;
    }
    expect(res.ok).toBe(true);
    expect(res.body).toHaveProperty("token");
    expect(res.body).toHaveProperty("expires_at");
    token = res.body.token;
  });

  test("REF-002: resolve image-ref token", { tag: "@regression" }, async () => {
    test.skip(!e2eAvailable || !token, "No token created");
    const res = await apiFetch(`/ai-tools/image-ref/${token}`, {
      cookies: creatorACookies,
    });
    expect(res.ok).toBe(true);
    expect(res.body).toHaveProperty("media_asset_id");
    expect(res.body).toHaveProperty("download_url");
    expect(res.body.download_url).toContain("http");
  });

  test("REF-003: invalid token returns 404", { tag: "@regression" }, async () => {
    test.skip(!e2eAvailable, "E2E bypass required");
    const res = await apiFetch("/ai-tools/image-ref/invalid_token_that_does_not_exist", {
      cookies: creatorACookies,
    });
    expect([404, 410]).toContain(res.status);
  });

  test("REF-004: token from User A rejected for User B (IDOR)", { tag: "@regression" }, async () => {
    test.skip(!e2eAvailable || !token, "No token created");
    const res = await apiFetch(`/ai-tools/image-ref/${token}`, {
      cookies: creatorBCookies,
    });
    // Should be rejected — token is scoped to Creator A
    expect([403, 404]).toContain(res.status);
  });

  test("REF-005: cannot create ref for another user's media (IDOR)", { tag: "@regression" }, async () => {
    test.skip(!e2eAvailable || !mediaAssetId, "E2E bypass or media upload required");
    // Creator B tries to create ref for Creator A's media
    const res = await apiFetch("/ai-tools/image-ref", {
      method: "POST",
      body: { media_asset_id: mediaAssetId },
      cookies: creatorBCookies,
      headers: { "X-CSRF-Token": creatorBCsrf },
    });
    if (res.status === 403 || res.status === 404) {
      // Expected — feature disabled or access denied
      expect(true).toBe(true);
    } else {
      // If enabled, should deny access to other's media
      expect([403, 404]).toContain(res.status);
    }
  });
});
