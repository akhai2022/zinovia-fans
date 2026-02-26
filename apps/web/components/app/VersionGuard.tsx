"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Icon } from "@/components/ui/icon";

// Poll every 5 minutes — lightweight check, not aggressive.
const POLL_INTERVAL_MS = 5 * 60_000;
// Minimum gap between checks (prevents rapid duplicate calls on tab focus).
const THROTTLE_MS = 30_000;
// Build ID baked at build time — changes on each deploy.
const INITIAL_BUILD_ID = process.env.BUILD_ID || "dev";

export function VersionGuard() {
  const [stale, setStale] = useState(false);
  const lastCheckRef = useRef(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const check = useCallback(async () => {
    const now = Date.now();
    if (now - lastCheckRef.current < THROTTLE_MS) return;
    lastCheckRef.current = now;

    try {
      const res = await fetch("/version", { cache: "no-store" });
      if (!res.ok) return;
      const data: { id: string } = await res.json();
      if (data.id !== INITIAL_BUILD_ID && data.id !== "dev") {
        setStale(true);
        // Stop polling — we already know there's an update.
        if (timerRef.current) {
          clearInterval(timerRef.current);
          timerRef.current = null;
        }
      }
    } catch {
      // Network error — skip this cycle.
    }
  }, []);

  useEffect(() => {
    timerRef.current = setInterval(check, POLL_INTERVAL_MS);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [check]);

  // Check when user returns to the tab (catches deploys that happen while away).
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === "visible") void check();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [check]);

  if (!stale) return null;

  return (
    <div className="fixed bottom-4 left-1/2 z-50 -translate-x-1/2 animate-in fade-in slide-in-from-bottom-4">
      <div className="flex items-center gap-3 rounded-xl border border-primary/30 bg-background px-4 py-3 shadow-lg">
        <Icon name="system_update" className="icon-lg text-primary shrink-0" />
        <p className="text-sm text-foreground">
          A new version is available.
        </p>
        <button
          onClick={() => window.location.reload()}
          className="shrink-0 rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
        >
          Refresh
        </button>
      </div>
    </div>
  );
}
