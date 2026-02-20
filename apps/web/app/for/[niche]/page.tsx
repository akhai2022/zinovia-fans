import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { Page } from "@/components/brand/Page";
import { Button } from "@/components/ui/button";
import { getNiche, getAllNicheSlugs } from "./niches";

const SITE_URL = "https://zinovia.ai";

export function generateStaticParams() {
  return getAllNicheSlugs().map((niche) => ({ niche }));
}

export async function generateMetadata({ params }: { params: { niche: string } }): Promise<Metadata> {
  const data = getNiche(params.niche);
  if (!data) return { title: "Zinovia Fans" };
  return {
    title: data.title,
    description: data.description,
    alternates: { canonical: `${SITE_URL}/for/${data.slug}` },
    openGraph: {
      title: data.title,
      description: data.description,
      url: `${SITE_URL}/for/${data.slug}`,
      siteName: "Zinovia Fans",
    },
  };
}

export default function NichePage({ params }: { params: { niche: string } }) {
  const data = getNiche(params.niche);
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
        <p className="text-sm font-medium text-primary">For {data.name}</p>
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

      {/* Pain Points */}
      <section className="space-y-6">
        <h2 className="font-display text-xl font-semibold text-foreground text-center">
          The problem with current options
        </h2>
        <div className="grid gap-4 md:grid-cols-3">
          {data.painPoints.map((point) => (
            <div key={point.title} className="rounded-2xl border border-white/[0.06] bg-card p-6">
              <h3 className="text-sm font-semibold text-foreground">{point.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{point.description}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Features */}
      <section className="space-y-6">
        <div className="text-center">
          <h2 className="font-display text-xl font-semibold text-foreground">
            Everything you need to monetize
          </h2>
          <p className="mt-2 text-muted-foreground">Built for {data.name.toLowerCase()} who want to earn on their own terms.</p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {data.features.map((feature) => (
            <div key={feature.title} className="flex flex-col gap-3 rounded-2xl border border-white/[0.06] bg-card p-6">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5} aria-hidden>
                  <path strokeLinecap="round" strokeLinejoin="round" d={feature.icon} />
                </svg>
              </div>
              <h3 className="text-sm font-semibold text-foreground">{feature.title}</h3>
              <p className="text-sm leading-relaxed text-muted-foreground">{feature.description}</p>
            </div>
          ))}
        </div>
      </section>

      {/* How It Works */}
      <section className="space-y-6">
        <h2 className="font-display text-xl font-semibold text-foreground text-center">
          Get started in 3 steps
        </h2>
        <div className="grid gap-6 md:grid-cols-3">
          {[
            { step: "01", title: "Create your profile", description: "Sign up, verify your identity, and set up your creator page in under 5 minutes." },
            { step: "02", title: "Publish content", description: "Upload exclusive content, set your subscription price, and start building your library." },
            { step: "03", title: "Get paid", description: "Earn from subscriptions, paid unlocks, tips, and DMs. Payouts arrive within 48 hours." },
          ].map(({ step, title, description }) => (
            <div key={step} className="rounded-2xl border border-white/[0.06] bg-card p-6">
              <span className="text-gradient-brand text-4xl font-bold">{step}</span>
              <h3 className="mt-3 text-base font-semibold text-foreground">{title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{description}</p>
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
        <h2 className="font-display text-xl font-bold text-foreground">Start earning as a {data.name.toLowerCase().replace(/s$/, "")}</h2>
        <p className="mx-auto mt-3 max-w-lg text-sm text-muted-foreground">
          Join thousands of creators building sustainable income on Zinovia. No upfront costs, no monthly fees.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-4">
          <Button size="lg" className="btn-cta-primary h-12 px-8 text-base" asChild>
            <Link href="/signup">Get started free</Link>
          </Button>
        </div>
      </section>
    </Page>
  );
}
