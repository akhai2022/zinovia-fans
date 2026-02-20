"use client";

import { useEffect } from "react";
import { OpenAPI } from "@zinovia/contracts";
import { getBrowserApiBaseUrl } from "@/lib/env";

// Set BASE at module load time so it's available before any useEffect fires.
// React fires child effects before parent effects, so relying solely on
// useEffect would leave OpenAPI.BASE unset for the first child effect cycle.
if (typeof window !== "undefined") {
  OpenAPI.BASE = getBrowserApiBaseUrl();
}

/**
 * Keeps OpenAPI.BASE in sync; the module-level init above handles the
 * initial load, this useEffect serves as a safety net.
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
