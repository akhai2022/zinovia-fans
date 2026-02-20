import Link from "next/link";
import { Page } from "@/components/brand/Page";
import { Button } from "@/components/ui/button";

const SITE_URL = "https://zinovia.ai";

export const metadata = {
  title: "How Zinovia Works — 3 Steps to Start Earning",
  description: "Get started on Zinovia in under 5 minutes. Create your profile, publish content, and earn from subscriptions, tips, and paid content. 48-hour payouts.",
  alternates: { canonical: `${SITE_URL}/how-it-works` },
  openGraph: {
    title: "How Zinovia Works — 3 Steps to Start Earning",
    description: "Get started on Zinovia in under 5 minutes. Create your profile, publish content, and start earning.",
    url: `${SITE_URL}/how-it-works`,
    siteName: "Zinovia Fans",
  },
};

const STEPS = [
  {
    step: "01",
    title: "Create your profile",
    description: "Sign up with your email, verify your identity through our quick KYC process, and customise your creator profile. Add your bio, avatar, banner, and set your subscription price.",
    details: [
      "Takes less than 5 minutes",
      "Quick identity verification",
      "Set your own subscription price",
      "Customisable profile page",
    ],
  },
  {
    step: "02",
    title: "Publish content",
    description: "Upload photos, videos, and text posts. Choose whether each post is free, subscriber-only, or a paid unlock. Your content is protected by signed URLs and encryption.",
    details: [
      "Photos, videos, and text posts",
      "Free, subscriber-only, or paid content",
      "Content encryption and signed URLs",
      "Blurred previews for locked content",
    ],
  },
  {
    step: "03",
    title: "Get paid",
    description: "Earn from monthly subscriptions, paid unlocks, tips, and direct messages. Payouts are processed within 48 hours via secure bank transfer, directly to your bank account.",
    details: [
      "4 revenue streams in one platform",
      "48-hour payouts via secure bank transfer",
      "No minimum payout threshold",
      "40+ countries supported",
    ],
  },
];

const REVENUE_STREAMS = [
  { title: "Subscriptions", description: "Fans pay a monthly fee for access to your exclusive content. Predictable, recurring revenue.", icon: "M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" },
  { title: "Paid Unlocks", description: "Sell individual posts, photos, or videos as one-time purchases. Perfect for premium content.", icon: "M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" },
  { title: "Tips", description: "Let fans show their appreciation with tips. A simple way for supporters to give back.", icon: "M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" },
  { title: "Messaging", description: "Offer private messaging access to subscribers. Connect directly with your most dedicated fans.", icon: "M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" },
];

const HOW_FAQS = [
  { q: "How long does it take to set up?", a: "Less than 5 minutes. Sign up, verify your identity, customise your profile, and set your price. You can start publishing content immediately after verification." },
  { q: "Do I need a large following to start?", a: "No. Even 100 subscribers can generate meaningful income. Many successful creators start small and grow their audience over time on the platform." },
  { q: "What kind of content can I post?", a: "Photos, videos, and text posts. You can make content free for all, subscriber-only, or available as individual paid unlocks. All content must comply with our Terms of Service." },
  { q: "How do fans find me?", a: "Fans can discover you through the creator directory, search, and your direct profile link. Share your Zinovia link on your social media to drive your existing audience to your page." },
  { q: "Can I use Zinovia alongside other platforms?", a: "Yes. Many creators maintain profiles on multiple platforms. You can cross-promote and direct fans to whichever platform works best for each audience segment." },
];

export default function HowItWorksPage() {
  const faqJsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: HOW_FAQS.map(({ q, a }) => ({
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
          Start earning in{" "}
          <span className="text-gradient-brand">3 simple steps</span>
        </h1>
        <p className="mx-auto max-w-xl text-muted-foreground">
          From signup to first payout in under 5 minutes. No technical skills required, no upfront costs.
        </p>
      </header>

      {/* Steps */}
      <section className="space-y-6">
        {STEPS.map(({ step, title, description, details }) => (
          <div key={step} className="rounded-2xl border border-white/[0.06] bg-card p-8">
            <div className="flex items-start gap-6">
              <span className="shrink-0 text-gradient-brand text-5xl font-bold">{step}</span>
              <div className="space-y-3">
                <h2 className="font-display text-lg font-semibold text-foreground">{title}</h2>
                <p className="text-sm leading-relaxed text-muted-foreground">{description}</p>
                <ul className="grid gap-2 sm:grid-cols-2">
                  {details.map((detail) => (
                    <li key={detail} className="flex items-start gap-2 text-sm text-foreground/90">
                      <span className="text-primary">&#10003;</span> {detail}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        ))}
      </section>

      {/* Revenue Streams */}
      <section className="space-y-6">
        <div className="text-center">
          <h2 className="font-display text-xl font-semibold text-foreground">4 ways to earn</h2>
          <p className="mt-2 text-muted-foreground">Multiple revenue streams, one platform.</p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          {REVENUE_STREAMS.map((stream) => (
            <div key={stream.title} className="flex gap-4 rounded-2xl border border-white/[0.06] bg-card p-6">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5} aria-hidden>
                  <path strokeLinecap="round" strokeLinejoin="round" d={stream.icon} />
                </svg>
              </div>
              <div>
                <h3 className="text-sm font-semibold text-foreground">{stream.title}</h3>
                <p className="mt-1 text-sm text-muted-foreground">{stream.description}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* FAQ */}
      <section className="space-y-4">
        <h2 className="font-display text-xl font-semibold text-foreground">Frequently Asked Questions</h2>
        <div className="divide-y divide-white/[0.06]">
          {HOW_FAQS.map(({ q, a }) => (
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
        <h2 className="font-display text-xl font-bold text-foreground">Ready to start?</h2>
        <p className="mx-auto mt-3 max-w-lg text-sm text-muted-foreground">
          Create your creator account in under 5 minutes. No upfront costs, no monthly fees.
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
