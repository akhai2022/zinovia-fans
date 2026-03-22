"use client";

import { useEffect, useRef, useCallback } from "react";
import { event } from "@/lib/gtag";

/**
 * Tracks engagement events on the pricing page:
 * - Scroll depth (25%, 50%, 75%, 100%)
 * - CTA button clicks
 * - FAQ interactions
 */
export function PricingEngagement() {
  const firedRef = useRef<Set<number>>(new Set());

  useEffect(() => {
    const thresholds = [25, 50, 75, 100];

    function onScroll() {
      const scrollTop = window.scrollY;
      const docHeight = document.documentElement.scrollHeight - window.innerHeight;
      if (docHeight <= 0) return;
      const pct = Math.round((scrollTop / docHeight) * 100);

      for (const t of thresholds) {
        if (pct >= t && !firedRef.current.has(t)) {
          firedRef.current.add(t);
          event("pricing_scroll_depth", { percent: t });
        }
      }
    }

    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Track CTA clicks via event delegation
  useEffect(() => {
    function onClick(e: MouseEvent) {
      const target = (e.target as HTMLElement).closest<HTMLAnchorElement>("a[href]");
      if (!target) return;
      const href = target.getAttribute("href") || "";
      if (href === "/signup") {
        event("pricing_cta_click", { label: target.textContent?.trim() || "signup" });
      } else if (href === "/demo" || href === "/demo/creator") {
        event("pricing_cta_click", { label: "demo" });
      } else if (href === "/compare" || href.startsWith("/alternatives")) {
        event("pricing_cta_click", { label: "compare" });
      }
    }

    document.addEventListener("click", onClick);
    return () => document.removeEventListener("click", onClick);
  }, []);

  // Track FAQ opens
  useEffect(() => {
    function onToggle(e: Event) {
      const details = e.target as HTMLDetailsElement;
      if (details.open) {
        const summary = details.querySelector("summary")?.textContent?.trim();
        event("pricing_faq_open", { question: summary || "unknown" });
      }
    }

    document.addEventListener("toggle", onToggle, true);
    return () => document.removeEventListener("toggle", onToggle, true);
  }, []);

  return null;
}
