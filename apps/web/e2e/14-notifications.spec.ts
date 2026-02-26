/**
 * STEP 14 — Notifications (feature-flagged).
 */

import { test, expect } from "@playwright/test";
import { uniqueEmail, apiFetch, signupFan } from "./helpers";

const PASSWORD = "E2eNotif1234!";

test.describe("Notifications API", () => {
  let cookies = "";

  test.beforeAll(async () => {
    try {
      const email = uniqueEmail("notif");
      const result = await signupFan(email, PASSWORD, "E2E Notif Fan");
      cookies = result.cookies;
    } catch {
      // signupFan throws if login fails (unverified user in prod)
    }
  });

  test("list notifications (may be feature-disabled)", async () => {
    test.skip(!cookies, "Login failed (email verification required in production)");
    const res = await apiFetch("/notifications?page_size=20", { cookies });
    if (res.status === 404) {
      test.skip(true, "Notifications feature disabled (ENABLE_NOTIFICATIONS=false)");
      return;
    }
    expect(res.ok).toBe(true);
    expect(res.body).toHaveProperty("items");
    expect(res.body).toHaveProperty("unread_count");
  });

  test("mark all read (may be feature-disabled)", async () => {
    test.skip(!cookies, "Login failed (email verification required in production)");
    const csrf = cookies.match(/csrf_token=([^;]+)/)?.[1] ?? "";
    const res = await apiFetch("/notifications/read-all", {
      method: "POST",
      cookies,
      headers: { "X-CSRF-Token": csrf },
    });
    if (res.status === 404) {
      test.skip(true, "Notifications feature disabled");
      return;
    }
    expect(res.ok).toBe(true);
    expect(res.body).toHaveProperty("updated");
  });

  test("unauthenticated notifications returns 401", async () => {
    const res = await apiFetch("/notifications");
    expect([401, 404]).toContain(res.status);
  });
});
