/**
 * STEP 24 — PPV purchase flow (POM-driven).
 *
 * Validates:
 *   1. Fan views PPV post (locked)
 *   2. PPV unlock intent triggers checkout
 *   3. E2E bypass: activate purchase → verify unlocked
 */

import { test, expect } from "@playwright/test";
import {
  uniqueEmail,
  apiFetch,
  signupFan,
  createVerifiedCreator,
  e2eApi,
  activatePostPurchase,
  isE2EEnabled,
} from "./helpers";

const PASSWORD = "E2ePpvFlow123!";

test.describe("PPV Purchase Flow", () => {
  let e2eAvailable = false;
  const fanEmail = uniqueEmail("ppvf-fan");
  const creatorEmail = uniqueEmail("ppvf-creator");
  let fanCookies = "";
  let fanCsrf = "";
  let ppvPostId: string | null = null;

  test.beforeAll(async () => {
    e2eAvailable = await isE2EEnabled();
    if (!e2eAvailable) return;

    // Create creator and PPV post
    const creator = await createVerifiedCreator(creatorEmail, PASSWORD);
    const creatorCookies = creator.cookies;
    const creatorCsrf =
      creatorCookies.match(/csrf_token=([^;]+)/)?.[1] ?? "";

    const postRes = await apiFetch("/posts", {
      method: "POST",
      body: {
        type: "TEXT",
        caption: `PPV flow test ${Date.now()}`,
        visibility: "PPV",
        nsfw: false,
        asset_ids: [],
        price_cents: 500,
      },
      cookies: creatorCookies,
      headers: { "X-CSRF-Token": creatorCsrf },
    });
    if (postRes.ok) {
      ppvPostId = postRes.body.id;
    }

    // Create fan
    const fan = await signupFan(fanEmail, PASSWORD, "PPV Flow Fan");
    fanCookies = fan.cookies;
    fanCsrf = fanCookies.match(/csrf_token=([^;]+)/)?.[1] ?? "";
  });

  test("PPV post is locked for fan before purchase", async () => {
    test.skip(!e2eAvailable || !ppvPostId, "E2E bypass + PPV post required");
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

  test("PPV purchase intent returns checkout URL", async () => {
    test.skip(!e2eAvailable || !ppvPostId, "E2E bypass + PPV post required");
    const res = await apiFetch(`/ppv/posts/${ppvPostId}/create-intent`, {
      method: "POST",
      body: {},
      cookies: fanCookies,
      headers: { "X-CSRF-Token": fanCsrf },
    });
    if (res.status === 404 || res.status === 501) {
      test.skip(true, "PPV or CCBill not configured");
      return;
    }
    expect(res.ok).toBe(true);
    expect(res.body).toHaveProperty("client_secret");
  });

  test("activate PPV purchase via E2E bypass", async () => {
    test.skip(!e2eAvailable || !ppvPostId, "E2E bypass + PPV post required");
    const res = await activatePostPurchase(fanEmail, ppvPostId!);
    expect(res.ok).toBe(true);
    expect(["purchased", "already_purchased"]).toContain(res.body.status);
  });

  test("PPV post is unlocked after purchase", async () => {
    test.skip(!e2eAvailable || !ppvPostId, "E2E bypass + PPV post required");
    const res = await apiFetch(`/ppv/posts/${ppvPostId}/status`, {
      cookies: fanCookies,
    });
    if (res.status === 404) {
      test.skip(true, "PPV feature disabled");
      return;
    }
    expect(res.ok).toBe(true);
    expect(res.body.is_locked).toBe(false);
  });
});
