import Link from "next/link";
import { Page } from "@/components/brand/Page";
import { Button } from "@/components/ui/button";
import { Breadcrumbs } from "@/components/seo/Breadcrumbs";
import { EarningsCalculator } from "./EarningsCalculator";

const SITE_URL = "https://zinovia.ai";

export const metadata = {
  title: "Creator Earnings Calculator — Estimate Your Income | Zinovia",
  description:
    "Calculate how much you could earn as a creator on Zinovia. Compare earnings across platforms with different fee structures and payout speeds.",
  alternates: { canonical: `${SITE_URL}/earnings-calculator` },
  openGraph: {
    title: "Creator Earnings Calculator — Estimate Your Income | Zinovia",
    description:
      "Calculate how much you could earn as a creator on Zinovia. Compare earnings across platforms with different fee structures and payout speeds.",
    url: `${SITE_URL}/earnings-calculator`,
    siteName: "Zinovia Fans",
  },
};

const FEE_COMPARISON = [
  {
    platform: "Zinovia",
    platformFee: "15%",
    paymentProcessing: "Included",
    totalTake: "15%",
    payoutSpeed: "48 hours",
    highlight: true,
  },
  {
    platform: "OnlyFans",
    platformFee: "20%",
    paymentProcessing: "Included",
    totalTake: "20%",
    payoutSpeed: "21 days",
    highlight: false,
  },
  {
    platform: "Patreon",
    platformFee: "8\u201312%",
    paymentProcessing: "2.9% + $0.30",
    totalTake: "~13%",
    payoutSpeed: "30+ days",
    highlight: false,
  },
  {
    platform: "Fansly",
    platformFee: "20%",
    paymentProcessing: "Included",
    totalTake: "20%",
    payoutSpeed: "7 days",
    highlight: false,
  },
  {
    platform: "Ko-fi",
    platformFee: "0\u20135%",
    paymentProcessing: "PayPal/Stripe fees",
    totalTake: "~5\u20138%",
    payoutSpeed: "Instant (PayPal)",
    highlight: false,
  },
];

const EARNINGS_FAQS = [
  {
    q: "How much do creators typically earn?",
    a: "Creator earnings vary widely depending on niche, audience size, and engagement. Creators with 500 subscribers at a mid-range price point can earn several thousand euros per month. Top creators on Zinovia earn significantly more through a combination of subscriptions, paid unlocks, tips, and private messaging.",
  },
  {
    q: "What fees does Zinovia charge?",
    a: "Zinovia charges a flat 15% platform fee on all earnings. This includes payment processing — there are no additional transaction fees, payout fees, or hidden costs. You keep 85% of everything you earn.",
  },
  {
    q: "How does Zinovia compare to OnlyFans fees?",
    a: "OnlyFans charges 20% of all creator earnings, while Zinovia charges only 15%. On a monthly gross revenue of \u20AC10,000, that means you keep \u20AC8,500 on Zinovia versus \u20AC8,000 on OnlyFans — an extra \u20AC500 per month, or \u20AC6,000 per year.",
  },
  {
    q: "When do I get paid on Zinovia?",
    a: "Zinovia processes payouts within 48 hours of your request. Funds are sent directly to your bank account via secure bank transfer (SEPA for EUR, SWIFT for USD and GBP). There is no minimum payout threshold and no payout fees.",
  },
  {
    q: "Can I earn from tips and DMs too?",
    a: "Yes. Zinovia supports multiple revenue streams: monthly subscriptions, paid content unlocks, tips, and paid private messages. All of these are included in your earnings with the same 15% fee. Many creators earn a significant portion of their income from tips and paid DMs.",
  },
];

export default function EarningsCalculatorPage() {
  const faqJsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: EARNINGS_FAQS.map(({ q, a }) => ({
      "@type": "Question",
      name: q,
      acceptedAnswer: { "@type": "Answer", text: a },
    })),
  };

  return (
    <Page className="max-w-4xl space-y-12 py-12">
      <Breadcrumbs items={[{ label: "Earnings Calculator" }]} />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }}
      />

      {/* Hero */}
      <header className="text-center space-y-4">
        <h1 className="font-display text-premium-h2 font-bold text-foreground">
          How much could you{" "}
          <span className="text-gradient-brand">earn?</span>
        </h1>
        <p className="mx-auto max-w-xl text-muted-foreground">
          Use the calculator below to estimate your monthly and annual creator
          earnings on Zinovia. See how our 15% fee compares to OnlyFans,
          Patreon, Fansly, and other platforms.
        </p>
      </header>

      {/* Interactive Calculator */}
      <EarningsCalculator />

      {/* Platform Fee Comparison Table */}
      <section className="space-y-4">
        <h2 className="font-display text-xl font-semibold text-foreground text-center">
          Platform fee comparison
        </h2>
        <p className="text-center text-sm text-muted-foreground">
          See what each platform takes from your earnings.
        </p>
        <div className="overflow-x-auto rounded-2xl border border-white/[0.06]">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/[0.06] bg-card">
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                  Platform
                </th>
                <th className="px-4 py-3 text-center font-medium text-muted-foreground">
                  Platform Fee
                </th>
                <th className="px-4 py-3 text-center font-medium text-muted-foreground">
                  Payment Processing
                </th>
                <th className="px-4 py-3 text-center font-medium text-muted-foreground">
                  Total Take
                </th>
                <th className="px-4 py-3 text-center font-medium text-muted-foreground">
                  Payout Speed
                </th>
              </tr>
            </thead>
            <tbody>
              {FEE_COMPARISON.map((row, i) => (
                <tr
                  key={row.platform}
                  className={`${i % 2 === 0 ? "bg-background" : "bg-card"} ${row.highlight ? "font-medium text-foreground" : "text-muted-foreground"}`}
                >
                  <td className="px-4 py-3">
                    {row.platform}
                    {row.highlight && (
                      <span className="ml-2 text-xs text-primary">
                        (You are here)
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-center">{row.platformFee}</td>
                  <td className="px-4 py-3 text-center">
                    {row.paymentProcessing}
                  </td>
                  <td className="px-4 py-3 text-center">
                    {row.highlight ? (
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
                        {row.totalTake}
                      </span>
                    ) : (
                      row.totalTake
                    )}
                  </td>
                  <td className="px-4 py-3 text-center">{row.payoutSpeed}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* FAQ */}
      <section className="space-y-4">
        <h2 className="font-display text-xl font-semibold text-foreground">
          Frequently Asked Questions
        </h2>
        <div className="divide-y divide-white/[0.06]">
          {EARNINGS_FAQS.map(({ q, a }) => (
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

      {/* Related Resources */}
      <section className="space-y-4">
        <h2 className="font-display text-xl font-semibold text-foreground">
          Related Resources
        </h2>
        <div className="grid gap-3 sm:grid-cols-2">
          {[
            {
              href: "/pricing",
              label: "Zinovia Pricing",
              desc: "Transparent pricing with no monthly fees and no hidden costs.",
            },
            {
              href: "/fast-payouts",
              label: "48-Hour Payouts",
              desc: "Learn how Zinovia gets your earnings to your bank in 48 hours.",
            },
            {
              href: "/guides/creator-platform-fees-compared",
              label: "Fee Comparison Guide",
              desc: "Detailed fee breakdown across all major creator platforms.",
            },
            {
              href: "/alternatives/creator-platforms",
              label: "Best Creator Platforms",
              desc: "Compare the top creator platforms side by side.",
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
          Ready to keep more of what you earn?
        </h2>
        <p className="mx-auto mt-3 max-w-lg text-sm text-muted-foreground">
          Join Zinovia and keep 85% of your earnings with 48-hour payouts. No
          monthly fees, no hidden costs, no waiting weeks for your money.
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
            <Link href="/pricing">View pricing</Link>
          </Button>
        </div>
      </section>
    </Page>
  );
}
