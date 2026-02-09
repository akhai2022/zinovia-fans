import { test, expect } from "@playwright/test";

test.describe("Smoke", () => {
  test("home page loads", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveTitle(/Zinovia|Fans|Home/i);
    await expect(page.getByRole("heading", { name: /Where creators get paid/i })).toBeVisible({ timeout: 10000 });
    await expect(page.getByRole("link", { name: "Start as creator" }).first()).toBeVisible({ timeout: 5000 });
  });

  test("login page loads", async ({ page }) => {
    await page.goto("/login");
    await expect(page.getByRole("heading", { name: "Sign in" })).toBeVisible({ timeout: 10000 });
  });

  test("signup page loads", async ({ page }) => {
    await page.goto("/signup");
    await expect(page.getByRole("heading", { name: "Create account" })).toBeVisible({ timeout: 10000 });
  });

  test("creators discover page loads", async ({ page }) => {
    await page.goto("/creators");
    await expect(page).toHaveURL(/\/creators/);
    await expect(page.getByRole("main")).toBeVisible({ timeout: 10000 });
  });

  test("creator profile verifycreator loads with header and posts section", async ({ page }) => {
    await page.goto("/creators/verifycreator");
    await expect(page).toHaveURL(/\/creators\/verifycreator/);
    const followOrUnfollow = page.getByRole("button", { name: /Follow|Unfollow/ });
    const creatorNotFound = page.getByText("Creator not found");
    const subscribeBtn = page.getByRole("button", { name: "Subscribe" });
    const postsHeading = page.getByRole("heading", { name: "Posts" });
    await expect(followOrUnfollow.or(creatorNotFound)).toBeVisible({ timeout: 10000 });
    if (await followOrUnfollow.isVisible()) {
      await expect(subscribeBtn).toBeVisible({ timeout: 5000 });
      await expect(postsHeading).toBeVisible({ timeout: 5000 });
    }
  });

  test("feed page loads without crash", async ({ page }) => {
    await page.goto("/feed");
    await expect(page).toHaveURL(/\/feed/);
    await expect(page.getByRole("main")).toBeVisible({ timeout: 10000 });
  });

  test("locked teaser shows Subscribe to unlock when present", async ({ page }) => {
    await page.goto("/creators/verifycreator");
    await expect(page).toHaveURL(/\/creators\/verifycreator/);
    const unlockText = page.getByText("Subscribe to unlock");
    const count = await unlockText.count();
    if (count > 0) {
      await expect(unlockText.first()).toBeVisible({ timeout: 5000 });
    }
  });

  test("creator post form includes Video type option", async ({ page }) => {
    await page.goto("/creator/post/new");
    await expect(page).toHaveURL(/\/creator\/post\/new/);
    const typeSelect = page.getByLabel("Type");
    await expect(typeSelect).toBeVisible({ timeout: 10000 });
    await expect(typeSelect).toHaveValue("TEXT");
    await typeSelect.selectOption({ value: "VIDEO" });
    await expect(typeSelect).toHaveValue("VIDEO");
  });
});
