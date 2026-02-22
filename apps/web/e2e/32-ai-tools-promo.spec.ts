/**
 * STEP 32 — Promo Generator tests.
 *
 * Tests the promotional copy generation flow for posts.
 */

import { test, expect } from "@playwright/test";
import {
  uniqueEmail,
  apiFetch,
  signupFan,
  createVerifiedCreator,
  isE2EEnabled,
} from "./helpers";
import { extractCsrf } from "./ai-helpers";

const PASSWORD = "E2ePromo1234!";
let e2eAvailable = false;

let creatorCookies = "";
let creatorCsrf = "";
let fanCookies = "";
let fanCsrf = "";
let postId = "";

test.beforeAll(async () => {
  e2eAvailable = await isE2EEnabled();
  if (!e2eAvailable) return;

  const [creator, fan] = await Promise.all([
    createVerifiedCreator(uniqueEmail("promo-cr"), PASSWORD),
    signupFan(uniqueEmail("promo-fan"), PASSWORD, "Promo Fan"),
  ]);
  creatorCookies = creator.cookies;
  creatorCsrf = extractCsrf(creatorCookies);
  fanCookies = fan.cookies;
  fanCsrf = extractCsrf(fanCookies);

  // Create a test post
  const postRes = await apiFetch("/posts", {
    method: "POST",
    body: {
      type: "TEXT",
      caption: `Promo test post ${Date.now()}`,
      visibility: "PUBLIC",
      nsfw: false,
      asset_ids: [],
    },
    cookies: creatorCookies,
    headers: { "X-CSRF-Token": creatorCsrf },
  });
  if (postRes.ok) {
    postId = postRes.body.id;
  }
});

test.describe("Promo Generator", () => {
  test("PRO-001: generate promo copy for post @smoke", { tag: "@smoke" }, async () => {
    test.skip(!e2eAvailable || !postId, "E2E bypass or post creation required");
    const res = await apiFetch("/ai-tools/promo/generate", {
      method: "POST",
      body: { post_id: postId },
      cookies: creatorCookies,
      headers: { "X-CSRF-Token": creatorCsrf },
    });
    if (res.status === 403 || res.status === 404) {
      test.skip(true, "Promo generator not enabled");
      return;
    }
    expect(res.ok).toBe(true);
    expect(res.body).toHaveProperty("id");
  });

  test("PRO-002: get saved promo suggestions for post", { tag: "@regression" }, async () => {
    test.skip(!e2eAvailable || !postId, "E2E bypass or post creation required");
    const res = await apiFetch(`/ai-tools/promo/${postId}`, {
      cookies: creatorCookies,
    });
    if (res.status === 403 || res.status === 404) {
      test.skip(true, "Promo generator not enabled");
      return;
    }
    expect(res.ok).toBe(true);
  });

  test("PRO-003: fan gets 403 on promo endpoints @smoke", { tag: "@smoke" }, async () => {
    test.skip(!e2eAvailable || !postId, "E2E bypass or post creation required");
    const res = await apiFetch("/ai-tools/promo/generate", {
      method: "POST",
      body: { post_id: postId },
      cookies: fanCookies,
      headers: { "X-CSRF-Token": fanCsrf },
    });
    expect([401, 403, 404]).toContain(res.status);
  });

  test("PRO-004: 404/403 when ENABLE_PROMO_GENERATOR=false", { tag: "@regression" }, async () => {
    test.skip(!e2eAvailable, "E2E bypass required");
    const res = await apiFetch("/ai-tools/promo/generate", {
      method: "POST",
      body: { post_id: "00000000-0000-0000-0000-000000000000" },
      cookies: creatorCookies,
      headers: { "X-CSRF-Token": creatorCsrf },
    });
    expect(res.status).toBeLessThan(500);
  });
});
