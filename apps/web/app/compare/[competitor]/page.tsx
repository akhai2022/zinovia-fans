import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { Page } from "@/components/brand/Page";
import { Button } from "@/components/ui/button";
import { getComparison, getAllComparisonSlugs } from "./comparisons";

const SITE_URL = "https://zinovia.ai";

export function generateStaticParams() {
  return getAllComparisonSlugs().map((competitor) => ({ competitor }));
}

export async function generateMetadata({ params }: { params: { competitor: string } }): Promise<Metadata> {
  const data = getComparison(params.competitor);
  if (!data) return { title: "Comparison | Zinovia" };
  return {
    title: data.title,
    description: data.description,
    alternates: { canonical: `${SITE_URL}/compare/${data.slug}` },
    openGraph: {
      title: data.title,
      description: data.description,
      url: `${SITE_URL}/compare/${data.slug}`,
      siteName: "Zinovia Fans",
    },
  };
}

export default function ComparisonPage({ params }: { params: { competitor: string } }) {
  const data = getComparison(params.competitor);
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
    <Page className="max-w-4xl space-y-10 py-12">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }}
      />

      <header className="space-y-3">
        <p className="text-sm font-medium text-primary">
          <Link href="/compare" className="hover:underline underline-offset-4">Compare</Link>
          {" / "}
          <span className="text-muted-foreground">vs {data.name}</span>
        </p>
        <h1 className="font-display text-premium-h2 font-bold text-foreground">{data.title}</h1>
        <p className="max-w-2xl text-muted-foreground">{data.summary}</p>
      </header>

      {/* Feature Comparison Table */}
      <section className="space-y-4">
        <h2 className="font-display text-xl font-semibold text-foreground">Feature Comparison</h2>
        <div className="overflow-x-auto rounded-2xl border border-white/[0.06]">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/[0.06] bg-[rgb(18,18,24)]">
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Feature</th>
                <th className="px-4 py-3 text-center font-medium text-foreground">Zinovia</th>
                <th className="px-4 py-3 text-center font-medium text-muted-foreground">{data.name}</th>
              </tr>
            </thead>
            <tbody>
              {data.features.map((row, i) => (
                <tr key={row.feature} className={i % 2 === 0 ? "bg-[rgb(14,14,18)]" : "bg-[rgb(18,18,24)]"}>
                  <td className="px-4 py-3 text-foreground/90">{row.feature}</td>
                  <td className="px-4 py-3 text-center text-foreground">{row.zinovia}</td>
                  <td className="px-4 py-3 text-center text-muted-foreground">{row.competitor}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Fees Comparison */}
      <section className="space-y-4">
        <h2 className="font-display text-xl font-semibold text-foreground">Fees &amp; Pricing</h2>
        <div className="overflow-x-auto rounded-2xl border border-white/[0.06]">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/[0.06] bg-[rgb(18,18,24)]">
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Fee Type</th>
                <th className="px-4 py-3 text-center font-medium text-foreground">Zinovia</th>
                <th className="px-4 py-3 text-center font-medium text-muted-foreground">{data.name}</th>
              </tr>
            </thead>
            <tbody>
              {data.fees.map((row, i) => (
                <tr key={row.label} className={i % 2 === 0 ? "bg-[rgb(14,14,18)]" : "bg-[rgb(18,18,24)]"}>
                  <td className="px-4 py-3 text-foreground/90">{row.label}</td>
                  <td className="px-4 py-3 text-center text-foreground">{row.zinovia}</td>
                  <td className="px-4 py-3 text-center text-muted-foreground">{row.competitor}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Payout Speed */}
      <section className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-2xl border border-white/[0.06] bg-[rgb(18,18,24)] p-6 text-center">
          <p className="text-sm text-muted-foreground">Zinovia Payout Speed</p>
          <p className="mt-2 font-display text-3xl font-bold text-gradient-brand">{data.payoutSpeed.zinovia}</p>
        </div>
        <div className="rounded-2xl border border-white/[0.06] bg-[rgb(18,18,24)] p-6 text-center">
          <p className="text-sm text-muted-foreground">{data.name} Payout Speed</p>
          <p className="mt-2 font-display text-3xl font-bold text-foreground/60">{data.payoutSpeed.competitor}</p>
        </div>
      </section>

      {/* Best For */}
      <section className="space-y-4">
        <h2 className="font-display text-xl font-semibold text-foreground">Which Is Right for You?</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="rounded-2xl border border-white/[0.06] bg-[rgb(18,18,24)] p-6">
            <h3 className="text-sm font-semibold text-foreground">Choose Zinovia if you want:</h3>
            <p className="mt-2 text-sm text-muted-foreground">{data.bestFor.zinovia}</p>
          </div>
          <div className="rounded-2xl border border-white/[0.06] bg-[rgb(18,18,24)] p-6">
            <h3 className="text-sm font-semibold text-foreground">Choose {data.name} if you want:</h3>
            <p className="mt-2 text-sm text-muted-foreground">{data.bestFor.competitor}</p>
          </div>
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
      <section className="rounded-2xl border border-white/[0.06] bg-[rgb(18,18,24)] p-8 text-center">
        <h2 className="font-display text-xl font-bold text-foreground">Ready to try Zinovia?</h2>
        <p className="mx-auto mt-3 max-w-lg text-sm text-muted-foreground">
          Join thousands of creators earning on their own terms. Fast payouts, secure content, 9 languages.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-4">
          <Button size="lg" className="btn-cta-primary h-12 px-8 text-base" asChild>
            <Link href="/signup">Get started free</Link>
          </Button>
          <Button size="lg" variant="secondary" className="h-12 px-8 text-base" asChild>
            <Link href="/creators">Explore creators</Link>
          </Button>
        </div>
      </section>

      <div className="flex gap-2">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/compare">All comparisons</Link>
        </Button>
      </div>
    </Page>
  );
}
