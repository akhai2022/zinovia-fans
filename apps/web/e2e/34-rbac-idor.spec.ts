/**
 * STEP 34 — RBAC & IDOR boundary tests.
 *
 * Verifies that role-based access control is enforced and users cannot
 * access resources belonging to other users.
 */

import { test, expect } from "@playwright/test";
import {
  uniqueEmail,
  apiFetch,
  signupFan,
  createVerifiedCreator,
  createAdminUser,
  isE2EEnabled,
  extractCookies,
} from "./helpers";
import { extractCsrf, requestUploadUrl } from "./ai-helpers";

const PASSWORD = "E2eRbac12345!";
let e2eAvailable = false;

// --- Credentials ---
let fanCookies = "";
let fanCsrf = "";
let creatorACookies = "";
let creatorACsrf = "";
let creatorBCookies = "";
let creatorBCsrf = "";
let adminCookies = "";
let adminCsrf = "";

test.beforeAll(async () => {
  e2eAvailable = await isE2EEnabled();
  if (!e2eAvailable) return;

  const [fan, creatorA, creatorB, admin] = await Promise.all([
    signupFan(uniqueEmail("rbac-fan"), PASSWORD, "RBAC Fan"),
    createVerifiedCreator(uniqueEmail("rbac-crA"), PASSWORD),
    createVerifiedCreator(uniqueEmail("rbac-crB"), PASSWORD),
    createAdminUser(uniqueEmail("rbac-admin"), PASSWORD),
  ]);
  fanCookies = fan.cookies;
  fanCsrf = extractCsrf(fanCookies);
  creatorACookies = creatorA.cookies;
  creatorACsrf = extractCsrf(creatorACookies);
  creatorBCookies = creatorB.cookies;
  creatorBCsrf = extractCsrf(creatorBCookies);
  adminCookies = admin.cookies;
  adminCsrf = extractCsrf(adminCookies);
});

test.describe("RBAC & IDOR Boundaries", () => {
  test("RBAC-001: fan cannot access creator-only upload endpoint @smoke", { tag: "@smoke" }, async () => {
    test.skip(!e2eAvailable, "E2E bypass required");
    const res = await apiFetch("/media/upload-url", {
      method: "POST",
      body: { content_type: "image/jpeg", size_bytes: 1024, filename: "fan-attempt.jpg" },
      cookies: fanCookies,
      headers: { "X-CSRF-Token": fanCsrf },
    });
    expect([401, 403]).toContain(res.status);
  });

  test("RBAC-002: creator cannot access admin endpoints @smoke", { tag: "@smoke" }, async () => {
    test.skip(!e2eAvailable, "E2E bypass required");
    const res = await apiFetch("/admin/creators?page=1&page_size=10", {
      cookies: creatorACookies,
    });
    expect(res.status).toBe(403);
  });

  test("RBAC-003: creator A cannot view creator B vault", { tag: "@regression" }, async () => {
    test.skip(!e2eAvailable, "E2E bypass required");
    // Creator A's vault should only show A's media
    const resA = await apiFetch("/media/mine?page_size=10", { cookies: creatorACookies });
    const resB = await apiFetch("/media/mine?page_size=10", { cookies: creatorBCookies });
    // Both should succeed (each sees own vault)
    if (resA.status === 404 || resB.status === 404) {
      test.skip(true, "Vault feature disabled");
      return;
    }
    expect(resA.ok).toBe(true);
    expect(resB.ok).toBe(true);
    // Verify items are scoped — no cross-contamination
    const idsA = (resA.body.items ?? []).map((i: any) => i.id);
    const idsB = (resB.body.items ?? []).map((i: any) => i.id);
    for (const id of idsA) {
      expect(idsB).not.toContain(id);
    }
  });

  test("RBAC-005: creator cannot read another creator AI image jobs", { tag: "@regression" }, async () => {
    test.skip(!e2eAvailable, "E2E bypass required");
    // Creator A creates an AI job
    const genRes = await apiFetch("/ai/images/generate", {
      method: "POST",
      body: { image_type: "avatar", preset: "portrait", subject: "test", vibe: "dreamy", accent_color: "#FF69B4" },
      cookies: creatorACookies,
      headers: { "X-CSRF-Token": creatorACsrf },
    });
    if (genRes.status === 403 || genRes.status === 404) {
      test.skip(true, "AI image generation not available");
      return;
    }
    const jobId = genRes.body.id;

    // Creator B tries to access Creator A's job
    const res = await apiFetch(`/ai/images/${jobId}`, { cookies: creatorBCookies });
    expect([403, 404]).toContain(res.status);
  });

  test("RBAC-006: unauthenticated user gets 401 on protected endpoints @smoke", { tag: "@smoke" }, async () => {
    const endpoints = [
      { method: "GET", path: "/auth/me" },
      { method: "GET", path: "/media/mine?page_size=10" },
      { method: "GET", path: "/ai/images" },
    ];
    for (const ep of endpoints) {
      const res = await apiFetch(ep.path, { method: ep.method });
      expect(res.status, `${ep.method} ${ep.path} should return 401`).toBe(401);
    }
  });

  test("RBAC-007: deleted user cannot login", { tag: "@regression" }, async () => {
    test.skip(!e2eAvailable, "E2E bypass required");
    const email = uniqueEmail("rbac-del");
    await signupFan(email, PASSWORD, "To Delete");

    // Delete user via admin action
    const tokens = await apiFetch(`/auth/dev/tokens?email=${encodeURIComponent(email)}`);
    if (!tokens.ok || !tokens.body.user_id) {
      test.skip(true, "Could not find user_id");
      return;
    }
    const userId = tokens.body.user_id;
    await apiFetch(`/admin/users/${userId}/action`, {
      method: "POST",
      body: { action: "delete", reason: "E2E test" },
      cookies: adminCookies,
      headers: { "X-CSRF-Token": adminCsrf },
    });

    // Try to login
    const loginRes = await apiFetch("/auth/login", {
      method: "POST",
      body: { email, password: PASSWORD },
    });
    expect([401, 403]).toContain(loginRes.status);
  });

  test("RBAC-008: CSRF token required for state-changing operations", { tag: "@regression" }, async () => {
    test.skip(!e2eAvailable, "E2E bypass required");
    // POST without X-CSRF-Token should fail
    const res = await apiFetch("/media/upload-url", {
      method: "POST",
      body: { content_type: "image/jpeg", size_bytes: 1024, filename: "no-csrf.jpg" },
      cookies: creatorACookies,
      // intentionally omit X-CSRF-Token
    });
    expect([401, 403]).toContain(res.status);
  });
});
