/**
 * Google Analytics 4 (gtag.js) utilities.
 *
 * Usage:
 *   import { event } from "@/lib/gtag";
 *   event("signup_complete", { method: "email", role: "creator" });
 */

export const GA_MEASUREMENT_ID = process.env.NEXT_PUBLIC_GA_ID || "G-0NR7VCRDYH";

/** Whether analytics should be active (only in production with a valid ID). */
export const isGtagEnabled = (): boolean =>
  typeof window !== "undefined" &&
  GA_MEASUREMENT_ID.startsWith("G-") &&
  process.env.NODE_ENV === "production";

// ---------------------------------------------------------------------------
// Core helpers
// ---------------------------------------------------------------------------

/** Send a GA4 page_view (called automatically by the GoogleAnalytics component on route change). */
export function pageview(url: string) {
  if (!isGtagEnabled()) return;
  window.gtag("config", GA_MEASUREMENT_ID, { page_path: url });
}

/** Fire a custom GA4 event. */
export function event(
  action: string,
  params?: Record<string, string | number | boolean | undefined>,
) {
  if (!isGtagEnabled()) return;
  window.gtag("event", action, params);
}

// ---------------------------------------------------------------------------
// Funnel events — thin wrappers so event names stay consistent everywhere.
// ---------------------------------------------------------------------------

// --- Creator funnel ---

export const creatorSignup = () =>
  event("sign_up", { method: "email", role: "creator" });

export const creatorKycStarted = () =>
  event("creator_kyc_started");

export const creatorKycCompleted = () =>
  event("creator_kyc_completed");

export const creatorOnboardingCompleted = () =>
  event("creator_onboarding_completed");

export const creatorFirstPost = () =>
  event("creator_first_post");

export const creatorContentPublished = (postType: string) =>
  event("content_published", { content_type: postType });

// --- Fan funnel ---

export const fanSignup = () =>
  event("sign_up", { method: "email", role: "fan" });

export const fanSubscriptionPurchase = (creatorHandle: string, priceEur: number) =>
  event("purchase", {
    currency: "EUR",
    value: priceEur,
    item_name: `sub_${creatorHandle}`,
    transaction_type: "subscription",
  });

export const fanTipSent = (creatorHandle: string, amountEur: number) =>
  event("purchase", {
    currency: "EUR",
    value: amountEur,
    item_name: `tip_${creatorHandle}`,
    transaction_type: "tip",
  });

export const fanPpvUnlock = (creatorHandle: string, priceEur: number) =>
  event("purchase", {
    currency: "EUR",
    value: priceEur,
    item_name: `ppv_${creatorHandle}`,
    transaction_type: "ppv",
  });

export const fanSubscriptionCancelled = (creatorHandle: string) =>
  event("subscription_cancelled", { creator: creatorHandle });

// --- Auth & account ---

export const userLogin = () =>
  event("login", { method: "email" });

export const emailVerified = (role: "creator" | "fan") =>
  event("email_verified", { role });

export const passwordReset = () =>
  event("password_reset");

// --- Engagement ---

export const creatorFollowed = (creatorHandle: string) =>
  event("follow", { creator: creatorHandle });

export const creatorUnfollowed = (creatorHandle: string) =>
  event("unfollow", { creator: creatorHandle });

export const profileUpdated = () =>
  event("profile_updated");

export const searchPerformed = (query: string) =>
  event("search", { search_term: query });

export const messageInitiated = (creatorHandle: string) =>
  event("message_initiated", { creator: creatorHandle });

// --- General ---

export const pageEngagement = (pageName: string) =>
  event("page_engagement", { page_name: pageName });

// ---------------------------------------------------------------------------
// TypeScript global augmentation for window.gtag
// ---------------------------------------------------------------------------

declare global {
  interface Window {
    gtag: (...args: unknown[]) => void;
    dataLayer: unknown[];
  }
}
