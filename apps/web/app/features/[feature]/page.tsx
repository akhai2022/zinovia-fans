import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { Page } from "@/components/brand/Page";
import { Button } from "@/components/ui/button";
import { getFeature, getAllFeatureSlugs } from "./features";

const SITE_URL = "https://zinovia.ai";

export function generateStaticParams() {
  return getAllFeatureSlugs().map((feature) => ({ feature }));
}

export async function generateMetadata({ params }: { params: { feature: string } }): Promise<Metadata> {
  const data = getFeature(params.feature);
  if (!data) return { title: "Zinovia Fans" };
  return {
    title: data.title,
    description: data.description,
    alternates: { canonical: `${SITE_URL}/features/${data.slug}` },
    openGraph: {
      title: data.title,
      description: data.description,
      url: `${SITE_URL}/features/${data.slug}`,
      siteName: "Zinovia Fans",
    },
  };
}

export default function FeaturePage({ params }: { params: { feature: string } }) {
  const data = getFeature(params.feature);
  if (!data) notFound();

  const faqJsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: data.faqs.map(({ q, a }) => ({
      "@type": "Question",
      name: q,
      acceptedAnswer: { "@type": "Answer", text: a },
    })),
  };

  return (
    <Page className="max-w-4xl space-y-12 py-12">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }}
      />

      {/* Hero */}
      <header className="text-center space-y-4">
        <p className="text-sm font-medium text-primary">{data.name}</p>
        <h1 className="font-display text-premium-h2 font-bold text-foreground">
          {data.heroHeading}{" "}
          <span className="text-gradient-brand">{data.heroAccent}</span>
        </h1>
        <p className="mx-auto max-w-xl text-muted-foreground">{data.heroDescription}</p>
        <div className="flex flex-wrap justify-center gap-4 pt-2">
          <Button size="lg" className="btn-cta-primary h-12 px-8 text-base" asChild>
            <Link href="/signup">Get started free</Link>
          </Button>
          <Button size="lg" variant="secondary" className="h-12 px-8 text-base" asChild>
            <Link href="/creators">Explore creators</Link>
          </Button>
        </div>
      </header>

      {/* Benefits */}
      <section className="space-y-6">
        <h2 className="font-display text-xl font-semibold text-foreground text-center">Why creators choose this</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          {data.benefits.map((benefit) => (
            <div key={benefit.title} className="rounded-2xl border border-white/[0.06] bg-card p-6">
              <h3 className="text-sm font-semibold text-foreground">{benefit.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{benefit.description}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Details */}
      <section className="space-y-6">
        <h2 className="font-display text-xl font-semibold text-foreground text-center">How it works</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          {data.details.map((detail) => (
            <div key={detail.title} className="rounded-2xl border border-white/[0.06] bg-card p-6">
              <h3 className="text-sm font-semibold text-foreground">{detail.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{detail.description}</p>
            </div>
          ))}
        </div>
      </section>

      {/* FAQ */}
      <section className="space-y-4">
        <h2 className="font-display text-xl font-semibold text-foreground">Frequently Asked Questions</h2>
        <div className="divide-y divide-white/[0.06]">
          {data.faqs.map(({ q, a }) => (
            <details key={q} className="group py-5">
              <summary className="flex cursor-pointer items-center justify-between text-sm font-medium text-foreground">
                {q}
                <svg className="h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200 group-open:rotate-45" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                </svg>
              </summary>
              <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{a}</p>
            </details>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="rounded-2xl border border-white/[0.06] bg-card p-8 text-center">
        <h2 className="font-display text-xl font-bold text-foreground">Ready to get started?</h2>
        <p className="mx-auto mt-3 max-w-lg text-sm text-muted-foreground">
          Create your creator account in under 5 minutes. No upfront costs.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-4">
          <Button size="lg" className="btn-cta-primary h-12 px-8 text-base" asChild>
            <Link href="/signup">Become a creator</Link>
          </Button>
        </div>
      </section>
    </Page>
  );
}
