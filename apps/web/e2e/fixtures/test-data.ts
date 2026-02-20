/**
 * Test data generators and constants for E2E tests.
 */

export const TEST_PASSWORD = "E2eTestPass123!";

/** Generate a timestamp-based caption for uniqueness. */
export function testCaption(prefix = "E2E post"): string {
  return `${prefix} ${Date.now()}`;
}

/** Standard test post bodies for API-level creation. */
export const postTemplates = {
  publicText: (caption?: string) => ({
    type: "TEXT",
    caption: caption ?? testCaption("Public"),
    visibility: "PUBLIC",
    nsfw: false,
    asset_ids: [],
  }),
  subscribersText: (caption?: string) => ({
    type: "TEXT",
    caption: caption ?? testCaption("Subscribers-only"),
    visibility: "SUBSCRIBERS",
    nsfw: false,
    asset_ids: [],
  }),
  ppvText: (priceCents = 500, caption?: string) => ({
    type: "TEXT",
    caption: caption ?? testCaption("PPV"),
    visibility: "PPV",
    nsfw: false,
    asset_ids: [],
    price_cents: priceCents,
  }),
  privateText: (caption?: string) => ({
    type: "TEXT",
    caption: caption ?? testCaption("Private"),
    visibility: "PRIVATE",
    nsfw: false,
    asset_ids: [],
  }),
};

/** CCBill test mode expected values. */
export const ccbillTest = {
  currencyCode: "978", // EUR
  testMode: true,
};
