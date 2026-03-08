import Link from "next/link";
import { Page } from "@/components/brand/Page";
import { Button } from "@/components/ui/button";
import { Breadcrumbs } from "@/components/seo/Breadcrumbs";

const SITE_URL = "https://zinovia.ai";

export const metadata = {
  title: "Zinovia Fast Payouts — Get Paid in 48 Hours | Creator Platform",
  description: "Get fast creator payouts in just 48 hours. No payout fees, secure bank transfers in EUR, USD, and GBP. Compare Zinovia's 48 hour payouts to OnlyFans, Patreon, and other creator platforms.",
  alternates: { canonical: `${SITE_URL}/fast-payouts` },
  openGraph: {
    title: "Zinovia Fast Payouts — Get Paid in 48 Hours | Creator Platform",
    description: "Get fast creator payouts in just 48 hours. No payout fees, secure bank transfers in EUR, USD, and GBP.",
    url: `${SITE_URL}/fast-payouts`,
    siteName: "Zinovia Fans",
  },
};

const PAYOUT_COMPARISON = [
  { platform: "Zinovia", speed: "48 hours", highlight: true },
  { platform: "OnlyFans", speed: "21 days", highlight: false },
  { platform: "Patreon", speed: "30+ days", highlight: false },
  { platform: "Fansly", speed: "7\u201314 days", highlight: false },
  { platform: "FanVue", speed: "7\u201314 days", highlight: false },
  { platform: "Ko-fi", speed: "Instant (PayPal)", highlight: false },
  { platform: "Passes", speed: "Weekly", highlight: false },
  { platform: "LoyalFans", speed: "Weekly", highlight: false },
  { platform: "MYM", speed: "Monthly", highlight: false },
];

const STEPS = [
  {
    step: "01",
    title: "Earn",
    description: "Generate revenue from subscriptions, paid unlocks, tips, and private messaging. All your earnings are tracked in real time on your creator dashboard.",
  },
  {
    step: "02",
    title: "Request",
    description: "Request a payout whenever you are ready. There is no minimum payout threshold and no waiting for a specific payout cycle. You are in control.",
  },
  {
    step: "03",
    title: "Receive in 48 hours",
    description: "Your payout is processed and sent directly to your bank account within 48 hours via secure bank transfer. No intermediaries, no delays.",
  },
];

const TRUST_SIGNALS = [
  {
    title: "Secure bank transfer",
    description: "Payouts are sent directly to your bank account via secure, encrypted bank transfers. No third-party wallets or intermediaries.",
    icon: "M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z",
  },
  {
    title: "No payout fees",
    description: "Keep more of what you earn. Zinovia does not charge any fees on payouts. Your earnings go directly to your bank account, in full.",
    icon: "M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z",
  },
  {
    title: "EUR, USD, and GBP support",
    description: "Receive payouts in your preferred currency. We support EUR, USD, and GBP with no currency conversion fees on your end.",
    icon: "M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z",
  },
];

const PAYOUT_FAQS = [
  {
    q: "How fast are Zinovia payouts?",
    a: "Zinovia processes all payout requests within 48 hours. Once you request a payout, the funds are sent directly to your bank account via secure bank transfer. This is significantly faster than most creator platforms, which typically take 7 to 30+ days.",
  },
  {
    q: "What payout methods does Zinovia support?",
    a: "Zinovia pays creators via secure bank transfer (SEPA for EUR, SWIFT for USD and GBP). Funds are sent directly to your bank account. We do not use third-party wallets or intermediaries, which means faster processing and fewer complications.",
  },
  {
    q: "Are there any payout fees?",
    a: "No. Zinovia does not charge any fees on payouts. The full amount of your requested payout is sent to your bank account. The only fees you pay are the platform fee and payment processing fee when you earn, never when you withdraw.",
  },
  {
    q: "Is there a minimum payout amount?",
    a: "No. There is no minimum payout threshold on Zinovia. You can request a payout for any amount at any time. You are always in control of your earnings.",
  },
  {
    q: "What currencies are supported for payouts?",
    a: "Zinovia supports payouts in EUR, USD, and GBP. You can choose your preferred currency when you set up your payout details. There are no currency conversion fees charged by Zinovia on your payouts.",
  },
  {
    q: "How does Zinovia's payout speed compare to other platforms?",
    a: "Zinovia offers 48-hour payouts, which is among the fastest in the creator economy. For comparison, OnlyFans takes 21 days, Patreon takes 30+ days, and Fansly and FanVue take 7 to 14 days. Only PayPal-based platforms like Ko-fi offer faster access, but with different trade-offs in fees and features.",
  },
];

export default function FastPayoutsPage() {
  const faqJsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: PAYOUT_FAQS.map(({ q, a }) => ({
      "@type": "Question",
      name: q,
      acceptedAnswer: { "@type": "Answer", text: a },
    })),
  };

  return (
    <Page className="max-w-4xl space-y-12 py-12">
      <Breadcrumbs items={[{ label: "Fast Payouts" }]} />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }}
      />

      {/* Hero */}
      <header className="text-center space-y-4">
        <h1 className="font-display text-premium-h2 font-bold text-foreground">
          Get paid in{" "}
          <span className="text-gradient-brand">48 hours</span>
        </h1>
        <p className="mx-auto max-w-xl text-muted-foreground">
          Most creator platforms make you wait weeks for your money. Zinovia pays you in 48 hours, directly to your bank account, with no payout fees.
        </p>
        <div className="mx-auto flex max-w-md items-center justify-center gap-4 pt-4">
          <div className="flex-1 rounded-xl border-2 border-primary/50 bg-card p-4 text-center">
            <p className="text-xs font-medium text-primary">Zinovia</p>
            <p className="mt-1 font-display text-2xl font-bold text-foreground">48h</p>
          </div>
          <div className="text-muted-foreground text-sm font-medium">vs</div>
          <div className="flex-1 rounded-xl border border-white/[0.06] bg-card p-4 text-center">
            <p className="text-xs font-medium text-muted-foreground">Others</p>
            <p className="mt-1 font-display text-2xl font-bold text-muted-foreground">7&ndash;30+ days</p>
          </div>
        </div>
      </header>

      {/* Payout Speed Comparison Table */}
      <section className="space-y-4">
        <h2 className="font-display text-xl font-semibold text-foreground text-center">Payout speed comparison</h2>
        <p className="text-center text-sm text-muted-foreground">See how Zinovia stacks up against every major creator platform.</p>
        <div className="overflow-x-auto rounded-2xl border border-white/[0.06]">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/[0.06] bg-card">
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Platform</th>
                <th className="px-4 py-3 text-center font-medium text-muted-foreground">Payout Speed</th>
              </tr>
            </thead>
            <tbody>
              {PAYOUT_COMPARISON.map((row, i) => (
                <tr
                  key={row.platform}
                  className={`${i % 2 === 0 ? "bg-background" : "bg-card"} ${row.highlight ? "font-medium text-foreground" : "text-muted-foreground"}`}
                >
                  <td className="px-4 py-3">
                    {row.platform}
                    {row.highlight && <span className="ml-2 text-xs text-primary">(You are here)</span>}
                  </td>
                  <td className="px-4 py-3 text-center">
                    {row.highlight ? (
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
                        {row.speed}
                      </span>
                    ) : (
                      row.speed
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* How It Works */}
      <section className="space-y-6">
        <div className="text-center">
          <h2 className="font-display text-xl font-semibold text-foreground">How fast payouts work</h2>
          <p className="mt-2 text-muted-foreground">Three steps from earning to your bank account.</p>
        </div>
        {STEPS.map(({ step, title, description }) => (
          <div key={step} className="rounded-2xl border border-white/[0.06] bg-card p-8">
            <div className="flex items-start gap-6">
              <span className="shrink-0 text-gradient-brand text-5xl font-bold">{step}</span>
              <div className="space-y-2">
                <h3 className="font-display text-lg font-semibold text-foreground">{title}</h3>
                <p className="text-sm leading-relaxed text-muted-foreground">{description}</p>
              </div>
            </div>
          </div>
        ))}
      </section>

      {/* Trust Signals */}
      <section className="space-y-6">
        <div className="text-center">
          <h2 className="font-display text-xl font-semibold text-foreground">Built for trust</h2>
          <p className="mt-2 text-muted-foreground">Your earnings are safe, secure, and always accessible.</p>
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          {TRUST_SIGNALS.map((signal) => (
            <div key={signal.title} className="rounded-2xl border border-white/[0.06] bg-card p-6 text-center">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5} aria-hidden>
                  <path strokeLinecap="round" strokeLinejoin="round" d={signal.icon} />
                </svg>
              </div>
              <h3 className="mt-4 text-sm font-semibold text-foreground">{signal.title}</h3>
              <p className="mt-2 text-sm text-muted-foreground">{signal.description}</p>
            </div>
          ))}
        </div>
      </section>

      {/* FAQ */}
      <section className="space-y-4">
        <h2 className="font-display text-xl font-semibold text-foreground">Frequently Asked Questions</h2>
        <div className="divide-y divide-white/[0.06]">
          {PAYOUT_FAQS.map(({ q, a }) => (
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

      {/* Related Resources */}
      <section className="space-y-4">
        <h2 className="font-display text-xl font-semibold text-foreground">Related Resources</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          {[
            { href: "/features/payouts", label: "Payout Features", desc: "Full breakdown of Zinovia's payout system and supported currencies." },
            { href: "/guides/creator-platform-fees-compared", label: "Guide: Creator Platform Fees Compared", desc: "Side-by-side fee comparison across all major creator platforms." },
            { href: "/pricing", label: "Zinovia Pricing", desc: "Transparent pricing with no monthly fees and no hidden costs." },
            { href: "/alternatives/patreon-alternatives", label: "Patreon Alternatives", desc: "Explore the best alternatives to Patreon for creators." },
            { href: "/compare/patreon", label: "Zinovia vs Patreon", desc: "Head-to-head comparison of fees, payouts, and creator tools." },
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
        <h2 className="font-display text-xl font-bold text-foreground">Start earning with 48-hour payouts</h2>
        <p className="mx-auto mt-3 max-w-lg text-sm text-muted-foreground">
          Join Zinovia and get paid faster than on any other creator platform. No payout fees, no minimum threshold, no waiting weeks for your money.
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
