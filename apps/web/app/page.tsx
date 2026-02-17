import { cookies } from "next/headers";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { LandingHero } from "@/components/landing/LandingHero";
import { FeaturedCreators } from "@/components/landing/FeaturedCreators";
import { SubscribeInviteVideo } from "@/components/landing/SubscribeInviteVideo";
import { SafetyPrivacy } from "@/components/landing/SafetyPrivacy";
import { ScrollReveal } from "@/components/landing/ScrollReveal";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { DEFAULT_LOCALE, LOCALE_COOKIE, SUPPORTED_LOCALES, type Locale } from "@/lib/i18n/config";
import type { Dictionary } from "@/lib/i18n/types";

const FEATURE_ICONS = [
  "M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z",
  "M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z",
  "M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z",
  "M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z",
  "M13 10V3L4 14h7v7l9-11h-7z",
  "M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z",
];

function getFeatures(t: Dictionary["features"]) {
  return [
    { title: t.subscriptionsTitle, description: t.subscriptionsDesc },
    { title: t.paidUnlocksTitle, description: t.paidUnlocksDesc },
    { title: t.directMessagesTitle, description: t.directMessagesDesc },
    { title: t.tipsTitle, description: t.tipsDesc },
    { title: t.fastPayoutsTitle, description: t.fastPayoutsDesc },
    { title: t.analyticsTitle, description: t.analyticsDesc },
  ];
}

function getHowItWorks(t: Dictionary["howItWorks"]) {
  return [
    { step: "01", title: t.step1Title, description: t.step1Desc },
    { step: "02", title: t.step2Title, description: t.step2Desc },
    { step: "03", title: t.step3Title, description: t.step3Desc },
  ];
}

function getFaq(t: Dictionary["faq"]) {
  return [
    { q: t.q1, a: t.a1 },
    { q: t.q2, a: t.a2 },
    { q: t.q3, a: t.a3 },
    { q: t.q4, a: t.a4 },
    { q: t.q5, a: t.a5 },
  ];
}

export default async function HomePage() {
  const localeCookie = cookies().get(LOCALE_COOKIE)?.value ?? DEFAULT_LOCALE;
  const locale: Locale = (SUPPORTED_LOCALES as readonly string[]).includes(localeCookie)
    ? (localeCookie as Locale)
    : DEFAULT_LOCALE;
  const t = await getDictionary(locale);

  const FEATURES = getFeatures(t.features);
  const HOW_IT_WORKS = getHowItWorks(t.howItWorks);
  const FAQ = getFaq(t.faq);

  return (
    <main className="hero-bg">
      <LandingHero />

      <ScrollReveal>
        <FeaturedCreators />
      </ScrollReveal>

      {/* Features grid */}
      <ScrollReveal>
        <section className="mx-auto w-full max-w-6xl section-pad px-4 sm:px-6" aria-labelledby="features-heading">
          <div className="text-center">
            <h2 id="features-heading" className="font-display text-premium-h2 font-bold text-foreground">
              {t.features.heading}
            </h2>
            <p className="mx-auto mt-3 max-w-xl text-muted-foreground">
              {t.features.subheading}
            </p>
          </div>
          <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map(({ title, description }, i) => (
              <div
                key={title}
                className="card-hover-lift flex flex-col gap-4 rounded-2xl border border-white/[0.06] bg-[rgb(18,18,24)] p-6"
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-500/10 text-violet-400">
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5} aria-hidden>
                    <path strokeLinecap="round" strokeLinejoin="round" d={FEATURE_ICONS[i]} />
                  </svg>
                </div>
                <h3 className="text-sm font-semibold text-foreground">{title}</h3>
                <p className="text-sm leading-relaxed text-muted-foreground">{description}</p>
              </div>
            ))}
          </div>
        </section>
      </ScrollReveal>

      <ScrollReveal>
        <SubscribeInviteVideo />
      </ScrollReveal>

      {/* How it works */}
      <ScrollReveal>
        <section className="mx-auto w-full max-w-6xl section-pad px-4 sm:px-6" aria-labelledby="how-heading">
          <div className="text-center">
            <h2 id="how-heading" className="font-display text-premium-h2 font-bold text-foreground">
              {t.howItWorks.heading}
            </h2>
            <p className="mx-auto mt-3 max-w-xl text-muted-foreground">
              {t.howItWorks.subheading}
            </p>
          </div>
          <div className="mt-10 grid gap-6 md:grid-cols-3">
            {HOW_IT_WORKS.map(({ step, title, description }) => (
              <div key={step} className="relative rounded-2xl border border-white/[0.06] bg-[rgb(18,18,24)] p-6">
                <span className="text-gradient-brand text-4xl font-bold">{step}</span>
                <h3 className="mt-3 text-base font-semibold text-foreground">{title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{description}</p>
              </div>
            ))}
          </div>
        </section>
      </ScrollReveal>

      <ScrollReveal>
        <SafetyPrivacy t={t.safety} />
      </ScrollReveal>

      {/* FAQ */}
      <ScrollReveal>
        <section className="mx-auto w-full max-w-4xl section-pad px-4 sm:px-6" aria-labelledby="faq-heading">
          <div className="text-center">
            <h2 id="faq-heading" className="font-display text-premium-h2 font-bold text-foreground">
              {t.faq.heading}
            </h2>
          </div>
          <div className="mt-10 divide-y divide-white/[0.06]">
            {FAQ.map(({ q, a }) => (
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
                <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{a}</p>
              </details>
            ))}
          </div>
        </section>
      </ScrollReveal>

      {/* Final CTA */}
      <section className="mx-auto w-full max-w-6xl section-pad px-4 pb-24 text-center sm:px-6" aria-labelledby="cta-heading">
        <h2 id="cta-heading" className="font-display text-premium-h2 font-bold text-foreground">
          {t.cta.heading}
        </h2>
        <p className="mx-auto mt-4 max-w-xl text-muted-foreground">
          {t.cta.description}
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-4">
          <Button size="lg" className="btn-cta-primary h-12 px-8 text-base" asChild>
            <Link href="/signup">{t.cta.ctaStart}</Link>
          </Button>
          <Button size="lg" variant="secondary" className="h-12 px-8 text-base" asChild>
            <Link href="/creators">{t.cta.ctaExplore}</Link>
          </Button>
        </div>
      </section>
    </main>
  );
}
