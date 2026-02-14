import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { LandingHero } from "@/components/landing/LandingHero";
import { AsSeenIn } from "@/components/landing/AsSeenIn";
import { FeaturedCreators } from "@/components/landing/FeaturedCreators";
import { SubscribeInviteVideo } from "@/components/landing/SubscribeInviteVideo";
import { StatsStrip } from "@/components/landing/StatsStrip";
import { Testimonials } from "@/components/landing/Testimonials";
import { SafetyPrivacy } from "@/components/landing/SafetyPrivacy";
import { ScrollReveal } from "@/components/landing/ScrollReveal";

function TrustIcon() {
  return (
    <svg className="h-4 w-4 shrink-0 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
    </svg>
  );
}

function ProfileIcon() {
  return (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5} aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
    </svg>
  );
}

function ContentIcon() {
  return (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5} aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909M3.75 21h16.5A2.25 2.25 0 0022.5 18.75V5.25A2.25 2.25 0 0020.25 3H3.75A2.25 2.25 0 001.5 5.25v13.5A2.25 2.25 0 003.75 21z" />
    </svg>
  );
}

function PayoutIcon() {
  return (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5} aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18.75a60.07 60.07 0 0115.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 013 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-.375m1.5-1.5H21a.75.75 0 00-.75.75v.75m0 0H3.75m0 0h-.375a1.125 1.125 0 01-1.125-1.125V15m1.5 1.5v-.75A.75.75 0 003 15h-.75M15 10.5a3 3 0 11-6 0 3 3 0 016 0zm3 0h.008v.008H18V10.5zm-12 0h.008v.008H6V10.5z" />
    </svg>
  );
}

const HOW_IT_WORKS = [
  ["Create your profile", "Set your identity, upload your media, and configure pricing.", ProfileIcon],
  ["Publish premium content", "Share posts, media, and paid unlock experiences in minutes.", ContentIcon],
  ["Get paid securely", "Receive recurring subscription revenue and one-time purchases.", PayoutIcon],
] as const;

export default function HomePage() {
  return (
    <main className="hero-bg">
      <LandingHero />

      <AsSeenIn />

      {/* Trust strip */}
      <section id="trust" className="mx-auto w-full max-w-6xl section-pad px-4 sm:px-6" aria-label="Trust indicators">
        <div className="grid gap-3 rounded-2xl border border-white/10 bg-card/80 p-5 text-sm text-muted-foreground backdrop-blur-sm sm:grid-cols-3 sm:text-center">
          <p className="flex items-center gap-2 sm:justify-center">
            <TrustIcon />
            Stripe-powered checkout
          </p>
          <p className="flex items-center gap-2 sm:justify-center">
            <TrustIcon />
            Verified creator identity
          </p>
          <p className="flex items-center gap-2 sm:justify-center">
            <TrustIcon />
            Secure private media delivery
          </p>
        </div>
      </section>

      <FeaturedCreators />

      <SubscribeInviteVideo />

      <StatsStrip />

      {/* How it works */}
      <ScrollReveal>
        <section id="how-it-works" className="mx-auto w-full max-w-6xl section-pad px-4 sm:px-6" aria-labelledby="how-heading">
          <h2 id="how-heading" className="font-display text-premium-h2 font-semibold text-foreground">
            How it works
          </h2>
          <div className="mt-8 grid gap-4 md:grid-cols-3">
            {HOW_IT_WORKS.map(([title, copy, Icon]) => (
              <Card key={title} className="card-hover-lift space-y-3 rounded-2xl border border-white/10 p-6 shadow-premium-sm">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-plum/10 text-brand-plum">
                  <Icon />
                </div>
                <h3 className="text-base font-semibold text-foreground">{title}</h3>
                <p className="text-sm leading-relaxed text-muted-foreground prose-width">{copy}</p>
              </Card>
            ))}
          </div>
        </section>
      </ScrollReveal>

      {/* Pricing */}
      <ScrollReveal>
        <section id="pricing" className="mx-auto w-full max-w-6xl section-pad px-4 sm:px-6" aria-labelledby="pricing-heading">
          <h2 id="pricing-heading" className="font-display text-premium-h2 font-semibold text-foreground">
            Simple pricing
          </h2>
          <div className="mt-8 grid gap-4 md:grid-cols-2">
            <Card className="card-hover-lift space-y-3 rounded-2xl border border-white/10 p-6 shadow-premium-sm">
              <Badge variant="primary" className="w-fit">Starter</Badge>
              <p className="text-3xl font-semibold text-foreground">€0</p>
              <p className="text-sm leading-relaxed text-muted-foreground prose-width">
                Publish your profile and start building your audience — no upfront cost.
              </p>
            </Card>
            <Card className="card-hover-lift space-y-3 rounded-2xl border border-brand-plum/20 p-6 shadow-premium-md">
              <Badge variant="accent" className="w-fit">Growth</Badge>
              <p className="text-3xl font-semibold text-foreground">Platform fee on earnings</p>
              <p className="text-sm leading-relaxed text-muted-foreground prose-width">
                Subscriptions, paid unlocks, and private messaging tools — all included.
              </p>
            </Card>
          </div>
        </section>
      </ScrollReveal>

      <ScrollReveal>
        <Testimonials />
      </ScrollReveal>

      <ScrollReveal>
        <SafetyPrivacy />
      </ScrollReveal>

      {/* Final CTA */}
      <section id="cta" className="mx-auto w-full max-w-6xl section-pad px-4 pb-20 text-center sm:px-6" aria-labelledby="cta-heading">
        <h2 id="cta-heading" className="font-display text-premium-h2 font-semibold text-foreground">
          Ready to start?
        </h2>
        <p className="mx-auto mt-3 max-w-[55ch] text-premium-body text-muted-foreground">
          Join Zinovia.ai today — whether you&apos;re a creator launching your brand or a fan looking for exclusive content.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <Button size="lg" className="btn-cta-primary" asChild>
            <Link href="/signup">Create your account</Link>
          </Button>
          <Button size="lg" variant="secondary" asChild>
            <Link href="/creators">Explore creators</Link>
          </Button>
        </div>
      </section>
    </main>
  );
}
