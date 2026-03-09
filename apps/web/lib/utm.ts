/**
 * UTM parameter capture and persistence.
 *
 * Captures UTM params from the URL on first visit and stores them in
 * localStorage so they survive navigation through the signup funnel.
 *
 * Usage:
 *   import { captureUtmParams, getStoredUtm } from "@/lib/utm";
 *   captureUtmParams();            // call once on app mount
 *   const utm = getStoredUtm();    // read when sending events
 */

const UTM_KEYS = [
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_content",
  "utm_term",
] as const;

const STORAGE_KEY = "zinovia_utm";
const CLICK_ID_KEYS = ["gclid", "fbclid", "ttclid"] as const;
const CLICK_ID_STORAGE_KEY = "zinovia_click_ids";

export type UtmParams = Partial<Record<(typeof UTM_KEYS)[number], string>>;
export type ClickIds = Partial<Record<(typeof CLICK_ID_KEYS)[number], string>>;

/** Capture UTM params + click IDs from current URL and persist to localStorage. */
export function captureUtmParams(): void {
  if (typeof window === "undefined") return;
  try {
    const url = new URL(window.location.href);

    // UTM params — first-touch attribution (don't overwrite if already set)
    const existing = localStorage.getItem(STORAGE_KEY);
    const hasUtm = UTM_KEYS.some((k) => url.searchParams.has(k));
    if (hasUtm && !existing) {
      const utm: UtmParams = {};
      for (const key of UTM_KEYS) {
        const val = url.searchParams.get(key);
        if (val) utm[key] = val;
      }
      localStorage.setItem(STORAGE_KEY, JSON.stringify(utm));
    }

    // Click IDs — always update (last-click attribution)
    const hasClickId = CLICK_ID_KEYS.some((k) => url.searchParams.has(k));
    if (hasClickId) {
      const ids: ClickIds = {};
      for (const key of CLICK_ID_KEYS) {
        const val = url.searchParams.get(key);
        if (val) ids[key] = val;
      }
      localStorage.setItem(CLICK_ID_STORAGE_KEY, JSON.stringify(ids));
    }
  } catch {
    // localStorage unavailable — non-critical
  }
}

/** Read stored UTM params. */
export function getStoredUtm(): UtmParams {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

/** Read stored click IDs (gclid, fbclid, ttclid). */
export function getStoredClickIds(): ClickIds {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(CLICK_ID_STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

/** Clear stored UTM data (e.g. after successful conversion). */
export function clearUtmData(): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(CLICK_ID_STORAGE_KEY);
  } catch {
    // non-critical
  }
}
