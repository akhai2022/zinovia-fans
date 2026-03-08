import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { Page } from "@/components/brand/Page";
import { Button } from "@/components/ui/button";
import { Breadcrumbs } from "@/components/seo/Breadcrumbs";
import { getGuide, getAllGuideSlugs } from "../data";

const SITE_URL = "https://zinovia.ai";

export function generateStaticParams() {
  return getAllGuideSlugs().map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: { params: { slug: string } }): Promise<Metadata> {
  const guide = getGuide(params.slug);
  if (!guide) return { title: "Zinovia Fans" };
  return {
    title: guide.title,
    description: guide.description,
    alternates: { canonical: `${SITE_URL}/guides/${guide.slug}` },
    openGraph: {
      title: guide.title,
      description: guide.description,
      url: `${SITE_URL}/guides/${guide.slug}`,
      siteName: "Zinovia Fans",
      type: "article",
    },
  };
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

export default function GuidePage({ params }: { params: { slug: string } }) {
  const guide = getGuide(params.slug);
  if (!guide) notFound();

  const faqJsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: guide.faqs.map(({ q, a }) => ({
      "@type": "Question",
      name: q,
      acceptedAnswer: { "@type": "Answer", text: a },
    })),
  };

  const articleJsonLd = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: guide.title,
    description: guide.description,
    author: { "@type": "Person", name: "Zinovia Team" },
    publisher: {
      "@type": "Organization",
      name: "Zinovia",
      url: SITE_URL,
    },
    mainEntityOfPage: `${SITE_URL}/guides/${guide.slug}`,
  };

  return (
    <Page className="max-w-4xl space-y-12 py-12">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(articleJsonLd) }}
      />
      <Breadcrumbs items={[{ label: "Guides", href: "/guides" }, { label: guide.title }]} />

      {/* Hero */}
      <header className="space-y-4">
        <h1 className="font-display text-premium-h2 font-bold text-foreground">
          {guide.title}
        </h1>
        <p className="text-muted-foreground leading-relaxed">{guide.summary}</p>
      </header>

      {/* Table of Contents */}
      <nav className="rounded-2xl border border-white/[0.06] bg-card p-6">
        <h2 className="text-sm font-semibold text-foreground mb-3">In this guide</h2>
        <ol className="space-y-2">
          {guide.sections.map((section, i) => (
            <li key={i}>
              <a
                href={`#${slugify(section.heading)}`}
                className="text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                {i + 1}. {section.heading}
              </a>
            </li>
          ))}
          <li>
            <a
              href="#faq"
              className="text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              {guide.sections.length + 1}. Frequently Asked Questions
            </a>
          </li>
        </ol>
      </nav>

      {/* Sections */}
      {guide.sections.map((section, i) => (
        <section key={i} id={slugify(section.heading)} className="space-y-4">
          <h2 className="font-display text-xl font-semibold text-foreground">
            {section.heading}
          </h2>
          {section.content.split("\n\n").map((paragraph, j) => (
            <p key={j} className="text-sm leading-relaxed text-muted-foreground">
              {paragraph}
            </p>
          ))}
        </section>
      ))}

      {/* FAQ */}
      <section id="faq" className="space-y-4">
        <h2 className="font-display text-xl font-semibold text-foreground">Frequently Asked Questions</h2>
        <div className="divide-y divide-white/[0.06]">
          {guide.faqs.map(({ q, a }) => (
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

      {/* Related Links */}
      <section className="space-y-4">
        <h2 className="font-display text-xl font-semibold text-foreground">Related Resources</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          {guide.relatedLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="rounded-2xl border border-white/[0.06] bg-card p-5 transition-colors hover:border-primary/30"
            >
              <span className="text-sm font-semibold text-foreground">{link.label}</span>
            </Link>
          ))}
        </div>
      </section>

      {/* Explore Alternatives */}
      <section className="space-y-4">
        <h2 className="font-display text-xl font-semibold text-foreground">Explore Alternatives</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          {[
            { href: "/alternatives/onlyfans-alternatives", label: "OnlyFans Alternatives", desc: "Compare the best alternatives to OnlyFans for creators." },
            { href: "/alternatives/patreon-alternatives", label: "Patreon Alternatives", desc: "Explore top Patreon alternatives with better fees and payouts." },
            { href: "/alternatives/creator-platforms", label: "Best Creator Platforms 2026", desc: "Full comparison of every major creator platform." },
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
          Ready to start creating on <span className="text-gradient-brand">Zinovia</span>?
        </h2>
        <p className="mx-auto mt-3 max-w-lg text-sm text-muted-foreground">
          Join thousands of creators earning with 15% fees, 48-hour payouts, and built-in AI tools. Create your account in under 5 minutes.
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
