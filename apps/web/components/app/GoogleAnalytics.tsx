"use client";

import { useEffect } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import Script from "next/script";
import { GA_MEASUREMENT_ID, isGtagEnabled, pageview } from "@/lib/gtag";
import { GOOGLE_ADS_ID } from "@/lib/gads";

/**
 * Google Analytics 4 loader + route-change tracker.
 * Renders the gtag.js script tags and fires page_view on every client-side navigation.
 */
export function GoogleAnalytics() {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    if (!isGtagEnabled()) return;
    const url = pathname + (searchParams?.toString() ? `?${searchParams}` : "");
    pageview(url);
  }, [pathname, searchParams]);

  // Don't render anything in dev or if no valid ID
  if (process.env.NODE_ENV !== "production" || !GA_MEASUREMENT_ID.startsWith("G-")) {
    return null;
  }

  return (
    <>
      <Script
        src={`https://www.googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}`}
        strategy="afterInteractive"
      />
      <Script id="ga4-init" strategy="afterInteractive">
        {`
          window.dataLayer = window.dataLayer || [];
          function gtag(){dataLayer.push(arguments);}
          gtag('js', new Date());
          gtag('config', '${GA_MEASUREMENT_ID}', {
            page_path: window.location.pathname,
            send_page_view: true
          });${GOOGLE_ADS_ID ? `
          gtag('config', '${GOOGLE_ADS_ID}');` : ""}
        `}
      </Script>
    </>
  );
}
