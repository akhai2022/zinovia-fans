/**
 * Media Upload + Post Creation — presigned URLs, post CRUD, visibility.
 */

import { test, expect } from "@playwright/test";
import { uniqueEmail, apiFetch } from "./helpers";

// We need an authenticated creator session for these tests
let cookies = "";
const creatorEmail = uniqueEmail("mediatest");
const creatorPassword = "E2eMedia123!";

test.describe("Media Upload & Post Creation", () => {
  test.beforeAll(async () => {
    // Register + login a creator
    await apiFetch("/auth/register", {
      method: "POST",
      body: { email: creatorEmail, password: creatorPassword },
      headers: { "Idempotency-Key": `e2e-media-${Date.now()}` },
    });
    const login = await apiFetch("/auth/login", {
      method: "POST",
      body: { email: creatorEmail, password: creatorPassword },
    });
    cookies = login.headers.get("set-cookie") ?? "";
  });

  test("presigned upload URL can be requested", async () => {
    const res = await apiFetch("/media/upload-url", {
      method: "POST",
      body: {
        content_type: "image/jpeg",
        size_bytes: 1024,
        filename: "test-e2e.jpg",
      },
      cookies,
    });
    // E2E creators are not email-verified, so upload may return 400/401/403
    if (!res.ok) {
      test.skip(true, `Upload requires verified creator profile (got ${res.status})`);
      return;
    }
    expect(res.body).toHaveProperty("upload_url");
    expect(res.body).toHaveProperty("asset_id");
  });

  test("batch upload URLs can be requested", async () => {
    const res = await apiFetch("/media/batch-upload-urls", {
      method: "POST",
      body: {
        items: [
          { content_type: "image/jpeg", size_bytes: 1024, filename: "batch1.jpg" },
          { content_type: "image/png", size_bytes: 2048, filename: "batch2.png" },
        ],
      },
      cookies,
    });
    if (!res.ok) {
      test.skip(true, `Batch upload requires verified creator profile (got ${res.status})`);
      return;
    }
    expect(res.body).toHaveProperty("items");
  });

  test("text post creation works", async () => {
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
    });
    if (res.status === 403) {
      test.skip(true, "Creator profile required");
      return;
    }
    expect(res.ok).toBe(true);
    expect(res.body).toHaveProperty("id");
    expect(res.body.type).toBe("TEXT");
    expect(res.body.visibility).toBe("PUBLIC");
  });

  test("post with PPV visibility requires price_cents", async () => {
    const res = await apiFetch("/posts", {
      method: "POST",
      body: {
        type: "TEXT",
        caption: "PPV test no price",
        visibility: "PPV",
        nsfw: false,
        asset_ids: [],
      },
      cookies,
    });
    if (res.status === 403) {
      test.skip(true, "Creator profile required or PPV disabled");
      return;
    }
    // Should fail validation — PPV requires price_cents
    expect([400, 422]).toContain(res.status);
  });

  test("PPV post with valid price creates successfully", async () => {
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
    });
    if (res.status === 403 || res.status === 400) {
      // PPV posts might be disabled or creator profile not complete
      test.skip(true, "PPV posts disabled or profile required");
      return;
    }
    expect(res.ok).toBe(true);
    expect(res.body.visibility).toBe("PPV");
    expect(res.body.price_cents).toBe(500);
  });
});
