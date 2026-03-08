import Link from "next/link";
import type { Metadata } from "next";
import { Page } from "@/components/brand/Page";
import { Button } from "@/components/ui/button";
import { Breadcrumbs } from "@/components/seo/Breadcrumbs";
import { GUIDES } from "./data";

const SITE_URL = "https://zinovia.ai";

export const metadata: Metadata = {
  title: "Creator Guides — Tips, Comparisons & Strategies | Zinovia",
  description:
    "In-depth guides for content creators. Platform fee comparisons, content protection strategies, AI tools, getting started tips, and more — by the Zinovia team.",
  alternates: { canonical: `${SITE_URL}/guides` },
  openGraph: {
    title: "Creator Guides — Tips, Comparisons & Strategies | Zinovia",
    description:
      "In-depth guides for content creators. Platform fee comparisons, content protection strategies, AI tools, getting started tips, and more.",
    url: `${SITE_URL}/guides`,
    siteName: "Zinovia Fans",
  },
};

export default function GuidesIndexPage() {
  return (
    <Page className="max-w-4xl space-y-12 py-12">
      <Breadcrumbs items={[{ label: "Guides" }]} />

      {/* Hero */}
      <header className="text-center space-y-4">
        <h1 className="font-display text-premium-h2 font-bold text-foreground">
          Creator <span className="text-gradient-brand">Guides</span>
        </h1>
        <p className="mx-auto max-w-xl text-muted-foreground">
          In-depth guides to help you earn more, protect your content, and grow your audience as a creator.
        </p>
      </header>

      {/* Guide Cards */}
      <section className="grid gap-4 sm:grid-cols-2">
        {GUIDES.map((guide) => (
          <Link
            key={guide.slug}
            href={`/guides/${guide.slug}`}
            className="rounded-2xl border border-white/[0.06] bg-card p-6 transition-colors hover:border-primary/30"
          >
            <h2 className="font-display text-sm font-semibold text-foreground">{guide.title}</h2>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground line-clamp-3">
              {guide.description}
            </p>
            <span className="mt-4 inline-block text-xs font-medium text-primary">
              Read guide &rarr;
            </span>
          </Link>
        ))}
      </section>

      {/* CTA */}
      <section className="rounded-2xl border border-white/[0.06] bg-card p-8 text-center">
        <h2 className="font-display text-xl font-bold text-foreground">
          Ready to start creating?
        </h2>
        <p className="mx-auto mt-3 max-w-lg text-sm text-muted-foreground">
          Create your creator account in under 5 minutes. 15% fees, 48-hour payouts, built-in AI tools.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-4">
          <Button size="lg" className="btn-cta-primary h-12 px-8 text-base" asChild>
            <Link href="/signup">Get started free</Link>
          </Button>
          <Button size="lg" variant="secondary" className="h-12 px-8 text-base" asChild>
            <Link href="/pricing">View pricing</Link>
          </Button>
        </div>
      </section>
    </Page>
  );
}
