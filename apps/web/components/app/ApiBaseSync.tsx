"use client";

import { useEffect } from "react";
import { OpenAPI } from "@zinovia/contracts";
import { getBrowserApiBaseUrl } from "@/lib/env";

/**
 * Ensures OpenAPI.BASE is set in the browser before any API call.
 * Module-level init in lib/api.ts can run during SSR (no window); this runs once on client mount.
 */
export function ApiBaseSync() {
  useEffect(() => {
    const base = getBrowserApiBaseUrl();
    OpenAPI.BASE = base;
    if (
      process.env.NODE_ENV === "production" &&
      typeof window !== "undefined" &&
      new URLSearchParams(window.location.search).get("debugApi") === "1"
    ) {
      const sameOriginProxyEnabled =
        process.env.NEXT_PUBLIC_API_SAME_ORIGIN_PROXY === "true";
      console.info("[zinovia-fans] production API config", {
        base,
        sameOriginProxyEnabled,
      });
    }
  }, []);
  return null;
}
