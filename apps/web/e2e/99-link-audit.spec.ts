import { test, expect } from "@playwright/test";

const PAGES_TO_AUDIT = [
  "/",
  "/creators",
  "/about",
  "/pricing",
  "/how-it-works",
  "/privacy",
  "/terms",
  "/help",
  "/contact",
  "/signup",
  "/login",
  "/compare",
];

test.describe("Link Audit — find all broken links", () => {
  for (const page_url of PAGES_TO_AUDIT) {
    test(`audit links on ${page_url}`, async ({ page }) => {
      const broken: string[] = [];

      // Track 404 responses
      page.on("response", (response) => {
        if (response.status() === 404 && response.url().includes("zinovia.ai")) {
          broken.push(`[response] ${response.status()} ${response.url()}`);
        }
      });

      await page.goto(page_url);
      await page.waitForLoadState("networkidle");

      // Get all links on the page
      const links = await page.$$eval("a[href]", (anchors) =>
        anchors.map((a) => ({
          href: a.getAttribute("href") || "",
          text: a.textContent?.trim().slice(0, 50) || "",
        }))
      );

      // Filter internal links
      const internalLinks = links.filter(
        (l) =>
          l.href.startsWith("/") &&
          !l.href.startsWith("//") &&
          !l.href.includes("#") &&
          !l.href.startsWith("/api")
      );

      // Deduplicate
      const uniqueHrefs = [...new Set(internalLinks.map((l) => l.href))];

      console.log(`\n=== ${page_url} has ${uniqueHrefs.length} unique internal links ===`);
      for (const link of internalLinks) {
        console.log(`  [link] "${link.text}" → ${link.href}`);
      }

      // Navigate to each unique link and check for 404
      for (const href of uniqueHrefs) {
        try {
          const response = await page.goto(href);
          const status = response?.status() ?? 0;
          if (status === 404) {
            broken.push(`[navigate] 404 on ${href}`);
            console.log(`  ❌ 404: ${href}`);
          } else {
            // Also check page body for "not found" text
            const body = await page.textContent("body");
            if (body?.toLowerCase().includes("page not found") || body?.toLowerCase().includes("404")) {
              broken.push(`[soft-404] page shows "not found" on ${href}`);
              console.log(`  ⚠️ soft-404: ${href}`);
            }
          }
        } catch (err: any) {
          if (err?.message?.includes("ERR_NETWORK")) {
            // Retry once
            try {
              await page.waitForTimeout(500);
              const response = await page.goto(href);
              if (response?.status() === 404) {
                broken.push(`[navigate] 404 on ${href}`);
              }
            } catch {
              // skip transient
            }
          }
        }
      }

      if (broken.length > 0) {
        console.log(`\n❌ BROKEN LINKS on ${page_url}:`);
        for (const b of broken) console.log(`  ${b}`);
      }
      expect(broken, `Broken links found on ${page_url}: ${broken.join(", ")}`).toHaveLength(0);
    });
  }
});
