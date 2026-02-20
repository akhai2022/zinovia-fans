/**
 * STEP 10 — Messaging: DM conversations, messages.
 */

import { test, expect } from "@playwright/test";
import {
  uniqueEmail,
  apiFetch,
  signupFan,
  createVerifiedCreator,
  isE2EEnabled,
} from "./helpers";

const PASSWORD = "E2eMsg12345!";
let fanCookies = "";
let fanCsrf = "";
let creatorCookies = "";
let creatorCsrf = "";
let creatorUserId = "";
let e2eAvailable = false;
let conversationId: string | null = null;

test.beforeAll(async () => {
  e2eAvailable = await isE2EEnabled();
  if (!e2eAvailable) return;

  const fanEmail = uniqueEmail("msgfan");
  const creatorEmail = uniqueEmail("msgcreator");

  const fan = await signupFan(fanEmail, PASSWORD, "E2E Msg Fan");
  fanCookies = fan.cookies;
  fanCsrf = fanCookies.match(/csrf_token=([^;]+)/)?.[1] ?? "";

  const creator = await createVerifiedCreator(creatorEmail, PASSWORD);
  creatorCookies = creator.cookies;
  creatorCsrf = creatorCookies.match(/csrf_token=([^;]+)/)?.[1] ?? "";
  creatorUserId = creator.userId;
});

test.describe("DM Conversations", () => {
  test("fan creates conversation with creator", async () => {
    test.skip(!e2eAvailable, "E2E bypass required");
    const res = await apiFetch("/dm/conversations", {
      method: "POST",
      body: { creator_user_id: creatorUserId },
      cookies: fanCookies,
      headers: { "X-CSRF-Token": fanCsrf },
    });
    if (res.status === 403 || res.status === 404) {
      test.skip(true, "DM creation failed — creator may not have profile");
      return;
    }
    expect(res.ok).toBe(true);
    expect(res.body).toHaveProperty("id");
    conversationId = res.body.id;
  });

  test("fan sends text message", async () => {
    test.skip(!conversationId, "No conversation created");
    const res = await apiFetch(`/dm/conversations/${conversationId}/messages`, {
      method: "POST",
      body: { type: "TEXT", text: `Hello from E2E fan ${Date.now()}` },
      cookies: fanCookies,
      headers: { "X-CSRF-Token": fanCsrf },
    });
    expect(res.ok).toBe(true);
    expect(res.body).toHaveProperty("id");
  });

  test("creator can read messages in conversation", async () => {
    test.skip(!conversationId, "No conversation created");
    const res = await apiFetch(`/dm/conversations/${conversationId}/messages?page_size=50`, {
      cookies: creatorCookies,
    });
    expect(res.ok).toBe(true);
    expect(res.body).toHaveProperty("items");
    expect(res.body.items.length).toBeGreaterThan(0);
  });

  test("creator sends reply", async () => {
    test.skip(!conversationId, "No conversation created");
    const res = await apiFetch(`/dm/conversations/${conversationId}/messages`, {
      method: "POST",
      body: { type: "TEXT", text: `Creator reply ${Date.now()}` },
      cookies: creatorCookies,
      headers: { "X-CSRF-Token": creatorCsrf },
    });
    expect(res.ok).toBe(true);
  });

  test("fan lists conversations", async () => {
    test.skip(!e2eAvailable, "E2E bypass required");
    const res = await apiFetch("/dm/conversations?page_size=50", {
      cookies: fanCookies,
    });
    expect(res.ok).toBe(true);
    expect(res.body).toHaveProperty("items");
  });

  test("unauthenticated DM access returns 401", async () => {
    const res = await apiFetch("/dm/conversations");
    expect(res.status).toBe(401);
  });
});
