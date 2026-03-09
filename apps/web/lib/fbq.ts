/**
 * Meta (Facebook) Pixel utilities.
 *
 * Usage:
 *   import { fbqEvent } from "@/lib/fbq";
 *   fbqEvent("Lead");
 *   fbqEvent("Purchase", { value: 9.99, currency: "EUR" });
 */

export const META_PIXEL_ID = process.env.NEXT_PUBLIC_META_PIXEL_ID || "";

/** Whether Meta Pixel should fire. */
export const isFbqEnabled = (): boolean =>
  typeof window !== "undefined" &&
  !!META_PIXEL_ID &&
  process.env.NODE_ENV === "production";

/** Fire a standard Meta Pixel event. */
export function fbqEvent(
  eventName: string,
  params?: Record<string, string | number | boolean | undefined>,
) {
  if (!isFbqEnabled()) return;
  if (typeof window.fbq === "function") {
    window.fbq("track", eventName, params);
  }
}

/** Fire a custom Meta Pixel event. */
export function fbqCustomEvent(
  eventName: string,
  params?: Record<string, string | number | boolean | undefined>,
) {
  if (!isFbqEnabled()) return;
  if (typeof window.fbq === "function") {
    window.fbq("trackCustom", eventName, params);
  }
}

// ---------------------------------------------------------------------------
// Convenience wrappers for common events
// ---------------------------------------------------------------------------

export const fbqLead = () => fbqEvent("Lead");

export const fbqCompleteRegistration = (role: string) =>
  fbqEvent("CompleteRegistration", { content_name: role });

export const fbqPurchase = (value: number, currency = "EUR") =>
  fbqEvent("Purchase", { value, currency });

export const fbqSubscribe = (value: number, currency = "EUR") =>
  fbqEvent("Subscribe", { value, currency });

export const fbqSearch = (query: string) =>
  fbqEvent("Search", { search_string: query });

// ---------------------------------------------------------------------------
// TypeScript global augmentation
// ---------------------------------------------------------------------------

declare global {
  interface Window {
    fbq: (...args: unknown[]) => void;
    _fbq: (...args: unknown[]) => void;
  }
}
