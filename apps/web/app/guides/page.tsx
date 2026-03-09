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

const GUIDES_FAQS = [
  {
    q: "What topics do the Zinovia guides cover?",
    a: "Our guides cover creator monetization, platform fees and comparisons, content protection strategies, AI tools for creators, getting started tips, and specific advice for European creators. Each guide is designed to help you earn more and work smarter.",
  },
  {
    q: "Are the guides free to read?",
    a: "Yes, all Zinovia guides are completely free to read. We publish them to help creators make informed decisions about their platform, content strategy, and monetization approach — no account or payment required.",
  },
  {
    q: "Who writes the Zinovia guides?",
    a: "The Zinovia team writes all guides, drawing on industry data, platform comparisons, and direct creator feedback. We keep guides updated as platforms change their fees, features, and policies.",
  },
];

export default function GuidesIndexPage() {
  const faqJsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: GUIDES_FAQS.map(({ q, a }) => ({
      "@type": "Question",
      name: q,
      acceptedAnswer: { "@type": "Answer", text: a },
    })),
  };

  return (
    <Page className="max-w-4xl space-y-12 py-12">
      <Breadcrumbs items={[{ label: "Guides" }]} />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }}
      />

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

      {/* FAQ */}
      <section className="space-y-4">
        <h2 className="font-display text-xl font-semibold text-foreground">
          Frequently Asked Questions
        </h2>
        <div className="divide-y divide-white/[0.06]">
          {GUIDES_FAQS.map(({ q, a }) => (
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
