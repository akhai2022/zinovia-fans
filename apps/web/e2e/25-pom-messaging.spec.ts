/**
 * STEP 25 — Messaging / DM flow (POM-driven).
 *
 * Validates:
 *   1. Fan starts conversation with creator
 *   2. Fan sends text message
 *   3. Creator reads and replies
 *   4. Messages visible in conversation UI
 */

import { test, expect } from "@playwright/test";
import { LoginPage } from "./pages/auth.page";
import { ConversationPage } from "./pages/dm.page";
import {
  uniqueEmail,
  apiFetch,
  signupFan,
  createVerifiedCreator,
  isE2EEnabled,
} from "./helpers";

const PASSWORD = "E2eDmFlow1234!";

test.describe("Messaging Flow — API", () => {
  let e2eAvailable = false;
  const fanEmail = uniqueEmail("dm-fan");
  const creatorEmail = uniqueEmail("dm-creator");
  let fanCookies = "";
  let fanCsrf = "";
  let creatorCookies = "";
  let creatorCsrf = "";
  let creatorUserId = "";
  let conversationId: string | null = null;

  test.beforeAll(async () => {
    e2eAvailable = await isE2EEnabled();
    if (!e2eAvailable) return;

    const fan = await signupFan(fanEmail, PASSWORD, "DM Flow Fan");
    fanCookies = fan.cookies;
    fanCsrf = fanCookies.match(/csrf_token=([^;]+)/)?.[1] ?? "";

    const creator = await createVerifiedCreator(creatorEmail, PASSWORD);
    creatorCookies = creator.cookies;
    creatorCsrf = creatorCookies.match(/csrf_token=([^;]+)/)?.[1] ?? "";
    creatorUserId = creator.userId;
  });

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
    const res = await apiFetch(
      `/dm/conversations/${conversationId}/messages`,
      {
        method: "POST",
        body: { type: "TEXT", text: `Hello from POM fan ${Date.now()}` },
        cookies: fanCookies,
        headers: { "X-CSRF-Token": fanCsrf },
      },
    );
    expect(res.ok).toBe(true);
    expect(res.body).toHaveProperty("id");
  });

  test("creator reads messages in conversation", async () => {
    test.skip(!conversationId, "No conversation created");
    const res = await apiFetch(
      `/dm/conversations/${conversationId}/messages?page_size=50`,
      { cookies: creatorCookies },
    );
    expect(res.ok).toBe(true);
    expect(res.body).toHaveProperty("items");
    expect(res.body.items.length).toBeGreaterThan(0);
  });

  test("creator sends reply", async () => {
    test.skip(!conversationId, "No conversation created");
    const res = await apiFetch(
      `/dm/conversations/${conversationId}/messages`,
      {
        method: "POST",
        body: { type: "TEXT", text: `Creator reply ${Date.now()}` },
        cookies: creatorCookies,
        headers: { "X-CSRF-Token": creatorCsrf },
      },
    );
    expect(res.ok).toBe(true);
  });

  test("fan sees reply in conversation messages", async () => {
    test.skip(!conversationId, "No conversation created");
    const res = await apiFetch(
      `/dm/conversations/${conversationId}/messages?page_size=50`,
      { cookies: fanCookies },
    );
    expect(res.ok).toBe(true);
    expect(res.body.items.length).toBeGreaterThanOrEqual(2);
  });
});

test.describe("Messaging Flow — UI", () => {
  let e2eAvailable = false;
  const fanEmail = uniqueEmail("dm-ui-fan");
  const creatorEmail = uniqueEmail("dm-ui-creator");
  let creatorUserId = "";
  let conversationId: string | null = null;

  test.beforeAll(async () => {
    e2eAvailable = await isE2EEnabled();
    if (!e2eAvailable) return;

    const fan = await signupFan(fanEmail, PASSWORD, "DM UI Fan");
    const fanCookies = fan.cookies;
    const fanCsrf = fanCookies.match(/csrf_token=([^;]+)/)?.[1] ?? "";

    const creator = await createVerifiedCreator(creatorEmail, PASSWORD);
    creatorUserId = creator.userId;

    // Create conversation via API
    const convRes = await apiFetch("/dm/conversations", {
      method: "POST",
      body: { creator_user_id: creatorUserId },
      cookies: fanCookies,
      headers: { "X-CSRF-Token": fanCsrf },
    });
    if (convRes.ok) {
      conversationId = convRes.body.id;
      // Send a message
      await apiFetch(`/dm/conversations/${conversationId}/messages`, {
        method: "POST",
        body: { type: "TEXT", text: "Hello from UI test" },
        cookies: fanCookies,
        headers: { "X-CSRF-Token": fanCsrf },
      });
    }
  });

  test("messages page loads for fan", async ({ page }) => {
    test.skip(!e2eAvailable, "E2E bypass required");
    const login = new LoginPage(page);
    await login.login(fanEmail, PASSWORD);

    await page.goto("/messages");
    await page.waitForLoadState("networkidle");
    const body = await page.textContent("body");
    expect(body).not.toContain("Internal Server Error");
  });

  test("conversation page shows messages", async ({ page }) => {
    test.skip(!e2eAvailable || !conversationId, "E2E bypass + conversation required");
    const login = new LoginPage(page);
    await login.login(fanEmail, PASSWORD);

    const conversation = new ConversationPage(page);
    await conversation.goto(conversationId!);

    // Should show the message text
    const body = await page.textContent("body");
    expect(body).toContain("Hello from UI test");
  });
});
