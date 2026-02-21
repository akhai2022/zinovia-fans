import type { Dictionary } from "./types";
import { interpolate } from "./interpolate";

/**
 * Format a date string as a relative time label (e.g. "Just now", "5m ago", "2h ago").
 * Uses translated labels from `t.common`.
 */
export function formatRelativeTime(
  dateStr: string | null | undefined,
  common: Dictionary["common"],
): string {
  if (!dateStr) return common.never;
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMin = Math.floor(diffMs / 60_000);
  if (diffMin < 1) return common.justNow;
  if (diffMin < 60) return interpolate(common.minutesAgo, { count: diffMin });
  const diffHours = Math.floor(diffMin / 60);
  if (diffHours < 24) return interpolate(common.hoursAgo, { count: diffHours });
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return interpolate(common.daysAgo, { count: diffDays });
  return date.toLocaleDateString();
}
