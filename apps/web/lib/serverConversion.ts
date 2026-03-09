/**
 * Client-side helper to send server-side conversions via /api/conversions.
 * This forwards events to Meta CAPI and Google Ads enhanced conversions.
 *
 * Usage:
 *   import { sendServerConversion } from "@/lib/serverConversion";
 *   sendServerConversion("sign_up", { email: "user@example.com" });
 */

import { getStoredClickIds } from "@/lib/utm";

export function sendServerConversion(
  eventName: string,
  params?: {
    email?: string;
    value?: number;
    currency?: string;
  },
) {
  if (typeof window === "undefined") return;
  if (process.env.NODE_ENV !== "production") return;

  const clickIds = getStoredClickIds();

  // Fire-and-forget — don't block the UI
  fetch("/api/conversions", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      event_name: eventName,
      email: params?.email,
      value: params?.value,
      currency: params?.currency || "EUR",
      source_url: window.location.href,
      click_ids: clickIds,
    }),
    keepalive: true, // ensure request completes even on page navigation
  }).catch(() => {
    // Non-critical — don't break the user flow
  });
}
