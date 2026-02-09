"use client";

import { useEffect } from "react";
import { OpenAPI } from "@zinovia/contracts";
import { getApiBaseUrl } from "@/lib/apiBase";

/**
 * Ensures OpenAPI.BASE is set in the browser before any API call.
 * Module-level init in lib/api.ts can run during SSR (no window); this runs once on client mount.
 */
export function ApiBaseSync() {
  useEffect(() => {
    OpenAPI.BASE = getApiBaseUrl();
  }, []);
  return null;
}
