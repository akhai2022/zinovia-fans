import Link from "next/link";
import { Page } from "@/components/brand/Page";
import { Button } from "@/components/ui/button";

const SITE_URL = "https://zinovia.ai";

export const metadata = {
  title: "Zinovia Pricing & Fees — Keep More of Your Earnings",
  description: "Transparent creator platform pricing. No monthly fees, no upfront costs. Pay only when you earn. See how Zinovia's fees compare to Patreon and OnlyFans.",
  alternates: { canonical: `${SITE_URL}/pricing` },
  openGraph: {
    title: "Zinovia Pricing & Fees — Keep More of Your Earnings",
    description: "Transparent creator platform pricing. No monthly fees, no upfront costs. Pay only when you earn.",
    url: `${SITE_URL}/pricing`,
    siteName: "Zinovia Fans",
  },
};

const COMPARISON = [
  { platform: "Zinovia", fee: "Competitive", payout: "48 hours", monthlyFee: "Free", highlight: true },
  { platform: "Patreon", fee: "5–12%", payout: "30+ days", monthlyFee: "Free", highlight: false },
  { platform: "OnlyFans", fee: "20%", payout: "21 days", monthlyFee: "Free", highlight: false },
  { platform: "Fanvue", fee: "15%", payout: "7–14 days", monthlyFee: "Free", highlight: false },
  { platform: "Fansly", fee: "20%", payout: "7–14 days", monthlyFee: "Free", highlight: false },
];

const PRICING_FAQS = [
  { q: "Is Zinovia free to join?", a: "Yes. Creating a creator account is completely free. There are no monthly fees, setup costs, or minimum commitments. You only pay a platform fee when you earn." },
  { q: "What fees does Zinovia charge?", a: "Zinovia charges a competitive platform fee on your earnings. A standard payment processing fee is charged separately by our payment processor." },
  { q: "Are there any hidden fees?", a: "No. What you see is what you get. Platform fee plus payment processing — nothing else. No payout fees, no storage fees, no bandwidth fees." },
  { q: "How fast are payouts?", a: "Payouts are processed within 48 hours via secure bank transfer. Your earnings go directly to your bank account." },
  { q: "How does pricing compare to Patreon?", a: "Patreon charges 5-12% depending on your plan, plus payment processing. Patreon payouts take 30+ days. Zinovia offers competitive fees with 48-hour payouts." },
];

export default function PricingPage() {
  const faqJsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: PRICING_FAQS.map(({ q, a }) => ({
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

      <header className="text-center space-y-4">
        <h1 className="font-display text-premium-h2 font-bold text-foreground">
          Simple pricing.{" "}
          <span className="text-gradient-brand">Keep more.</span>
        </h1>
        <p className="mx-auto max-w-xl text-muted-foreground">
          No monthly fees. No upfront costs. You only pay when you earn. Transparent pricing that lets creators keep more of what they make.
        </p>
      </header>

      {/* Pricing Cards */}
      <section className="space-y-6">
        <div className="grid gap-6 md:grid-cols-2">
          <div className="rounded-2xl border border-white/[0.06] bg-card p-8">
            <h2 className="text-sm font-medium text-muted-foreground">For Fans</h2>
            <p className="mt-4 font-display text-4xl font-bold text-foreground">Free</p>
            <p className="mt-2 text-sm text-muted-foreground">Browse, follow, and subscribe to creators</p>
            <ul className="mt-6 space-y-3 text-sm text-foreground/90">
              <li className="flex items-start gap-2"><span className="text-primary">&#10003;</span> Browse all creator profiles</li>
              <li className="flex items-start gap-2"><span className="text-primary">&#10003;</span> Follow creators</li>
              <li className="flex items-start gap-2"><span className="text-primary">&#10003;</span> Subscribe to exclusive content</li>
              <li className="flex items-start gap-2"><span className="text-primary">&#10003;</span> Send tips and messages</li>
              <li className="flex items-start gap-2"><span className="text-primary">&#10003;</span> Purchase paid unlocks</li>
            </ul>
            <Button className="mt-8 w-full" variant="secondary" asChild>
              <Link href="/signup">Sign up free</Link>
            </Button>
          </div>

          <div className="relative rounded-2xl border-2 border-primary/50 bg-card p-8">
            <div className="absolute -top-3 left-1/2 -translate-x-1/2">
              <span className="rounded-full bg-primary px-3 py-1 text-xs font-medium text-primary-foreground">Creator</span>
            </div>
            <h2 className="text-sm font-medium text-muted-foreground">For Creators</h2>
            <p className="mt-4 font-display text-4xl font-bold text-foreground">Free to start</p>
            <p className="mt-2 text-sm text-muted-foreground">Pay only when you earn — competitive platform fee</p>
            <ul className="mt-6 space-y-3 text-sm text-foreground/90">
              <li className="flex items-start gap-2"><span className="text-primary">&#10003;</span> Unlimited content uploads</li>
              <li className="flex items-start gap-2"><span className="text-primary">&#10003;</span> Monthly subscriptions</li>
              <li className="flex items-start gap-2"><span className="text-primary">&#10003;</span> Paid unlocks &amp; tips</li>
              <li className="flex items-start gap-2"><span className="text-primary">&#10003;</span> Private messaging</li>
              <li className="flex items-start gap-2"><span className="text-primary">&#10003;</span> Analytics dashboard</li>
              <li className="flex items-start gap-2"><span className="text-primary">&#10003;</span> 48-hour payouts via bank transfer</li>
              <li className="flex items-start gap-2"><span className="text-primary">&#10003;</span> Content encryption &amp; signed URLs</li>
              <li className="flex items-start gap-2"><span className="text-primary">&#10003;</span> 9-language platform support</li>
            </ul>
            <Button className="btn-cta-primary mt-8 w-full" asChild>
              <Link href="/signup">Become a creator</Link>
            </Button>
          </div>
        </div>
      </section>

      {/* Platform Comparison Table */}
      <section className="space-y-4">
        <h2 className="font-display text-xl font-semibold text-foreground text-center">How we compare</h2>
        <div className="overflow-x-auto rounded-2xl border border-white/[0.06]">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/[0.06] bg-card">
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Platform</th>
                <th className="px-4 py-3 text-center font-medium text-muted-foreground">Platform Fee</th>
                <th className="px-4 py-3 text-center font-medium text-muted-foreground">Payout Speed</th>
                <th className="px-4 py-3 text-center font-medium text-muted-foreground">Monthly Fee</th>
              </tr>
            </thead>
            <tbody>
              {COMPARISON.map((row, i) => (
                <tr
                  key={row.platform}
                  className={`${i % 2 === 0 ? "bg-background" : "bg-card"} ${row.highlight ? "font-medium text-foreground" : "text-muted-foreground"}`}
                >
                  <td className="px-4 py-3">{row.platform}{row.highlight && <span className="ml-2 text-xs text-primary">(You are here)</span>}</td>
                  <td className="px-4 py-3 text-center">{row.fee}</td>
                  <td className="px-4 py-3 text-center">{row.payout}</td>
                  <td className="px-4 py-3 text-center">{row.monthlyFee}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* FAQ */}
      <section className="space-y-4">
        <h2 className="font-display text-xl font-semibold text-foreground">Frequently Asked Questions</h2>
        <div className="divide-y divide-white/[0.06]">
          {PRICING_FAQS.map(({ q, a }) => (
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
        <h2 className="font-display text-xl font-bold text-foreground">Start earning today</h2>
        <p className="mx-auto mt-3 max-w-lg text-sm text-muted-foreground">
          Join thousands of creators building sustainable income on Zinovia. No upfront costs, no monthly fees.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-4">
          <Button size="lg" className="btn-cta-primary h-12 px-8 text-base" asChild>
            <Link href="/signup">Get started free</Link>
          </Button>
          <Button size="lg" variant="secondary" className="h-12 px-8 text-base" asChild>
            <Link href="/compare">Compare platforms</Link>
          </Button>
        </div>
      </section>
    </Page>
  );
}
