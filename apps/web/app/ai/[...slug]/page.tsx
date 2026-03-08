import { redirect } from "next/navigation";

/**
 * Catch-all fallback: any /ai/* path that doesn't match a specific page
 * (e.g. /ai/tools/remove-bg, /ai/images, etc.) redirects to /ai.
 */
export default function AICatchAll() {
  redirect("/ai");
}
