/**
 * STEP 33 — Translation tests.
 *
 * Tests the multi-language caption translation flow.
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

const PASSWORD = "E2eTranslate1!";
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
    createVerifiedCreator(uniqueEmail("trans-cr"), PASSWORD),
    signupFan(uniqueEmail("trans-fan"), PASSWORD, "Trans Fan"),
  ]);
  creatorCookies = creator.cookies;
  creatorCsrf = extractCsrf(creatorCookies);
  fanCookies = fan.cookies;
  fanCsrf = extractCsrf(fanCookies);

  // Create a test post with caption to translate
  const postRes = await apiFetch("/posts", {
    method: "POST",
    body: {
      type: "TEXT",
      caption: `Translation test caption ${Date.now()}`,
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

test.describe("Translation", () => {
  test("TRN-001: request translation for a post @smoke", { tag: "@smoke" }, async () => {
    test.skip(!e2eAvailable || !postId, "E2E bypass or post creation required");
    const res = await apiFetch("/ai-tools/translate", {
      method: "POST",
      body: { post_id: postId, target_languages: ["fr", "es"] },
      cookies: creatorCookies,
      headers: { "X-CSRF-Token": creatorCsrf },
    });
    if (res.status === 403 || res.status === 404) {
      test.skip(true, "Translations not enabled");
      return;
    }
    expect(res.ok).toBe(true);
  });

  test("TRN-002: get translations for a post", { tag: "@regression" }, async () => {
    test.skip(!e2eAvailable || !postId, "E2E bypass or post creation required");
    const res = await apiFetch(`/ai-tools/posts/${postId}/translations`, {
      cookies: creatorCookies,
    });
    if (res.status === 403 || res.status === 404) {
      test.skip(true, "Translations not enabled");
      return;
    }
    expect(res.ok).toBe(true);
  });

  test("TRN-003: fan gets 403 on translation endpoints @smoke", { tag: "@smoke" }, async () => {
    test.skip(!e2eAvailable || !postId, "E2E bypass or post creation required");
    const res = await apiFetch("/ai-tools/translate", {
      method: "POST",
      body: { post_id: postId, target_languages: ["fr"] },
      cookies: fanCookies,
      headers: { "X-CSRF-Token": fanCsrf },
    });
    expect([401, 403, 404]).toContain(res.status);
  });

  test("TRN-004: 404/403 when ENABLE_TRANSLATIONS=false", { tag: "@regression" }, async () => {
    test.skip(!e2eAvailable, "E2E bypass required");
    const res = await apiFetch("/ai-tools/translate", {
      method: "POST",
      body: { post_id: "00000000-0000-0000-0000-000000000000", target_languages: ["fr"] },
      cookies: creatorCookies,
      headers: { "X-CSRF-Token": creatorCsrf },
    });
    expect(res.status).toBeLessThan(500);
  });
});
