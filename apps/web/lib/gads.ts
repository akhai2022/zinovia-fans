/**
 * Google Ads conversion tracking utilities.
 *
 * Usage:
 *   import { gadsConversion } from "@/lib/gads";
 *   gadsConversion("AW-XXXXX/label", 9.99, "EUR");
 */

export const GOOGLE_ADS_ID = process.env.NEXT_PUBLIC_GOOGLE_ADS_ID || "";

/** Whether Google Ads tracking is active. */
export const isGadsEnabled = (): boolean =>
  typeof window !== "undefined" &&
  !!GOOGLE_ADS_ID &&
  process.env.NODE_ENV === "production";

/**
 * Fire a Google Ads conversion event.
 * @param conversionLabel - Full conversion label e.g. "AW-123456789/abcdef"
 * @param value - Conversion value
 * @param currency - Currency code (default EUR)
 */
export function gadsConversion(
  conversionLabel: string,
  value?: number,
  currency = "EUR",
) {
  if (!isGadsEnabled()) return;
  if (typeof window.gtag !== "function") return;

  window.gtag("event", "conversion", {
    send_to: conversionLabel,
    ...(value != null ? { value, currency } : {}),
  });
}

// ---------------------------------------------------------------------------
// Pre-defined conversion labels (set via env vars)
// ---------------------------------------------------------------------------

const SIGNUP_LABEL = process.env.NEXT_PUBLIC_GADS_SIGNUP_LABEL || "";
const PURCHASE_LABEL = process.env.NEXT_PUBLIC_GADS_PURCHASE_LABEL || "";

/** Track signup conversion in Google Ads. */
export const gadsSignup = () => {
  if (SIGNUP_LABEL) gadsConversion(SIGNUP_LABEL);
};

/** Track purchase conversion in Google Ads. */
export const gadsPurchase = (value: number, currency = "EUR") => {
  if (PURCHASE_LABEL) gadsConversion(PURCHASE_LABEL, value, currency);
};
