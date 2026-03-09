"use client";

import { useEffect } from "react";
import { captureUtmParams } from "@/lib/utm";

/**
 * Captures UTM parameters and click IDs from the URL on mount.
 * Place once in the root layout.
 */
export function UtmCapture() {
  useEffect(() => {
    captureUtmParams();
  }, []);
  return null;
}
