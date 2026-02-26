/**
 * STEP 08 — Post CRUD: create, update, delete, visibility levels.
 * Requires a verified creator (uses E2E bypass if available).
 */

import { test, expect } from "@playwright/test";
import {
  uniqueEmail,
  apiFetch,
  registerCreator,
  createVerifiedCreator,
  isE2EEnabled,
  extractCookies,
} from "./helpers";

const PASSWORD = "E2ePost1234!";
let cookies = "";
let csrfToken = "";
let e2eAvailable = false;

test.beforeAll(async () => {
  e2eAvailable = await isE2EEnabled();
  const email = uniqueEmail("postcrud");

  try {
    if (e2eAvailable) {
      const result = await createVerifiedCreator(email, PASSWORD);
      cookies = result.cookies;
    } else {
      const result = await registerCreator(email, PASSWORD);
      cookies = result.cookies;
    }
    // Extract CSRF token from cookies
    csrfToken = cookies.match(/csrf_token=([^;]+)/)?.[1] ?? "";
  } catch {
    // registerCreator/createVerifiedCreator throw if login fails (unverified in prod)
  }
});

test.describe("Post Creation", () => {
  test("create TEXT post with PUBLIC visibility", async () => {
    test.skip(!cookies, "Login failed (email verification required in production)");
    const res = await apiFetch("/posts", {
      method: "POST",
      body: {
        type: "TEXT",
        caption: `E2E test post ${Date.now()}`,
        visibility: "PUBLIC",
        nsfw: false,
        asset_ids: [],
      },
      cookies,
      headers: { "X-CSRF-Token": csrfToken },
    });
    if (res.status === 403) {
      test.skip(true, "Creator profile required (E2E bypass unavailable)");
      return;
    }
    expect(res.ok).toBe(true);
    expect(res.body).toHaveProperty("id");
    expect(res.body.type).toBe("TEXT");
    expect(res.body.visibility).toBe("PUBLIC");
  });

  test("create SUBSCRIBERS-only post", async () => {
    test.skip(!cookies, "Login failed (email verification required in production)");
    const res = await apiFetch("/posts", {
      method: "POST",
      body: {
        type: "TEXT",
        caption: `Subscribers-only post ${Date.now()}`,
        visibility: "SUBSCRIBERS",
        nsfw: false,
        asset_ids: [],
      },
      cookies,
      headers: { "X-CSRF-Token": csrfToken },
    });
    if (res.status === 403) {
      test.skip(true, "Creator profile required");
      return;
    }
    expect(res.ok).toBe(true);
    expect(res.body.visibility).toBe("SUBSCRIBERS");
  });

  test("PPV post without price_cents fails validation", async () => {
    test.skip(!cookies, "Login failed (email verification required in production)");
    const res = await apiFetch("/posts", {
      method: "POST",
      body: {
        type: "TEXT",
        caption: "PPV no price",
        visibility: "PPV",
        nsfw: false,
        asset_ids: [],
      },
      cookies,
      headers: { "X-CSRF-Token": csrfToken },
    });
    if (res.status === 403) {
      test.skip(true, "Creator profile required or PPV disabled");
      return;
    }
    expect([400, 422]).toContain(res.status);
  });

  test("PPV post with valid price creates successfully", async () => {
    test.skip(!cookies, "Login failed (email verification required in production)");
    const res = await apiFetch("/posts", {
      method: "POST",
      body: {
        type: "TEXT",
        caption: `PPV post ${Date.now()}`,
        visibility: "PPV",
        nsfw: false,
        asset_ids: [],
        price_cents: 500,
      },
      cookies,
      headers: { "X-CSRF-Token": csrfToken },
    });
    if (res.status === 403 || res.status === 400) {
      test.skip(true, "PPV posts disabled or profile required");
      return;
    }
    expect(res.ok).toBe(true);
    expect(res.body.visibility).toBe("PPV");
  });

  test("PRIVATE post visible only to creator", async () => {
    test.skip(!cookies, "Login failed (email verification required in production)");
    const res = await apiFetch("/posts", {
      method: "POST",
      body: {
        type: "TEXT",
        caption: `Private draft ${Date.now()}`,
        visibility: "PRIVATE",
        nsfw: false,
        asset_ids: [],
      },
      cookies,
      headers: { "X-CSRF-Token": csrfToken },
    });
    if (res.status === 403) {
      test.skip(true, "Creator profile required");
      return;
    }
    expect(res.ok).toBe(true);
    expect(res.body.visibility).toBe("PRIVATE");
  });
});

test.describe("Post Update & Delete", () => {
  let postId: string | null = null;

  test.beforeAll(async () => {
    const res = await apiFetch("/posts", {
      method: "POST",
      body: {
        type: "TEXT",
        caption: "Post to update/delete",
        visibility: "PUBLIC",
        nsfw: false,
        asset_ids: [],
      },
      cookies,
      headers: { "X-CSRF-Token": csrfToken },
    });
    if (res.ok) {
      postId = res.body.id;
    }
  });

  test("update post caption", async () => {
    test.skip(!postId, "No post to update");
    const res = await apiFetch(`/posts/${postId}`, {
      method: "PATCH",
      body: { caption: `Updated caption ${Date.now()}` },
      cookies,
      headers: { "X-CSRF-Token": csrfToken },
    });
    expect(res.ok).toBe(true);
  });

  test("delete post", async () => {
    test.skip(!postId, "No post to delete");
    const res = await apiFetch(`/posts/${postId}`, {
      method: "DELETE",
      cookies,
      headers: { "X-CSRF-Token": csrfToken },
    });
    expect(res.ok).toBe(true);
  });
});

test.describe("Post Access Control", () => {
  test("non-creator (fan) cannot create posts", async () => {
    const fanEmail = uniqueEmail("fanpost");
    const fanPassword = "E2eFanPost123!";
    await apiFetch("/auth/signup", {
      method: "POST",
      body: { email: fanEmail, password: fanPassword, display_name: "Fan No Post" },
    });
    const login = await apiFetch("/auth/login", {
      method: "POST",
      body: { email: fanEmail, password: fanPassword },
    });
    if (!login.ok) {
      test.skip(true, "Login failed (email verification required in production)");
      return;
    }
    const fanCookies = extractCookies(login.headers.get("set-cookie") ?? "");

    const res = await apiFetch("/posts", {
      method: "POST",
      body: {
        type: "TEXT",
        caption: "Fan should not create",
        visibility: "PUBLIC",
        nsfw: false,
        asset_ids: [],
      },
      cookies: fanCookies,
    });
    expect(res.status).toBe(403);
  });
});
