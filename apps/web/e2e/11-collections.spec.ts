/**
 * STEP 11 — Collections CRUD.
 */

import { test, expect } from "@playwright/test";
import {
  uniqueEmail,
  apiFetch,
  createVerifiedCreator,
  isE2EEnabled,
} from "./helpers";

const PASSWORD = "E2eColl1234!";
let cookies = "";
let csrfToken = "";
let e2eAvailable = false;
let collectionId: string | null = null;
let postId: string | null = null;

test.beforeAll(async () => {
  e2eAvailable = await isE2EEnabled();
  if (!e2eAvailable) return;

  const email = uniqueEmail("coll");
  const creator = await createVerifiedCreator(email, PASSWORD);
  cookies = creator.cookies;
  csrfToken = cookies.match(/csrf_token=([^;]+)/)?.[1] ?? "";

  // Create a post to add to collection
  const postRes = await apiFetch("/posts", {
    method: "POST",
    body: {
      type: "TEXT",
      caption: "Post for collection test",
      visibility: "PUBLIC",
      nsfw: false,
      asset_ids: [],
    },
    cookies,
    headers: { "X-CSRF-Token": csrfToken },
  });
  if (postRes.ok) {
    postId = postRes.body.id;
  }
});

test.describe("Collection CRUD", () => {
  test("create collection", async () => {
    test.skip(!e2eAvailable, "E2E bypass required");
    const res = await apiFetch("/collections", {
      method: "POST",
      body: {
        title: `E2E Collection ${Date.now()}`,
        description: "Test collection",
        visibility: "PUBLIC",
      },
      cookies,
      headers: { "X-CSRF-Token": csrfToken },
    });
    if (res.status === 403) {
      test.skip(true, "Creator profile required");
      return;
    }
    expect(res.ok).toBe(true);
    expect(res.body).toHaveProperty("id");
    collectionId = res.body.id;
  });

  test("add post to collection", async () => {
    test.skip(!collectionId || !postId, "No collection or post");
    const res = await apiFetch(`/collections/${collectionId}/posts`, {
      method: "POST",
      body: { post_id: postId },
      cookies,
      headers: { "X-CSRF-Token": csrfToken },
    });
    expect(res.ok).toBe(true);
  });

  test("get collection details", async () => {
    test.skip(!collectionId, "No collection");
    const res = await apiFetch(`/collections/${collectionId}`, { cookies });
    expect(res.ok).toBe(true);
    expect(res.body).toHaveProperty("title");
  });

  test("update collection", async () => {
    test.skip(!collectionId, "No collection");
    const res = await apiFetch(`/collections/${collectionId}`, {
      method: "PATCH",
      body: { title: `Updated ${Date.now()}` },
      cookies,
      headers: { "X-CSRF-Token": csrfToken },
    });
    expect(res.ok).toBe(true);
  });

  test("remove post from collection", async () => {
    test.skip(!collectionId || !postId, "No collection or post");
    const res = await apiFetch(`/collections/${collectionId}/posts/${postId}`, {
      method: "DELETE",
      cookies,
      headers: { "X-CSRF-Token": csrfToken },
    });
    expect(res.ok).toBe(true);
  });

  test("delete collection", async () => {
    test.skip(!collectionId, "No collection");
    const res = await apiFetch(`/collections/${collectionId}`, {
      method: "DELETE",
      cookies,
      headers: { "X-CSRF-Token": csrfToken },
    });
    expect(res.ok).toBe(true);
  });

  test("non-creator cannot create collection", async () => {
    test.skip(!e2eAvailable, "E2E bypass required");
    const fanEmail = uniqueEmail("collFan");
    const { cookies: fanCookies } = await (async () => {
      await apiFetch("/auth/signup", {
        method: "POST",
        body: { email: fanEmail, password: PASSWORD, display_name: "Fan" },
      });
      const login = await apiFetch("/auth/login", {
        method: "POST",
        body: { email: fanEmail, password: PASSWORD },
      });
      const setCookie = login.headers.get("set-cookie") ?? "";
      return { cookies: setCookie.split(",").map(c => c.split(";")[0].trim()).join("; ") };
    })();

    const res = await apiFetch("/collections", {
      method: "POST",
      body: { title: "Should fail", visibility: "PUBLIC" },
      cookies: fanCookies,
    });
    expect(res.status).toBe(403);
  });
});
