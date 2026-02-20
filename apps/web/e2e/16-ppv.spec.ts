/**
 * STEP 16 — PPV (Pay-Per-View) purchase intents.
 * Feature-flagged: ENABLE_PPV_POSTS, ENABLE_PPVM.
 */

import { test, expect } from "@playwright/test";
import {
  uniqueEmail,
  apiFetch,
  signupFan,
  createVerifiedCreator,
  isE2EEnabled,
} from "./helpers";

const PASSWORD = "E2ePpv12345!";
let fanCookies = "";
let creatorCookies = "";
let creatorCsrf = "";
let e2eAvailable = false;

test.beforeAll(async () => {
  e2eAvailable = await isE2EEnabled();
  if (!e2eAvailable) return;

  const fanEmail = uniqueEmail("ppvfan");
  const fan = await signupFan(fanEmail, PASSWORD, "PPV Fan");
  fanCookies = fan.cookies;

  const creatorEmail = uniqueEmail("ppvcreator");
  const creator = await createVerifiedCreator(creatorEmail, PASSWORD);
  creatorCookies = creator.cookies;
  creatorCsrf = creatorCookies.match(/csrf_token=([^;]+)/)?.[1] ?? "";
});

test.describe("PPV Posts", () => {
  let ppvPostId: string | null = null;

  test("creator creates PPV post", async () => {
    test.skip(!e2eAvailable, "E2E bypass required");
    const res = await apiFetch("/posts", {
      method: "POST",
      body: {
        type: "TEXT",
        caption: `PPV E2E post ${Date.now()}`,
        visibility: "PPV",
        nsfw: false,
        asset_ids: [],
        price_cents: 500,
      },
      cookies: creatorCookies,
      headers: { "X-CSRF-Token": creatorCsrf },
    });
    if (res.status === 400 || res.status === 403) {
      test.skip(true, "PPV posts disabled or creator not verified");
      return;
    }
    expect(res.ok).toBe(true);
    ppvPostId = res.body.id;
  });

  test("fan checks PPV post status (locked)", async () => {
    test.skip(!ppvPostId, "No PPV post created");
    const res = await apiFetch(`/ppv/posts/${ppvPostId}/status`, {
      cookies: fanCookies,
    });
    if (res.status === 404) {
      test.skip(true, "PPV feature disabled");
      return;
    }
    expect(res.ok).toBe(true);
    expect(res.body.is_locked).toBe(true);
  });

  test("fan creates PPV purchase intent", async () => {
    test.skip(!ppvPostId, "No PPV post created");
    const csrf = fanCookies.match(/csrf_token=([^;]+)/)?.[1] ?? "";
    const res = await apiFetch(`/ppv/posts/${ppvPostId}/create-intent`, {
      method: "POST",
      body: {},
      cookies: fanCookies,
      headers: { "X-CSRF-Token": csrf },
    });
    if (res.status === 404) {
      test.skip(true, "PPV feature disabled");
      return;
    }
    // May fail if CCBill is not configured
    if (res.status === 501) {
      test.skip(true, "CCBill not configured for PPV");
      return;
    }
    expect(res.ok).toBe(true);
    expect(res.body).toHaveProperty("client_secret");
  });
});
