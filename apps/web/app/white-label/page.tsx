import Link from "next/link";
import { Page } from "@/components/brand/Page";
import { Button } from "@/components/ui/button";
import { Breadcrumbs } from "@/components/seo/Breadcrumbs";

const SITE_URL = "https://zinovia.ai";

export const metadata = {
  title: "White-Label Creator Platform — Own Your Brand | Zinovia",
  description:
    "Customize your creator page on Zinovia with your own branding. Custom domains, branded profiles, and full control over your fan experience.",
  alternates: { canonical: `${SITE_URL}/white-label` },
  openGraph: {
    title: "White-Label Creator Platform — Own Your Brand | Zinovia",
    description:
      "Customize your creator page on Zinovia with your own branding. Custom domains, branded profiles, and full control over your fan experience.",
    url: `${SITE_URL}/white-label`,
    siteName: "Zinovia Fans",
  },
};

const COMPARISON_ROWS = [
  { feature: "Setup time", zinovia: "Minutes", scrile: "Weeks", fourthwall: "Days", diy: "Months" },
  { feature: "Monthly cost", zinovia: "Free (rev share)", scrile: "$$$+/month", fourthwall: "Free (rev share)", diy: "Server costs" },
  { feature: "Custom branding", zinovia: "Yes", scrile: "Full", fourthwall: "Partial", diy: "Full" },
  { feature: "Payment processing", zinovia: "Built-in", scrile: "BYO", fourthwall: "Built-in", diy: "BYO" },
  { feature: "Content protection", zinovia: "Signed URLs + encryption", scrile: "Basic", fourthwall: "Basic", diy: "BYO" },
  { feature: "AI tools", zinovia: "Built-in", scrile: "None", fourthwall: "None", diy: "BYO" },
  { feature: "Payout speed", zinovia: "48 hours", scrile: "Varies", fourthwall: "14 days", diy: "Varies" },
  { feature: "Mobile app", zinovia: "PWA", scrile: "No", fourthwall: "No", diy: "BYO" },
];

const FEATURE_CARDS = [
  {
    title: "Custom Creator Profiles",
    description:
      "Personalize your page with your own bio, cover photos, brand colors. Your page looks and feels like yours, not a generic template.",
    icon: "M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z",
  },
  {
    title: "Vanity URLs",
    description:
      "Your fans visit zinovia.ai/yourname — clean, memorable, shareable. No random IDs or ugly URLs.",
    icon: "M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1",
  },
  {
    title: "Branded Content",
    description:
      "Your content, your watermarks, your style — AI tools help maintain consistency across every post and message.",
    icon: "M9.53 16.122a3 3 0 00-5.78 1.128 2.25 2.25 0 01-2.4 2.245 4.5 4.5 0 008.4-2.245c0-.399-.078-.78-.22-1.128zm0 0a15.998 15.998 0 003.388-1.62m-5.043-.025a15.994 15.994 0 011.622-3.395m3.42 3.42a15.995 15.995 0 004.764-4.648l3.876-5.814a1.151 1.151 0 00-1.597-1.597L14.146 6.32a15.996 15.996 0 00-4.649 4.763m3.42 3.42a6.776 6.776 0 00-3.42-3.42",
  },
  {
    title: "Full Ownership",
    description:
      "You keep your subscriber list, content, and earnings. Export anytime. No lock-in, no hidden restrictions.",
    icon: "M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z",
  },
];

const WHITE_LABEL_FAQS = [
  {
    q: "Can I use my own domain with Zinovia?",
    a: "Custom domain support is on our roadmap. Currently, every creator gets a clean vanity URL at zinovia.ai/yourname. When custom domains launch, you will be able to point your own domain to your Zinovia creator page with full SSL support.",
  },
  {
    q: "How customizable is my creator page?",
    a: "You can customize your bio, cover photos, profile image, brand colors, and content layout. Your page is designed to reflect your personal brand, not look like a generic platform page. We are continually adding more customization options based on creator feedback.",
  },
  {
    q: "What's the difference between Zinovia and Scrile Connect?",
    a: "Scrile Connect is a fully white-label solution where you build and host your own platform from scratch, which requires weeks of setup and significant monthly costs. Zinovia gives you professional branding customization, built-in payments, AI tools, and 5-layer content protection — all ready in minutes with zero upfront cost.",
  },
  {
    q: "Do I own my subscriber list?",
    a: "Yes. Your subscriber list is yours. You can export your subscriber data at any time. Zinovia does not lock you in or restrict access to your own audience data. If you ever decide to leave, your relationships come with you.",
  },
  {
    q: "Can I migrate from another platform to Zinovia?",
    a: "Yes. Zinovia supports content migration from other creator platforms. You can import your existing content, set up your branded profile, and notify your subscribers about the move. Our team can help with the transition to make it as smooth as possible.",
  },
];

export default function WhiteLabelPage() {
  const faqJsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: WHITE_LABEL_FAQS.map(({ q, a }) => ({
      "@type": "Question",
      name: q,
      acceptedAnswer: { "@type": "Answer", text: a },
    })),
  };

  return (
    <Page className="max-w-4xl space-y-12 py-12">
      <Breadcrumbs items={[{ label: "White-Label" }]} />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }}
      />

      {/* Hero */}
      <header className="text-center space-y-4">
        <h1 className="font-display text-premium-h2 font-bold text-foreground">
          Your platform.{" "}
          <span className="text-gradient-brand">Your brand.</span>
        </h1>
        <p className="mx-auto max-w-xl text-muted-foreground">
          Zinovia gives you professional branding customization — custom
          profiles, vanity URLs, and branded content — without the cost and
          complexity of fully white-label platforms like Scrile Connect or
          Fourthwall. Start earning in minutes, not months.
        </p>
      </header>

      {/* Comparison Table */}
      <section className="space-y-4">
        <h2 className="font-display text-xl font-semibold text-foreground text-center">
          DIY vs Zinovia vs Full White-Label
        </h2>
        <p className="text-center text-sm text-muted-foreground">
          See how Zinovia compares to building your own platform or going fully white-label.
        </p>
        <div className="overflow-x-auto rounded-2xl border border-white/[0.06]">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/[0.06] bg-card">
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Feature</th>
                <th className="px-4 py-3 text-center font-medium text-primary">Zinovia</th>
                <th className="px-4 py-3 text-center font-medium text-muted-foreground">Scrile Connect</th>
                <th className="px-4 py-3 text-center font-medium text-muted-foreground">Fourthwall</th>
                <th className="px-4 py-3 text-center font-medium text-muted-foreground">Build Your Own</th>
              </tr>
            </thead>
            <tbody>
              {COMPARISON_ROWS.map((row, i) => (
                <tr
                  key={row.feature}
                  className={i % 2 === 0 ? "bg-background" : "bg-card"}
                >
                  <td className="px-4 py-3 font-medium text-foreground">{row.feature}</td>
                  <td className="px-4 py-3 text-center font-medium text-foreground">{row.zinovia}</td>
                  <td className="px-4 py-3 text-center text-muted-foreground">{row.scrile}</td>
                  <td className="px-4 py-3 text-center text-muted-foreground">{row.fourthwall}</td>
                  <td className="px-4 py-3 text-center text-muted-foreground">{row.diy}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Feature Cards */}
      <section className="space-y-6">
        <div className="text-center">
          <h2 className="font-display text-xl font-semibold text-foreground">
            Brand tools built for creators
          </h2>
          <p className="mt-2 text-muted-foreground">
            Everything you need to make your page truly yours.
          </p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          {FEATURE_CARDS.map(({ title, description, icon }) => (
            <div
              key={title}
              className="rounded-2xl border border-white/[0.06] bg-card p-6 space-y-3"
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <svg
                  className="h-5 w-5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={1.5}
                  aria-hidden
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d={icon} />
                </svg>
              </div>
              <h3 className="font-display text-sm font-semibold text-foreground">
                {title}
              </h3>
              <p className="text-sm leading-relaxed text-muted-foreground">
                {description}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* Best For Section */}
      <section className="space-y-6">
        <h2 className="font-display text-xl font-semibold text-foreground text-center">
          Which option is right for you?
        </h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="rounded-2xl border-2 border-primary/50 bg-card p-6 space-y-3">
            <h3 className="font-display text-sm font-semibold text-primary">
              Choose Zinovia if:
            </h3>
            <p className="text-sm leading-relaxed text-muted-foreground">
              You want to start earning immediately with professional branding,
              zero setup cost, built-in payments, AI tools, and content
              protection — without managing infrastructure.
            </p>
          </div>
          <div className="rounded-2xl border border-white/[0.06] bg-card p-6 space-y-3">
            <h3 className="font-display text-sm font-semibold text-foreground">
              Choose a full white-label if:
            </h3>
            <p className="text-sm leading-relaxed text-muted-foreground">
              You have a large existing audience, technical resources, and want
              100% control over every pixel and payment flow.
            </p>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="space-y-4">
        <h2 className="font-display text-xl font-semibold text-foreground">
          Frequently Asked Questions
        </h2>
        <div className="divide-y divide-white/[0.06]">
          {WHITE_LABEL_FAQS.map(({ q, a }) => (
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

      {/* Related Resources */}
      <section className="space-y-4">
        <h2 className="font-display text-xl font-semibold text-foreground">
          Related Resources
        </h2>
        <div className="grid gap-3 sm:grid-cols-2">
          {[
            {
              href: "/compare/scrile-connect",
              label: "Zinovia vs Scrile Connect",
              desc: "Full comparison of features, pricing, and setup.",
            },
            {
              href: "/compare/fourthwall",
              label: "Zinovia vs Fourthwall",
              desc: "Compare branding tools, payouts, and creator features.",
            },
            {
              href: "/alternatives/creator-platforms",
              label: "Best Creator Platforms",
              desc: "Ranked list of the top creator monetization platforms.",
            },
            {
              href: "/guides/how-to-start-earning-as-creator",
              label: "Getting Started Guide",
              desc: "Step-by-step guide to launching your creator page.",
            },
          ].map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="rounded-2xl border border-white/[0.06] bg-card p-5 transition-colors hover:border-primary/30"
            >
              <h3 className="text-sm font-semibold text-foreground">
                {link.label}
              </h3>
              <p className="mt-1 text-xs text-muted-foreground">{link.desc}</p>
            </Link>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="rounded-2xl border border-white/[0.06] bg-card p-8 text-center">
        <h2 className="font-display text-xl font-bold text-foreground">
          Own your brand. Start free.
        </h2>
        <p className="mx-auto mt-3 max-w-lg text-sm text-muted-foreground">
          Set up your branded creator page in minutes. Custom profiles, vanity
          URLs, AI tools, and 5-layer content protection — all included.
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
