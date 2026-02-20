/**
 * STEP 15 — AI image generation.
 */

import { test, expect } from "@playwright/test";
import {
  uniqueEmail,
  apiFetch,
  createVerifiedCreator,
  isE2EEnabled,
} from "./helpers";

const PASSWORD = "E2eAiImg1234!";
let cookies = "";
let csrfToken = "";
let e2eAvailable = false;

test.beforeAll(async () => {
  e2eAvailable = await isE2EEnabled();
  if (!e2eAvailable) return;

  const email = uniqueEmail("aiimg");
  const creator = await createVerifiedCreator(email, PASSWORD);
  cookies = creator.cookies;
  csrfToken = cookies.match(/csrf_token=([^;]+)/)?.[1] ?? "";
});

test.describe("AI Image Generation", () => {
  let jobId: string | null = null;

  test("generate AI image request", async () => {
    test.skip(!e2eAvailable, "E2E bypass required");
    const res = await apiFetch("/ai/images/generate", {
      method: "POST",
      body: {
        image_type: "avatar",
        preset: "portrait",
        subject: "anime girl",
        vibe: "dreamy",
        accent_color: "#FF69B4",
      },
      cookies,
      headers: { "X-CSRF-Token": csrfToken },
    });
    if (res.status === 403 || res.status === 404) {
      test.skip(true, "AI image generation not available");
      return;
    }
    expect(res.ok).toBe(true);
    expect(res.body).toHaveProperty("id");
    expect(res.body).toHaveProperty("status");
    jobId = res.body.id;
  });

  test("list AI image jobs", async () => {
    test.skip(!e2eAvailable, "E2E bypass required");
    const res = await apiFetch("/ai/images", { cookies });
    if (res.status === 403 || res.status === 404) {
      test.skip(true, "AI images not available");
      return;
    }
    expect(res.ok).toBe(true);
    expect(res.body).toHaveProperty("items");
  });

  test("get AI image job by ID", async () => {
    test.skip(!jobId, "No AI job created");
    const res = await apiFetch(`/ai/images/${jobId}`, { cookies });
    expect(res.ok).toBe(true);
    expect(res.body).toHaveProperty("status");
  });
});

test.describe("AI Images UI", () => {
  test("AI images page loads for creator", async ({ page }) => {
    test.skip(!e2eAvailable, "E2E bypass required");
    const email = uniqueEmail("aiui");
    await createVerifiedCreator(email, PASSWORD);

    await page.goto("/login");
    await page.getByLabel("Email").fill(email);
    await page.getByLabel("Password").fill(PASSWORD);
    await page.getByRole("button", { name: /sign in/i }).click();
    await page.waitForURL((url) => !url.pathname.includes("/login"), { timeout: 15000 });

    await page.goto("/ai/images");
    await page.waitForLoadState("networkidle");
    expect(page.url()).toContain("/ai/images");
  });
});
