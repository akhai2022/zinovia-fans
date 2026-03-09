import Link from "next/link";
import { Page } from "@/components/brand/Page";
import { Button } from "@/components/ui/button";
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

const ALTERNATIVES_FAQS = [
  {
    q: "How does Zinovia compare to other creator platforms?",
    a: "Zinovia offers lower fees (15% vs 20% on OnlyFans), faster payouts (48 hours vs weeks on most platforms), built-in AI tools for content creation and scheduling, and 5-layer content encryption including signed URLs and AES-256. Most alternatives only offer one or two of these advantages.",
  },
  {
    q: "What makes Zinovia different from OnlyFans?",
    a: "The key differences are fees (15% vs 20%), payout speed (48 hours vs 21 days), built-in AI tools for captions, scheduling, and content ideas, and stronger content protection with AES-256 encryption and invisible watermarking. OnlyFans has a larger existing audience, but Zinovia gives creators better economics and more tools.",
  },
  {
    q: "Is Zinovia good for SFW creators?",
    a: "Yes. Zinovia supports all content types — fitness, cooking, music, education, art, and more. NSFW content goes through a separate screening process, so SFW creators and their audiences are never exposed to adult material. The platform is designed to work equally well for any creator niche.",
  },
];

export default function AlternativesIndexPage() {
  const faqJsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: ALTERNATIVES_FAQS.map(({ q, a }) => ({
      "@type": "Question",
      name: q,
      acceptedAnswer: { "@type": "Answer", text: a },
    })),
  };

  return (
    <Page className="max-w-4xl space-y-10 py-12">
      <Breadcrumbs items={[{ label: "Alternatives" }]} />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }}
      />

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

      {/* FAQ */}
      <section className="space-y-4">
        <h2 className="font-display text-xl font-semibold text-foreground">
          Frequently Asked Questions
        </h2>
        <div className="divide-y divide-white/[0.06]">
          {ALTERNATIVES_FAQS.map(({ q, a }) => (
            <details key={q} className="group py-5">
              <summary className="flex cursor-pointer items-center justify-between text-sm font-medium text-foreground">
                {q}
                <svg
                  className="h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200 group-open:rotate-45"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                </svg>
              </summary>
              <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                {a}
              </p>
            </details>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="rounded-2xl border border-white/[0.06] bg-card p-8 text-center">
        <h2 className="font-display text-xl font-bold text-foreground">
          Ready to switch?
        </h2>
        <p className="mx-auto mt-3 max-w-lg text-sm text-muted-foreground">
          Join Zinovia and get lower fees, faster payouts, AI tools, and content protection out of the box.
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
