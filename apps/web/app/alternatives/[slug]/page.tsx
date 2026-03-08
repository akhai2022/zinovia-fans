import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { Page } from "@/components/brand/Page";
import { Button } from "@/components/ui/button";
import { getAlternative, getAllAlternativeSlugs, ALTERNATIVES } from "../data";
import { Breadcrumbs } from "@/components/seo/Breadcrumbs";

const SITE_URL = "https://zinovia.ai";

export function generateStaticParams() {
  return getAllAlternativeSlugs().map((slug) => ({ slug }));
}

export async function generateMetadata({
  params,
}: {
  params: { slug: string };
}): Promise<Metadata> {
  const data = getAlternative(params.slug);
  if (!data) return { title: "Alternatives | Zinovia" };
  return {
    title: data.title,
    description: data.description,
    alternates: { canonical: `${SITE_URL}/alternatives/${data.slug}` },
    openGraph: {
      title: data.title,
      description: data.description,
      url: `${SITE_URL}/alternatives/${data.slug}`,
      siteName: "Zinovia Fans",
    },
  };
}

export default function AlternativePage({
  params,
}: {
  params: { slug: string };
}) {
  const data = getAlternative(params.slug);
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

  const itemListJsonLd = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: data.title,
    description: data.description,
    numberOfItems: data.platforms.length,
    itemListElement: data.platforms.map((platform, i) => ({
      "@type": "ListItem",
      position: i + 1,
      item: {
        "@type": "Product",
        name: platform.name,
        description: platform.bestFor,
        ...(platform.name === "Zinovia"
          ? { url: SITE_URL, brand: { "@type": "Brand", name: "Zinovia" } }
          : {}),
        additionalProperty: [
          { "@type": "PropertyValue", name: "Platform Fee", value: platform.fee },
          { "@type": "PropertyValue", name: "Payout Speed", value: platform.payoutSpeed },
          { "@type": "PropertyValue", name: "AI Tools", value: platform.aiTools },
          { "@type": "PropertyValue", name: "Content Protection", value: platform.contentProtection },
          { "@type": "PropertyValue", name: "Multilingual", value: platform.multilingual },
        ],
      },
    })),
  };

  const otherAlternatives = Object.values(ALTERNATIVES).filter(
    (alt) => alt.slug !== data.slug,
  );

  return (
    <Page className="max-w-4xl space-y-10 py-12">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(itemListJsonLd) }}
      />

      <Breadcrumbs
        items={[
          { label: "Alternatives", href: "/alternatives" },
          { label: data.name },
        ]}
      />

      {/* Hero */}
      <header className="space-y-3">
        <h1 className="font-display text-premium-h2 font-bold text-foreground">
          {data.title}
        </h1>
        <p className="max-w-2xl text-muted-foreground">{data.summary}</p>
      </header>

      {/* Platform Comparison Table */}
      <section className="space-y-4">
        <h2 className="font-display text-xl font-semibold text-foreground">
          Platform Comparison
        </h2>
        <div className="overflow-x-auto rounded-2xl border border-white/[0.06]">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/[0.06] bg-card">
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                  Platform
                </th>
                <th className="px-4 py-3 text-center font-medium text-muted-foreground">
                  Fee
                </th>
                <th className="px-4 py-3 text-center font-medium text-muted-foreground">
                  Payout Speed
                </th>
                <th className="px-4 py-3 text-center font-medium text-muted-foreground">
                  AI Tools
                </th>
                <th className="px-4 py-3 text-center font-medium text-muted-foreground">
                  Content Protection
                </th>
                <th className="px-4 py-3 text-center font-medium text-muted-foreground">
                  Multilingual
                </th>
              </tr>
            </thead>
            <tbody>
              {data.platforms.map((platform, i) => (
                <tr
                  key={platform.name}
                  className={
                    platform.name === "Zinovia"
                      ? "bg-primary/[0.05] border-l-2 border-l-primary"
                      : i % 2 === 0
                        ? "bg-background"
                        : "bg-card"
                  }
                >
                  <td className="px-4 py-3 font-medium text-foreground">
                    {platform.name === "Zinovia" ? (
                      <span className="text-gradient-brand">{platform.name}</span>
                    ) : (
                      platform.name
                    )}
                  </td>
                  <td className="px-4 py-3 text-center text-foreground/90">
                    {platform.fee}
                  </td>
                  <td className="px-4 py-3 text-center text-foreground/90">
                    {platform.payoutSpeed}
                  </td>
                  <td className="px-4 py-3 text-center text-foreground/90">
                    {platform.aiTools}
                  </td>
                  <td className="px-4 py-3 text-center text-foreground/90">
                    {platform.contentProtection}
                  </td>
                  <td className="px-4 py-3 text-center text-foreground/90">
                    {platform.multilingual}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Individual Platform Cards */}
      <section className="space-y-4">
        <h2 className="font-display text-xl font-semibold text-foreground">
          Platform Details
        </h2>
        <div className="grid gap-4 sm:grid-cols-2">
          {data.platforms.map((platform) => (
            <div
              key={platform.name}
              className={
                platform.name === "Zinovia"
                  ? "rounded-2xl border border-primary/30 bg-card p-6"
                  : "rounded-2xl border border-white/[0.06] bg-card p-6"
              }
            >
              <h3 className="font-display text-base font-semibold text-foreground">
                {platform.name === "Zinovia" ? (
                  <span className="text-gradient-brand">{platform.name}</span>
                ) : (
                  platform.name
                )}
              </h3>
              <dl className="mt-3 space-y-2 text-sm">
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">Platform Fee</dt>
                  <dd className="font-medium text-foreground">{platform.fee}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">Payout Speed</dt>
                  <dd className="font-medium text-foreground">
                    {platform.payoutSpeed}
                  </dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">AI Tools</dt>
                  <dd className="font-medium text-foreground">
                    {platform.aiTools}
                  </dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">Content Protection</dt>
                  <dd className="font-medium text-foreground">
                    {platform.contentProtection}
                  </dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">Multilingual</dt>
                  <dd className="font-medium text-foreground">
                    {platform.multilingual}
                  </dd>
                </div>
              </dl>
              <p className="mt-4 text-xs leading-relaxed text-muted-foreground">
                {platform.bestFor}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* FAQ */}
      <section className="space-y-4">
        <h2 className="font-display text-xl font-semibold text-foreground">
          Frequently Asked Questions
        </h2>
        <div className="divide-y divide-white/[0.06]">
          {data.faqs.map(({ q, a }) => (
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
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M12 4v16m8-8H4"
                  />
                </svg>
              </summary>
              <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                {a}
              </p>
            </details>
          ))}
        </div>
      </section>

      {/* Helpful Guides */}
      <section className="space-y-4">
        <h2 className="font-display text-xl font-semibold text-foreground">Helpful Guides</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          {[
            { href: "/guides/creator-platform-fees-compared", label: "Creator Platform Fees Compared", desc: "Side-by-side fee breakdown across all major creator platforms." },
            { href: "/guides/how-to-start-earning-as-creator", label: "How to Start Earning as a Creator", desc: "Step-by-step guide to launching and growing your creator income." },
            { href: "/guides/ai-tools-for-creators", label: "AI Tools for Creators", desc: "How AI-powered tools can help you create, promote, and earn more." },
          ].map((link) => (
            <Link key={link.href} href={link.href} className="rounded-2xl border border-white/[0.06] bg-card p-5 transition-colors hover:border-primary/30">
              <h3 className="text-sm font-semibold text-foreground">{link.label}</h3>
              <p className="mt-1 text-xs text-muted-foreground">{link.desc}</p>
            </Link>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="rounded-2xl border border-white/[0.06] bg-card p-8 text-center">
        <h2 className="font-display text-xl font-bold text-foreground">
          Ready to try Zinovia?
        </h2>
        <p className="mx-auto mt-3 max-w-lg text-sm text-muted-foreground">
          Join thousands of creators earning on their own terms. Fast payouts,
          secure content, 9 languages.
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

      {/* Cross-links: Other Alternatives */}
      <section className="space-y-4">
        <h2 className="font-display text-xl font-semibold text-foreground">
          More Alternative Guides
        </h2>
        <div className="flex flex-wrap gap-3">
          {otherAlternatives.map((alt) => (
            <Button key={alt.slug} variant="secondary" size="sm" asChild>
              <Link href={`/alternatives/${alt.slug}`}>{alt.name}</Link>
            </Button>
          ))}
        </div>
      </section>

      {/* Cross-links: Comparisons */}
      <section className="space-y-4">
        <h2 className="font-display text-xl font-semibold text-foreground">
          Head-to-Head Comparisons
        </h2>
        <div className="flex flex-wrap gap-3">
          {[
            { slug: "patreon", name: "Patreon" },
            { slug: "onlyfans", name: "OnlyFans" },
            { slug: "fanvue", name: "Fanvue" },
            { slug: "fansly", name: "Fansly" },
            { slug: "passes", name: "Passes" },
            { slug: "loyalfans", name: "LoyalFans" },
          ].map((c) => (
            <Button key={c.slug} variant="secondary" size="sm" asChild>
              <Link href={`/compare/${c.slug}`}>vs {c.name}</Link>
            </Button>
          ))}
        </div>
      </section>

      <div className="flex gap-2">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/alternatives">All alternative guides</Link>
        </Button>
      </div>
    </Page>
  );
}
