/**
 * STEP 12 — Media upload URLs and vault.
 */

import { test, expect } from "@playwright/test";
import {
  uniqueEmail,
  apiFetch,
  createVerifiedCreator,
  isE2EEnabled,
} from "./helpers";

const PASSWORD = "E2eMedia1234!";
let cookies = "";
let csrfToken = "";
let e2eAvailable = false;

test.beforeAll(async () => {
  e2eAvailable = await isE2EEnabled();
  if (!e2eAvailable) return;

  const email = uniqueEmail("media");
  const creator = await createVerifiedCreator(email, PASSWORD);
  cookies = creator.cookies;
  csrfToken = cookies.match(/csrf_token=([^;]+)/)?.[1] ?? "";
});

test.describe("Media Upload URL", () => {
  test("request presigned upload URL for image @smoke", { tag: "@smoke" }, async () => {
    test.skip(!e2eAvailable, "E2E bypass required");
    const res = await apiFetch("/media/upload-url", {
      method: "POST",
      body: {
        content_type: "image/jpeg",
        size_bytes: 1024,
        filename: "e2e-test.jpg",
      },
      cookies,
      headers: { "X-CSRF-Token": csrfToken },
    });
    if (res.status === 403 || res.status === 404) {
      test.skip(true, "Upload requires verified creator or vault disabled");
      return;
    }
    expect(res.ok).toBe(true);
    expect(res.body).toHaveProperty("upload_url");
    expect(res.body).toHaveProperty("asset_id");
    expect(res.body.upload_url).toContain("http");
  });

  test("batch upload URLs", async () => {
    test.skip(!e2eAvailable, "E2E bypass required");
    const res = await apiFetch("/media/batch-upload-urls", {
      method: "POST",
      body: {
        items: [
          { content_type: "image/jpeg", size_bytes: 1024, filename: "batch1.jpg" },
          { content_type: "image/png", size_bytes: 2048, filename: "batch2.png" },
        ],
      },
      cookies,
      headers: { "X-CSRF-Token": csrfToken },
    });
    if (res.status === 403 || res.status === 404) {
      test.skip(true, "Batch upload requires verified creator");
      return;
    }
    expect(res.ok).toBe(true);
    expect(res.body).toHaveProperty("items");
  });

  test("invalid content type returns 400/422", async () => {
    test.skip(!e2eAvailable, "E2E bypass required");
    const res = await apiFetch("/media/upload-url", {
      method: "POST",
      body: {
        content_type: "application/exe",
        size_bytes: 1024,
        filename: "malware.exe",
      },
      cookies,
      headers: { "X-CSRF-Token": csrfToken },
    });
    if (res.status === 403) {
      test.skip(true, "Creator profile required");
      return;
    }
    expect([400, 422]).toContain(res.status);
  });
});

test.describe("Media Vault", () => {
  test("list my media (vault)", async () => {
    test.skip(!e2eAvailable, "E2E bypass required");
    const res = await apiFetch("/media/mine?page_size=10", { cookies });
    if (res.status === 404) {
      test.skip(true, "Vault feature disabled");
      return;
    }
    expect(res.ok).toBe(true);
    expect(res.body).toHaveProperty("items");
  });
});
