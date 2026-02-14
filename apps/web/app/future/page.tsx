"use client";

import Link from "next/link";
import { Page } from "@/components/brand/Page";
import { featureFlags } from "@/lib/featureFlags";

export default function FutureFeaturesPage() {
  const entries = [
    { key: "promotions", enabled: featureFlags.promotions, href: "/future/promotions", label: "Promotions / Discounts" },
    { key: "broadcast", enabled: featureFlags.dmBroadcast, href: "/future/broadcast", label: "Mass messaging" },
    { key: "ppv", enabled: featureFlags.ppvPosts, href: "/future/ppv-posts", label: "PPV posts" },
    { key: "moderation", enabled: featureFlags.moderation, href: "/future/moderation", label: "Reporting / Moderation" },
    { key: "analytics", enabled: featureFlags.analytics, href: "/future/analytics", label: "Creator analytics" },
  ];

  return (
    <Page>
      <h1 className="text-2xl font-semibold tracking-tight">Future Features</h1>
      <ul className="mt-4 space-y-2">
        {entries.map((entry) => (
          <li key={entry.key} className="rounded-brand border border-border p-3">
            <p className="text-sm font-medium">{entry.label}</p>
            <p className="text-xs text-muted-foreground">{entry.enabled ? "Enabled in this environment" : "Disabled by feature flag"}</p>
            {entry.enabled && (
              <Link href={entry.href} className="mt-2 inline-block text-sm text-primary underline">
                Open scaffold
              </Link>
            )}
          </li>
        ))}
      </ul>
    </Page>
  );
}

