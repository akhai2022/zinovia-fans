/**
 * STEP 19 — Cross-persona end-to-end flow:
 * Creator creates post -> Fan subscribes -> Fan sees post in feed.
 */

import { test, expect } from "@playwright/test";
import {
  uniqueEmail,
  apiFetch,
  signupFan,
  createVerifiedCreator,
  e2eApi,
  isE2EEnabled,
} from "./helpers";

const PASSWORD = "E2eCross1234!";
let e2eAvailable = false;

test.beforeAll(async () => {
  e2eAvailable = await isE2EEnabled();
});

test.describe("Cross-Persona: Creator -> Fan Subscription -> Feed", () => {
  const fanEmail = uniqueEmail("crossfan");
  const creatorEmail = uniqueEmail("crosscreator");
  let fanCookies = "";
  let creatorCookies = "";
  let creatorCsrf = "";
  let postId: string | null = null;

  test("1. creator creates a public post", async () => {
    test.skip(!e2eAvailable, "E2E bypass required for cross-persona test");
    const creator = await createVerifiedCreator(creatorEmail, PASSWORD);
    creatorCookies = creator.cookies;
    creatorCsrf = creatorCookies.match(/csrf_token=([^;]+)/)?.[1] ?? "";

    const res = await apiFetch("/posts", {
      method: "POST",
      body: {
        type: "TEXT",
        caption: `Cross-persona test post ${Date.now()}`,
        visibility: "PUBLIC",
        nsfw: false,
        asset_ids: [],
      },
      cookies: creatorCookies,
      headers: { "X-CSRF-Token": creatorCsrf },
    });
    if (res.status === 403) {
      test.skip(true, "Creator profile required");
      return;
    }
    expect(res.ok).toBe(true);
    postId = res.body.id;
  });

  test("2. fan signs up and subscribes (via E2E bypass)", async () => {
    test.skip(!e2eAvailable || !postId, "Requires E2E bypass and created post");
    const fan = await signupFan(fanEmail, PASSWORD, "Cross Fan");
    fanCookies = fan.cookies;

    // Activate subscription via E2E bypass
    const sub = await e2eApi("/billing/activate-subscription", {
      query: { fan_email: fanEmail, creator_email: creatorEmail },
    });
    expect(sub.ok).toBe(true);
    expect(["activated", "already_active"]).toContain(sub.body.status);
  });

  test("3. fan sees creator post in feed", async () => {
    test.skip(!fanCookies || !postId, "Requires fan session and post");
    const feed = await apiFetch("/feed?page=1&page_size=50", {
      cookies: fanCookies,
    });
    expect(feed.ok).toBe(true);
    expect(feed.body.items).toBeDefined();
    // The post should appear in the fan's feed
    const found = feed.body.items.some((item: any) => item.id === postId);
    expect(found).toBe(true);
  });

  test("4. fan can see creator in subscriptions", async () => {
    test.skip(!fanCookies, "Requires fan session");
    const status = await apiFetch("/billing/status", { cookies: fanCookies });
    expect(status.ok).toBe(true);
    expect(status.body.items.length).toBeGreaterThan(0);
    const activeSub = status.body.items.find((s: any) => s.status === "active");
    expect(activeSub).toBeTruthy();
  });
});
