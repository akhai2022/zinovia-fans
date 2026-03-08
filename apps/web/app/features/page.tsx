import Link from "next/link";
import { Page } from "@/components/brand/Page";
import { Button } from "@/components/ui/button";
import { Breadcrumbs } from "@/components/seo/Breadcrumbs";
import { FEATURES } from "./[feature]/features";

const SITE_URL = "https://zinovia.ai";

export const metadata = {
  title: "Creator Platform Features | Zinovia",
  description:
    "Explore Zinovia's creator platform features: monthly subscriptions, 48-hour payouts, private messaging, paid unlocks, AI tools, content security, and real-time analytics.",
  alternates: { canonical: `${SITE_URL}/features` },
  openGraph: {
    title: "Creator Platform Features | Zinovia",
    description:
      "Explore Zinovia's creator platform features: subscriptions, fast payouts, messaging, paid unlocks, AI tools, content security, and analytics.",
    url: `${SITE_URL}/features`,
    siteName: "Zinovia Fans",
  },
};

const features = Object.values(FEATURES);

export default function FeaturesPage() {
  return (
    <Page className="max-w-4xl space-y-12 py-12">
      <Breadcrumbs items={[{ label: "Features" }]} />

      {/* Hero */}
      <header className="text-center space-y-4">
        <h1 className="font-display text-premium-h2 font-bold text-foreground">
          Everything you need to{" "}
          <span className="text-gradient-brand">earn</span>
        </h1>
        <p className="mx-auto max-w-xl text-muted-foreground">
          Subscriptions, fast payouts, private messaging, paid content, AI
          tools, content security, and analytics — all built into one platform
          designed for creators.
        </p>
      </header>

      {/* Features Grid */}
      <section className="space-y-6">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {features.map((feature) => (
            <Link
              key={feature.slug}
              href={`/features/${feature.slug}`}
              className="rounded-2xl border border-white/[0.06] bg-card p-6 transition-colors hover:border-primary/30"
            >
              <h2 className="text-sm font-semibold text-foreground">
                {feature.name}
              </h2>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground line-clamp-3">
                {feature.heroDescription}
              </p>
            </Link>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="rounded-2xl border border-white/[0.06] bg-card p-8 text-center">
        <h2 className="font-display text-xl font-bold text-foreground">
          Ready to get started?
        </h2>
        <p className="mx-auto mt-3 max-w-lg text-sm text-muted-foreground">
          Create your creator account in under 5 minutes. No upfront costs, no
          monthly platform fees.
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
