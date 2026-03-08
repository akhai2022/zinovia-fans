import Link from "next/link";
import { Page } from "@/components/brand/Page";
import { Button } from "@/components/ui/button";
import { Breadcrumbs } from "@/components/seo/Breadcrumbs";
import { NICHES } from "./[niche]/niches";

const SITE_URL = "https://zinovia.ai";

export const metadata = {
  title: "Creator Platform for Every Niche | Zinovia",
  description:
    "Zinovia supports creators of every type — fitness, music, art, podcasting, education, fashion, travel, cosplay, lifestyle, and more. Monetize your passion with subscriptions, paid content, and 48-hour payouts.",
  alternates: { canonical: `${SITE_URL}/for` },
  openGraph: {
    title: "Creator Platform for Every Niche | Zinovia",
    description:
      "Zinovia supports creators of every type. Monetize your passion with subscriptions, paid content, and 48-hour payouts.",
    url: `${SITE_URL}/for`,
    siteName: "Zinovia Fans",
  },
};

const niches = Object.values(NICHES);

export default function ForCreatorsPage() {
  return (
    <Page className="max-w-4xl space-y-12 py-12">
      <Breadcrumbs items={[{ label: "For Creators" }]} />

      {/* Hero */}
      <header className="text-center space-y-4">
        <h1 className="font-display text-premium-h2 font-bold text-foreground">
          Built for every kind of{" "}
          <span className="text-gradient-brand">creator</span>
        </h1>
        <p className="mx-auto max-w-xl text-muted-foreground">
          Whether you teach, perform, write, or create — Zinovia gives you the
          tools to turn your audience into sustainable income. Explore how we
          support your niche.
        </p>
      </header>

      {/* Niche Grid */}
      <section className="space-y-6">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {niches.map((niche) => (
            <Link
              key={niche.slug}
              href={`/for/${niche.slug}`}
              className="rounded-2xl border border-white/[0.06] bg-card p-6 transition-colors hover:border-primary/30"
            >
              <h2 className="text-sm font-semibold text-foreground">
                {niche.name}
              </h2>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground line-clamp-3">
                {niche.heroDescription}
              </p>
            </Link>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="rounded-2xl border border-white/[0.06] bg-card p-8 text-center">
        <h2 className="font-display text-xl font-bold text-foreground">
          Don&apos;t see your niche?
        </h2>
        <p className="mx-auto mt-3 max-w-lg text-sm text-muted-foreground">
          Zinovia works for any creator who wants to monetize their content.
          Sign up for free and start earning — no matter what you create.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-4">
          <Button
            size="lg"
            className="btn-cta-primary h-12 px-8 text-base"
            asChild
          >
            <Link href="/signup">Get started free</Link>
          </Button>
          <Button
            size="lg"
            variant="secondary"
            className="h-12 px-8 text-base"
            asChild
          >
            <Link href="/creators">Explore creators</Link>
          </Button>
        </div>
      </section>
    </Page>
  );
}
