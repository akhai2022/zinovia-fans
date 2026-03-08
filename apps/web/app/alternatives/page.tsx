import Link from "next/link";
import { Page } from "@/components/brand/Page";
import { Breadcrumbs } from "@/components/seo/Breadcrumbs";
import { ALTERNATIVES } from "./data";

const SITE_URL = "https://zinovia.ai";

export const metadata = {
  title: "Best Creator Platform Alternatives — Zinovia Guides",
  description:
    "Explore comprehensive guides comparing the best creator platforms in 2026. OnlyFans alternatives, Patreon alternatives, and full platform rankings.",
  alternates: { canonical: `${SITE_URL}/alternatives` },
  openGraph: {
    title: "Best Creator Platform Alternatives — Zinovia Guides",
    description:
      "Explore comprehensive guides comparing the best creator platforms in 2026.",
    url: `${SITE_URL}/alternatives`,
    siteName: "Zinovia Fans",
  },
};

const GUIDES = Object.values(ALTERNATIVES).map((alt) => ({
  slug: alt.slug,
  name: alt.name,
  title: alt.title,
  description: alt.description,
  platformCount: alt.platforms.length,
}));

export default function AlternativesIndexPage() {
  return (
    <Page className="max-w-4xl space-y-10 py-12">
      <Breadcrumbs items={[{ label: "Alternatives" }]} />

      <header className="text-center space-y-3">
        <h1 className="font-display text-premium-h2 font-bold text-foreground">
          Creator Platform Alternatives
        </h1>
        <p className="mx-auto max-w-xl text-muted-foreground">
          Comprehensive guides to help you find the best creator monetisation
          platform. Compare fees, payouts, features, and more.
        </p>
      </header>

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {GUIDES.map((guide) => (
          <Link
            key={guide.slug}
            href={`/alternatives/${guide.slug}`}
            className="group rounded-2xl border border-white/[0.06] bg-card p-6 transition-colors hover:border-white/[0.12]"
          >
            <h2 className="font-display text-lg font-semibold text-foreground group-hover:text-gradient-brand">
              {guide.name}
            </h2>
            <p className="mt-2 text-sm text-muted-foreground line-clamp-2">
              {guide.description}
            </p>
            <div className="mt-4 flex items-center justify-between">
              <span className="text-xs text-muted-foreground">
                {guide.platformCount} platforms compared
              </span>
              <span className="text-sm font-medium text-primary">
                Read guide &rarr;
              </span>
            </div>
          </Link>
        ))}
      </section>
    </Page>
  );
}
