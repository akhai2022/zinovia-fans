import { describe, expect, it } from "vitest";
import { buildBillingReturnUrls } from "./checkoutUrls";

describe("buildBillingReturnUrls", () => {
  it("builds encoded success and cancel URLs", () => {
    const urls = buildBillingReturnUrls("https://zinovia.ai", "/creators/demo");
    expect(urls.successUrl).toBe("https://zinovia.ai/billing/success?return=%2Fcreators%2Fdemo");
    expect(urls.cancelUrl).toBe("https://zinovia.ai/billing/cancel?return=%2Fcreators%2Fdemo");
  });
});
