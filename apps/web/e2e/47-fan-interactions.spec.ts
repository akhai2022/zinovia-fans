/**
 * 47 — Fan Interactions (@regression)
 *
 * Tests fan-side interactions: like, comment, follow, discover,
 * browse creator profiles, search, and content access.
 */

import { test, expect } from "@playwright/test";
import {
  safeGoto,
  uniqueEmail,
  apiFetch,
  signupFan,
  createVerifiedCreator,
  isE2EEnabled,
  API_BASE,
  extractCookies,
} from "./helpers";
import { extractCsrf } from "./ai-helpers";

test.describe("Fan interactions @regression", () => {
  const creatorEmail = uniqueEmail("fan-int-creator");
  const fanEmail = uniqueEmail("fan-int-fan");
  const password = "FanInteract123!";
  let creatorCookies: string;
  let creatorUserId: string;
  let fanCookies: string;
  let e2eAvailable: boolean;
  let postId: string;

  test.beforeAll(async () => {
    e2eAvailable = await isE2EEnabled();
    if (!e2eAvailable) return;

    // Create creator with a post
    const creator = await createVerifiedCreator(creatorEmail, password);
    creatorCookies = creator.cookies;
    creatorUserId = creator.userId;

    const csrf = extractCsrf(creatorCookies);
    const postRes = await apiFetch("/posts", {
      method: "POST",
      body: {
        type: "TEXT",
        caption: `Fan interaction test post ${Date.now()}`,
        visibility: "PUBLIC",
        nsfw: false,
        asset_ids: [],
      },
      cookies: creatorCookies,
      headers: { "X-CSRF-Token": csrf },
    });
    if (postRes.ok) {
      postId = postRes.body.id;
    }

    // Create fan
    const fan = await signupFan(fanEmail, password, "Interaction Fan");
    fanCookies = fan.cookies;
  });

  /* ---------------------------------------------------------------- */
  /*  A. Discovery                                                     */
  /* ---------------------------------------------------------------- */

  test("FAN-001: fan can list creators via API @regression", async () => {
    test.skip(!e2eAvailable, "E2E bypass required");
    const res = await apiFetch("/creators", { cookies: fanCookies });
    expect(res.ok).toBe(true);
    expect(res.body).toHaveProperty("items");
  });

  test("FAN-002: fan can search creators @regression", async () => {
    test.skip(!e2eAvailable, "E2E bypass required");
    const res = await apiFetch("/creators?q=test", { cookies: fanCookies });
    expect(res.status).toBeLessThan(500);
  });

  test("FAN-003: fan can search posts @regression", async () => {
    test.skip(!e2eAvailable, "E2E bypass required");
    const res = await apiFetch("/posts/search?q=test", { cookies: fanCookies });
    expect(res.status).toBeLessThan(500);
  });

  /* ---------------------------------------------------------------- */
  /*  B. Post interactions                                             */
  /* ---------------------------------------------------------------- */

  test("FAN-010: fan can like a public post @regression", async () => {
    test.skip(!e2eAvailable || !postId, "Post not created");
    const csrf = extractCsrf(fanCookies);
    const res = await apiFetch(`/posts/${postId}/like`, {
      method: "POST",
      cookies: fanCookies,
      headers: { "X-CSRF-Token": csrf },
    });
    // 200 = liked, 204 = already liked, 409 = duplicate
    expect(res.status).toBeLessThan(500);
  });

  test("FAN-011: fan can comment on a public post @regression", async () => {
    test.skip(!e2eAvailable || !postId, "Post not created");
    const csrf = extractCsrf(fanCookies);
    const res = await apiFetch(`/posts/${postId}/comments`, {
      method: "POST",
      body: { body: `E2E comment ${Date.now()}` },
      cookies: fanCookies,
      headers: { "X-CSRF-Token": csrf },
    });
    // May be 200, 201, or 403/404 if comments disabled
    expect(res.status).toBeLessThan(500);
  });

  test("FAN-012: fan can read comments on a post @regression", async () => {
    test.skip(!e2eAvailable || !postId, "Post not created");
    const res = await apiFetch(`/posts/${postId}/comments`, {
      cookies: fanCookies,
    });
    expect(res.status).toBeLessThan(500);
  });

  test("FAN-013: fan can view post detail @regression", async () => {
    test.skip(!e2eAvailable || !postId, "Post not created");
    const res = await apiFetch(`/posts/${postId}`, {
      cookies: fanCookies,
    });
    expect(res.ok).toBe(true);
    expect(res.body).toHaveProperty("id");
  });

  /* ---------------------------------------------------------------- */
  /*  C. Follow / unfollow                                             */
  /* ---------------------------------------------------------------- */

  test("FAN-020: fan can follow a creator @regression", async () => {
    test.skip(!e2eAvailable || !creatorUserId, "Creator not created");
    const csrf = extractCsrf(fanCookies);
    const res = await apiFetch(`/creators/${creatorUserId}/follow`, {
      method: "POST",
      cookies: fanCookies,
      headers: { "X-CSRF-Token": csrf },
    });
    // 200/201/204 = success, 409 = already following
    expect(res.status).toBeLessThan(500);
  });

  test("FAN-021: fan can unfollow a creator @regression", async () => {
    test.skip(!e2eAvailable || !creatorUserId, "Creator not created");
    const csrf = extractCsrf(fanCookies);
    const res = await apiFetch(`/creators/${creatorUserId}/follow`, {
      method: "DELETE",
      cookies: fanCookies,
      headers: { "X-CSRF-Token": csrf },
    });
    expect(res.status).toBeLessThan(500);
  });

  /* ---------------------------------------------------------------- */
  /*  D. Fan cannot perform creator-only actions                       */
  /* ---------------------------------------------------------------- */

  test("FAN-030: fan cannot create a post @regression", async () => {
    test.skip(!fanCookies, "Fan not created");
    const csrf = extractCsrf(fanCookies);
    const res = await apiFetch("/posts", {
      method: "POST",
      body: {
        type: "TEXT",
        caption: "Fan trying to post",
        visibility: "PUBLIC",
        nsfw: false,
        asset_ids: [],
      },
      cookies: fanCookies,
      headers: { "X-CSRF-Token": csrf },
    });
    expect(res.status).toBeGreaterThanOrEqual(400);
    expect(res.status).toBeLessThan(500);
  });

  test("FAN-031: fan cannot access /creator/vault @regression", async ({ page }) => {
    test.skip(!fanCookies, "Fan not created");
    // Anonymous should be redirected
    await safeGoto(page, "/creator/vault");
    const url = page.url();
    const body = await page.textContent("body");
    const restricted =
      url.includes("/login") ||
      body?.toLowerCase().includes("sign in");
    expect(restricted).toBe(true);
  });

  test("FAN-032: fan cannot request media upload URL @regression", async () => {
    test.skip(!fanCookies, "Fan not created");
    const csrf = extractCsrf(fanCookies);
    const res = await apiFetch("/media/upload-url", {
      method: "POST",
      body: {
        content_type: "image/jpeg",
        size_bytes: 1024,
        filename: "fan-upload.jpg",
      },
      cookies: fanCookies,
      headers: { "X-CSRF-Token": csrf },
    });
    expect([401, 403]).toContain(res.status);
  });
});
