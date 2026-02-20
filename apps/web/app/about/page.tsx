import Link from "next/link";
import { Page } from "@/components/brand/Page";
import { Button } from "@/components/ui/button";

const SITE_URL = "https://zinovia.ai";

export const metadata = {
  title: "About Zinovia — Our Mission for Creators",
  description: "Zinovia is a premium creator subscription platform built to help creators earn from their audience. Fast payouts, secure content, global reach.",
  alternates: { canonical: `${SITE_URL}/about` },
  openGraph: {
    title: "About Zinovia — Our Mission for Creators",
    description: "Zinovia is a premium creator subscription platform built to help creators earn from their audience.",
    url: `${SITE_URL}/about`,
    siteName: "Zinovia Fans",
  },
};

const VALUES = [
  { title: "Creator First", description: "Every decision we make starts with the question: does this help creators earn more, faster, and more securely?" },
  { title: "Transparency", description: "No hidden fees, no surprise policy changes, no opaque algorithms. You always know exactly what you're getting." },
  { title: "Security", description: "Your content is your livelihood. We protect it with signed URLs, AES encryption, and infrastructure built for privacy." },
  { title: "Global Reach", description: "Creators and fans everywhere. 9 languages, secure global payments, and a platform designed for international audiences." },
];

const MILESTONES = [
  { year: "2025", event: "Platform development begins" },
  { year: "2026", event: "Public launch with subscriptions, paid content, messaging, and tips" },
  { year: "2026", event: "Expanded to 9 languages across Europe and globally" },
  { year: "2026", event: "Creator verification and KYC system launched" },
];

export default function AboutPage() {
  return (
    <Page className="max-w-4xl space-y-12 py-12">
      <header className="text-center space-y-4">
        <h1 className="font-display text-premium-h2 font-bold text-foreground">
          Built for creators.{" "}
          <span className="text-gradient-brand">By creators.</span>
        </h1>
        <p className="mx-auto max-w-xl text-muted-foreground">
          Zinovia exists because creators deserve better — faster payouts, stronger content protection, and a platform that puts them first.
        </p>
      </header>

      {/* Mission */}
      <section className="rounded-2xl border border-white/[0.06] bg-card p-8">
        <h2 className="font-display text-xl font-semibold text-foreground">Our Mission</h2>
        <p className="mt-4 text-sm leading-relaxed text-foreground/90">
          The creator economy is growing fast, but most platforms haven&apos;t kept up. Slow payouts, high fees, weak content protection, and English-only interfaces leave millions of creators underserved.
        </p>
        <p className="mt-4 text-sm leading-relaxed text-foreground/90">
          Zinovia was built to change that. We believe every creator — regardless of language, location, or niche — deserves a platform that pays them quickly, protects their content, and gives them the tools to build a sustainable business.
        </p>
        <p className="mt-4 text-sm leading-relaxed text-foreground/90">
          We&apos;re not trying to be the biggest platform. We&apos;re trying to be the best one for creators who take their craft seriously.
        </p>
      </section>

      {/* Values */}
      <section className="space-y-6">
        <h2 className="font-display text-xl font-semibold text-foreground text-center">What We Stand For</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          {VALUES.map((value) => (
            <div key={value.title} className="rounded-2xl border border-white/[0.06] bg-card p-6">
              <h3 className="text-sm font-semibold text-foreground">{value.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{value.description}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Key Numbers */}
      <section className="grid gap-4 sm:grid-cols-4">
        {[
          { value: "9", label: "Languages" },
          { value: "48hr", label: "Payout Speed" },
          { value: "AES-256", label: "Encryption" },
          { value: "40+", label: "Payout Countries" },
        ].map(({ value, label }) => (
          <div key={label} className="rounded-2xl border border-white/[0.06] bg-card p-6 text-center">
            <p className="font-display text-2xl font-bold text-gradient-brand">{value}</p>
            <p className="mt-1 text-sm text-muted-foreground">{label}</p>
          </div>
        ))}
      </section>

      {/* Timeline */}
      <section className="space-y-6">
        <h2 className="font-display text-xl font-semibold text-foreground text-center">Our Journey</h2>
        <div className="space-y-4">
          {MILESTONES.map((milestone, i) => (
            <div key={i} className="flex gap-4 rounded-2xl border border-white/[0.06] bg-card p-4">
              <span className="shrink-0 font-display text-sm font-bold text-primary">{milestone.year}</span>
              <p className="text-sm text-foreground/90">{milestone.event}</p>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="rounded-2xl border border-white/[0.06] bg-card p-8 text-center">
        <h2 className="font-display text-xl font-bold text-foreground">Join us</h2>
        <p className="mx-auto mt-3 max-w-lg text-sm text-muted-foreground">
          Whether you&apos;re a creator looking to earn or a fan looking for exclusive content — Zinovia is built for you.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-4">
          <Button size="lg" className="btn-cta-primary h-12 px-8 text-base" asChild>
            <Link href="/signup">Get started</Link>
          </Button>
          <Button size="lg" variant="secondary" className="h-12 px-8 text-base" asChild>
            <Link href="/contact">Contact us</Link>
          </Button>
        </div>
      </section>
    </Page>
  );
}
