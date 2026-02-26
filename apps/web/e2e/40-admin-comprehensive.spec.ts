/**
 * STEP 40 — Admin Comprehensive: users CRUD, creator actions, post moderation,
 * transactions, force-verify, user detail with onboarding_state.
 *
 * Extends 13-admin.spec.ts with deeper coverage of admin workflows
 * including KYC-state visibility and all action types.
 */

import { test, expect } from "@playwright/test";
import {
  uniqueEmail,
  apiFetch,
  e2eApi,
  extractCookies,
  createAdminUser,
  createVerifiedCreator,
  signupFan,
  isE2EEnabled,
} from "./helpers";

const PASSWORD = "E2eAdminFull1!";
let adminCookies = "";
let adminCsrf = "";
let e2eAvailable = false;

test.beforeAll(async () => {
  e2eAvailable = await isE2EEnabled();
  if (!e2eAvailable) return;

  const adminEmail = uniqueEmail("adminfull");
  const admin = await createAdminUser(adminEmail, PASSWORD);
  adminCookies = admin.cookies;
  adminCsrf = adminCookies.match(/csrf_token=([^;]+)/)?.[1] ?? "";
});

/* ------------------------------------------------------------------ */
/*  Admin — User Listing & Search                                      */
/* ------------------------------------------------------------------ */

test.describe("Admin — User Management", () => {
  test("ADM-001: list all users with pagination @smoke", {
    tag: "@smoke",
  }, async () => {
    test.skip(!e2eAvailable, "E2E bypass required");
    const res = await apiFetch("/admin/users?page=1&page_size=10", {
      cookies: adminCookies,
    });
    expect(res.ok).toBe(true);
    expect(res.body).toHaveProperty("items");
    expect(res.body).toHaveProperty("total");
    expect(res.body).toHaveProperty("page", 1);
    expect(res.body).toHaveProperty("page_size", 10);
    expect(Array.isArray(res.body.items)).toBe(true);
  });

  test("ADM-002: search users by email @regression", {
    tag: "@regression",
  }, async () => {
    test.skip(!e2eAvailable, "E2E bypass required");
    // Create a user with a distinctive prefix
    const email = uniqueEmail("admsearch");
    await apiFetch("/auth/signup", {
      method: "POST",
      body: { email, password: PASSWORD, display_name: "Admin Search Target" },
    });

    const res = await apiFetch(
      `/admin/users?search=${encodeURIComponent(email)}&page=1&page_size=10`,
      { cookies: adminCookies },
    );
    expect(res.ok).toBe(true);
    expect(res.body.items.length).toBeGreaterThanOrEqual(1);
    const found = res.body.items.some((u: any) => u.email === email);
    expect(found).toBe(true);
  });

  test("ADM-003: filter users by role @regression", {
    tag: "@regression",
  }, async () => {
    test.skip(!e2eAvailable, "E2E bypass required");
    const res = await apiFetch("/admin/users?role=admin&page=1&page_size=10", {
      cookies: adminCookies,
    });
    expect(res.ok).toBe(true);
    // All returned users should be admins
    for (const user of res.body.items) {
      expect(user.role).toBe("admin");
    }
  });

  test("ADM-004: get user detail includes onboarding_state @regression", {
    tag: "@regression",
  }, async () => {
    test.skip(!e2eAvailable, "E2E bypass required");
    // Create a creator with specific state
    const email = uniqueEmail("admdetail");
    const creator = await createVerifiedCreator(email, PASSWORD);

    const res = await apiFetch(`/admin/users/${creator.userId}`, {
      cookies: adminCookies,
    });
    expect(res.ok).toBe(true);
    expect(res.body).toHaveProperty("email", email);
    expect(res.body).toHaveProperty("role", "creator");
    expect(res.body).toHaveProperty("onboarding_state");
    expect(res.body.onboarding_state).toBe("KYC_APPROVED");
  });

  test("ADM-005: get non-existent user returns 404 @regression", {
    tag: "@regression",
  }, async () => {
    test.skip(!e2eAvailable, "E2E bypass required");
    const res = await apiFetch(
      "/admin/users/00000000-0000-0000-0000-000000000000",
      { cookies: adminCookies },
    );
    expect(res.status).toBe(404);
  });
});

/* ------------------------------------------------------------------ */
/*  Admin — Creator Actions                                            */
/* ------------------------------------------------------------------ */

test.describe("Admin — Creator Actions", () => {
  let targetUserId = "";
  let targetEmail = "";

  test.beforeAll(async () => {
    if (!e2eAvailable) return;
    targetEmail = uniqueEmail("admtarget");
    const creator = await createVerifiedCreator(targetEmail, PASSWORD);
    targetUserId = creator.userId;
  });

  test("ADM-006: approve creator (discoverable=true) @smoke", {
    tag: "@smoke",
  }, async () => {
    test.skip(!e2eAvailable, "E2E bypass required");
    test.skip(!targetUserId, "Target creator not created");
    const res = await apiFetch(`/admin/creators/${targetUserId}/action`, {
      method: "POST",
      body: { action: "approve", reason: "E2E test" },
      cookies: adminCookies,
      headers: { "X-CSRF-Token": adminCsrf },
    });
    expect(res.ok).toBe(true);
  });

  test("ADM-007: reject creator (discoverable=false) @regression", {
    tag: "@regression",
  }, async () => {
    test.skip(!e2eAvailable, "E2E bypass required");
    test.skip(!targetUserId, "Target creator not created");
    const res = await apiFetch(`/admin/creators/${targetUserId}/action`, {
      method: "POST",
      body: { action: "reject", reason: "E2E test rejection" },
      cookies: adminCookies,
      headers: { "X-CSRF-Token": adminCsrf },
    });
    expect(res.ok).toBe(true);
  });

  test("ADM-008: feature creator @regression", {
    tag: "@regression",
  }, async () => {
    test.skip(!e2eAvailable, "E2E bypass required");
    test.skip(!targetUserId, "Target creator not created");
    const res = await apiFetch(`/admin/creators/${targetUserId}/action`, {
      method: "POST",
      body: { action: "feature" },
      cookies: adminCookies,
      headers: { "X-CSRF-Token": adminCsrf },
    });
    expect(res.ok).toBe(true);
  });

  test("ADM-009: unfeature creator @regression", {
    tag: "@regression",
  }, async () => {
    test.skip(!e2eAvailable, "E2E bypass required");
    test.skip(!targetUserId, "Target creator not created");
    const res = await apiFetch(`/admin/creators/${targetUserId}/action`, {
      method: "POST",
      body: { action: "unfeature" },
      cookies: adminCookies,
      headers: { "X-CSRF-Token": adminCsrf },
    });
    expect(res.ok).toBe(true);
  });

  test("ADM-010: verify creator (badge) @regression", {
    tag: "@regression",
  }, async () => {
    test.skip(!e2eAvailable, "E2E bypass required");
    test.skip(!targetUserId, "Target creator not created");
    const res = await apiFetch(`/admin/creators/${targetUserId}/action`, {
      method: "POST",
      body: { action: "verify" },
      cookies: adminCookies,
      headers: { "X-CSRF-Token": adminCsrf },
    });
    expect(res.ok).toBe(true);
  });

  test("ADM-011: unverify creator @regression", {
    tag: "@regression",
  }, async () => {
    test.skip(!e2eAvailable, "E2E bypass required");
    test.skip(!targetUserId, "Target creator not created");
    const res = await apiFetch(`/admin/creators/${targetUserId}/action`, {
      method: "POST",
      body: { action: "unverify" },
      cookies: adminCookies,
      headers: { "X-CSRF-Token": adminCsrf },
    });
    expect(res.ok).toBe(true);
  });

  test("ADM-012: suspend user @regression", {
    tag: "@regression",
  }, async () => {
    test.skip(!e2eAvailable, "E2E bypass required");
    test.skip(!targetUserId, "Target creator not created");
    const res = await apiFetch(`/admin/creators/${targetUserId}/action`, {
      method: "POST",
      body: { action: "suspend", reason: "E2E suspension test" },
      cookies: adminCookies,
      headers: { "X-CSRF-Token": adminCsrf },
    });
    expect(res.ok).toBe(true);
  });

  test("ADM-013: activate user (unsuspend) @regression", {
    tag: "@regression",
  }, async () => {
    test.skip(!e2eAvailable, "E2E bypass required");
    test.skip(!targetUserId, "Target creator not created");
    const res = await apiFetch(`/admin/creators/${targetUserId}/action`, {
      method: "POST",
      body: { action: "activate" },
      cookies: adminCookies,
      headers: { "X-CSRF-Token": adminCsrf },
    });
    expect(res.ok).toBe(true);
  });
});

/* ------------------------------------------------------------------ */
/*  Admin — User Actions (delete, role management)                     */
/* ------------------------------------------------------------------ */

test.describe("Admin — User Actions", () => {
  test("ADM-014: soft-delete user (role=deleted, is_active=false) @regression", {
    tag: "@regression",
  }, async () => {
    test.skip(!e2eAvailable, "E2E bypass required");
    // Create a disposable user
    const email = uniqueEmail("admdelete");
    await apiFetch("/auth/signup", {
      method: "POST",
      body: { email, password: PASSWORD, display_name: "Delete Target" },
    });
    // Get user ID
    const search = await apiFetch(
      `/admin/users?search=${encodeURIComponent(email)}`,
      { cookies: adminCookies },
    );
    if (!search.ok || !search.body.items?.length) {
      test.skip(true, "Could not find user to delete");
      return;
    }
    const userId = search.body.items[0].id;

    const res = await apiFetch(`/admin/users/${userId}/action`, {
      method: "POST",
      body: { action: "delete", reason: "E2E cleanup" },
      cookies: adminCookies,
      headers: { "X-CSRF-Token": adminCsrf },
    });
    expect(res.ok).toBe(true);

    // Verify: user should have role=deleted
    const detail = await apiFetch(`/admin/users/${userId}`, {
      cookies: adminCookies,
    });
    expect(detail.ok).toBe(true);
    expect(detail.body.role).toBe("deleted");
  });

  test("ADM-015: promote user to admin @regression", {
    tag: "@regression",
  }, async () => {
    test.skip(!e2eAvailable, "E2E bypass required");
    const email = uniqueEmail("admpromote");
    await apiFetch("/auth/signup", {
      method: "POST",
      body: { email, password: PASSWORD, display_name: "Promote Target" },
    });
    const search = await apiFetch(
      `/admin/users?search=${encodeURIComponent(email)}`,
      { cookies: adminCookies },
    );
    if (!search.ok || !search.body.items?.length) {
      test.skip(true, "Could not find user");
      return;
    }
    const userId = search.body.items[0].id;

    const res = await apiFetch(`/admin/users/${userId}/action`, {
      method: "POST",
      body: { action: "promote_admin" },
      cookies: adminCookies,
      headers: { "X-CSRF-Token": adminCsrf },
    });
    expect(res.ok).toBe(true);

    // Verify role
    const detail = await apiFetch(`/admin/users/${userId}`, {
      cookies: adminCookies,
    });
    expect(detail.body.role).toBe("admin");
  });

  test("ADM-016: demote admin to fan @regression", {
    tag: "@regression",
  }, async () => {
    test.skip(!e2eAvailable, "E2E bypass required");
    const email = uniqueEmail("admdemote");
    const admin2 = await createAdminUser(email, PASSWORD);

    const res = await apiFetch(`/admin/users/${admin2.userId}/action`, {
      method: "POST",
      body: { action: "demote_admin" },
      cookies: adminCookies,
      headers: { "X-CSRF-Token": adminCsrf },
    });
    expect(res.ok).toBe(true);

    const detail = await apiFetch(`/admin/users/${admin2.userId}`, {
      cookies: adminCookies,
    });
    expect(detail.body.role).toBe("fan");
  });
});

/* ------------------------------------------------------------------ */
/*  Admin — User Posts & Subscribers                                   */
/* ------------------------------------------------------------------ */

test.describe("Admin — User Posts & Subscribers", () => {
  let creatorId = "";

  test.beforeAll(async () => {
    if (!e2eAvailable) return;
    const email = uniqueEmail("admcontent");
    const creator = await createVerifiedCreator(email, PASSWORD);
    creatorId = creator.userId;
    const csrf = creator.cookies.match(/csrf_token=([^;]+)/)?.[1] ?? "";

    // Create a post for this creator
    await apiFetch("/posts", {
      method: "POST",
      body: {
        type: "TEXT",
        caption: "Admin test post",
        visibility: "PUBLIC",
        nsfw: false,
        asset_ids: [],
      },
      cookies: creator.cookies,
      headers: { "X-CSRF-Token": csrf },
    });
  });

  test("ADM-017: list user posts @regression", {
    tag: "@regression",
  }, async () => {
    test.skip(!e2eAvailable, "E2E bypass required");
    test.skip(!creatorId, "Creator not created");
    const res = await apiFetch(
      `/admin/users/${creatorId}/posts?page=1&page_size=10`,
      { cookies: adminCookies },
    );
    expect(res.ok).toBe(true);
    expect(res.body).toHaveProperty("items");
    expect(res.body).toHaveProperty("total");
  });

  test("ADM-018: list user subscribers @regression", {
    tag: "@regression",
  }, async () => {
    test.skip(!e2eAvailable, "E2E bypass required");
    test.skip(!creatorId, "Creator not created");
    const res = await apiFetch(
      `/admin/users/${creatorId}/subscribers?page=1&page_size=10`,
      { cookies: adminCookies },
    );
    expect(res.ok).toBe(true);
    expect(res.body).toHaveProperty("items");
    expect(res.body).toHaveProperty("total");
  });
});

/* ------------------------------------------------------------------ */
/*  Admin — Post Moderation                                            */
/* ------------------------------------------------------------------ */

test.describe("Admin — Post Moderation", () => {
  test("ADM-019: list all posts @regression", {
    tag: "@regression",
  }, async () => {
    test.skip(!e2eAvailable, "E2E bypass required");
    const res = await apiFetch("/admin/posts?page=1&page_size=10", {
      cookies: adminCookies,
    });
    expect(res.ok).toBe(true);
    expect(res.body).toHaveProperty("items");
    expect(res.body).toHaveProperty("total");
  });

  test("ADM-020: remove a post @regression", {
    tag: "@regression",
  }, async () => {
    test.skip(!e2eAvailable, "E2E bypass required");
    // Get first available post
    const posts = await apiFetch("/admin/posts?page=1&page_size=1", {
      cookies: adminCookies,
    });
    if (!posts.ok || !posts.body.items?.length) {
      test.skip(true, "No posts available to moderate");
      return;
    }
    const postId = posts.body.items[0].id;

    const res = await apiFetch(`/admin/posts/${postId}/action`, {
      method: "POST",
      body: { action: "remove", reason: "E2E moderation test" },
      cookies: adminCookies,
      headers: { "X-CSRF-Token": adminCsrf },
    });
    expect(res.ok).toBe(true);

    // Restore it
    const restore = await apiFetch(`/admin/posts/${postId}/action`, {
      method: "POST",
      body: { action: "restore" },
      cookies: adminCookies,
      headers: { "X-CSRF-Token": adminCsrf },
    });
    expect(restore.ok).toBe(true);
  });
});

/* ------------------------------------------------------------------ */
/*  Admin — Transactions                                               */
/* ------------------------------------------------------------------ */

test.describe("Admin — Transactions", () => {
  test("ADM-021: list transactions @regression", {
    tag: "@regression",
  }, async () => {
    test.skip(!e2eAvailable, "E2E bypass required");
    const res = await apiFetch("/admin/transactions?page=1&page_size=10", {
      cookies: adminCookies,
    });
    expect(res.ok).toBe(true);
    expect(res.body).toHaveProperty("items");
    expect(res.body).toHaveProperty("total");
    expect(Array.isArray(res.body.items)).toBe(true);
  });
});

/* ------------------------------------------------------------------ */
/*  Admin — Force Verify Email (KYC assist)                            */
/* ------------------------------------------------------------------ */

test.describe("Admin — KYC Assist", () => {
  test("ADM-022: force-verify stuck creator's email @smoke", {
    tag: "@smoke",
  }, async () => {
    test.skip(!e2eAvailable, "E2E bypass required");
    const email = uniqueEmail("admkycassist");
    await apiFetch("/auth/register", {
      method: "POST",
      body: { email, password: PASSWORD },
      headers: { "Idempotency-Key": `adm-kyc-${Date.now()}` },
    });

    const res = await apiFetch(
      `/admin/force-verify-email?email=${encodeURIComponent(email)}`,
      {
        method: "POST",
        cookies: adminCookies,
        headers: { "X-CSRF-Token": adminCsrf },
      },
    );
    expect(res.ok).toBe(true);
    expect(res.body.status).toMatch(/verified|already_verified/);
  });

  test("ADM-023: force-verify already-verified creator returns already_verified @regression", {
    tag: "@regression",
  }, async () => {
    test.skip(!e2eAvailable, "E2E bypass required");
    const email = uniqueEmail("admkycdup");
    const creator = await createVerifiedCreator(email, PASSWORD);

    const res = await apiFetch(
      `/admin/force-verify-email?email=${encodeURIComponent(email)}`,
      {
        method: "POST",
        cookies: adminCookies,
        headers: { "X-CSRF-Token": adminCsrf },
      },
    );
    expect(res.ok).toBe(true);
    expect(res.body.status).toBe("already_verified");
  });

  test("ADM-024: force-verify non-existent email returns 404 @regression", {
    tag: "@regression",
  }, async () => {
    test.skip(!e2eAvailable, "E2E bypass required");
    const res = await apiFetch(
      "/admin/force-verify-email?email=nonexistent@test.zinovia.ai",
      {
        method: "POST",
        cookies: adminCookies,
        headers: { "X-CSRF-Token": adminCsrf },
      },
    );
    expect(res.status).toBe(404);
  });

  test("ADM-025: admin tokens lookup shows onboarding_state @regression", {
    tag: "@regression",
  }, async () => {
    test.skip(!e2eAvailable, "E2E bypass required");
    const email = uniqueEmail("admtokens");
    await apiFetch("/auth/register", {
      method: "POST",
      body: { email, password: PASSWORD },
      headers: { "Idempotency-Key": `adm-tok-${Date.now()}` },
    });

    const res = await apiFetch(
      `/admin/tokens?email=${encodeURIComponent(email)}`,
      { cookies: adminCookies },
    );
    expect(res.ok).toBe(true);
    expect(res.body).toHaveProperty("onboarding_state");
    expect(res.body.onboarding_state).toBe("CREATED");
    expect(res.body).toHaveProperty("verification_token");
  });
});

/* ------------------------------------------------------------------ */
/*  Admin — RBAC (non-admin cannot access)                             */
/* ------------------------------------------------------------------ */

test.describe("Admin — RBAC", () => {
  test("ADM-026: creator cannot access admin user endpoints @smoke", {
    tag: "@smoke",
  }, async () => {
    test.skip(!e2eAvailable, "E2E bypass required");
    const email = uniqueEmail("admrbac");
    const creator = await createVerifiedCreator(email, PASSWORD);

    const res = await apiFetch("/admin/users?page=1&page_size=10", {
      cookies: creator.cookies,
    });
    expect(res.status).toBe(403);
  });

  test("ADM-027: unauthenticated access to admin endpoints returns 401/403 @smoke", {
    tag: "@smoke",
  }, async () => {
    const res = await apiFetch("/admin/users?page=1&page_size=10");
    expect([401, 403]).toContain(res.status);
  });
});
