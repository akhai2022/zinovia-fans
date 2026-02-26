import Link from "next/link";
import Image from "next/image";
import type { Metadata } from "next";
import { cookies } from "next/headers";
import { Button } from "@/components/ui/button";
import { ScrollReveal } from "@/components/landing/ScrollReveal";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { DEFAULT_LOCALE, LOCALE_COOKIE, SUPPORTED_LOCALES, type Locale } from "@/lib/i18n/config";
import { DEMO_VIDEOS, DEMO_STEPS } from "@/lib/demoAssets";
import { DemoVideoPlayer } from "../DemoVideoPlayer";

const SITE_URL = "https://zinovia.ai";

export const metadata: Metadata = {
  title: "Creator Demo — Zinovia",
  description:
    "Step-by-step walkthrough for creators: sign up, verify identity, publish content, track earnings, and use AI tools.",
  alternates: { canonical: `${SITE_URL}/demo/creator` },
  openGraph: {
    title: "Creator Demo — Zinovia",
    description: "Learn how to use every creator feature on Zinovia.",
    url: `${SITE_URL}/demo/creator`,
    siteName: "Zinovia Fans",
  },
};

const STEP_ICONS = [
  // 1. Signup
  "M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z",
  // 2. KYC
  "M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z",
  // 3. Profile
  "M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z",
  // 4. Pricing
  "M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z",
  // 5. Posts
  "M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z",
  // 6. Vault
  "M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z",
  // 7. Collections
  "M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10",
  // 8. Earnings
  "M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z",
  // 9. Messages
  "M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z",
  // 10. AI Studio
  "M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 00-2.455 2.456z",
  // 11. Language
  "M3 5h12M9 3v2m1.048 9.5A18.022 18.022 0 016.412 9m6.088 9h7M11 21l5-10 5 10M12.751 5C11.783 10.77 8.07 15.61 3 18.129",
];

type StepKey =
  | "creatorSignup"
  | "creatorKyc"
  | "creatorProfile"
  | "creatorPricing"
  | "creatorPosts"
  | "creatorVault"
  | "creatorCollections"
  | "creatorEarnings"
  | "creatorMessages"
  | "creatorAiStudio"
  | "creatorLanguage";

const STEP_KEYS: StepKey[] = [
  "creatorSignup",
  "creatorKyc",
  "creatorProfile",
  "creatorPricing",
  "creatorPosts",
  "creatorVault",
  "creatorCollections",
  "creatorEarnings",
  "creatorMessages",
  "creatorAiStudio",
  "creatorLanguage",
];

export default async function CreatorDemoPage() {
  const localeCookie = cookies().get(LOCALE_COOKIE)?.value ?? DEFAULT_LOCALE;
  const locale: Locale = (SUPPORTED_LOCALES as readonly string[]).includes(localeCookie)
    ? (localeCookie as Locale)
    : DEFAULT_LOCALE;
  const t = await getDictionary(locale);
  const d = t.demo;

  const steps = STEP_KEYS.map((key, i) => ({
    step: String(i + 1).padStart(2, "0"),
    title: d[`${key}Title` as keyof typeof d] as string,
    description: d[`${key}Desc` as keyof typeof d] as string,
    features: d[`${key}Features` as keyof typeof d] as string[],
    icon: STEP_ICONS[i],
    screenshot: DEMO_STEPS.creator[i],
  }));

  return (
    <main className="hero-bg">
      {/* Hero */}
      <ScrollReveal>
        <section className="mx-auto w-full max-w-5xl px-4 pb-8 pt-16 sm:px-6 sm:pt-24">
          <div className="text-center">
            <Link
              href="/demo"
              className="mx-auto mb-6 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-white/10"
            >
              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
              </svg>
              {d.backToDemo}
            </Link>
            <h1 className="font-display text-4xl font-bold tracking-tight text-foreground sm:text-5xl">
              {d.creatorTitle}
            </h1>
            <p className="mx-auto mt-4 max-w-2xl text-lg text-muted-foreground">
              {d.creatorSubtitle}
            </p>
          </div>
        </section>
      </ScrollReveal>

      {/* Video Walkthrough */}
      <ScrollReveal>
        <section className="mx-auto w-full max-w-4xl px-4 pb-12 sm:px-6">
          <div className="overflow-hidden rounded-2xl border border-primary/20 bg-card shadow-xl">
            <DemoVideoPlayer
              src={DEMO_VIDEOS.creator.src}
              poster={DEMO_VIDEOS.creator.poster}
              accentColor="bg-primary/90"
            />
          </div>
        </section>
      </ScrollReveal>

      {/* Step Cards */}
      <section className="mx-auto w-full max-w-5xl space-y-6 px-4 pb-16 sm:px-6">
        {steps.map(({ step, title, description, features, icon, screenshot }) => (
          <ScrollReveal key={step}>
            <div className="rounded-2xl border border-white/[0.06] bg-card p-6 sm:p-8">
              <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:gap-8">
                {/* Text content */}
                <div className="flex flex-1 items-start gap-4 sm:gap-6">
                  <div className="flex shrink-0 flex-col items-center gap-3">
                    <span className="text-gradient-brand text-4xl font-bold sm:text-5xl">{step}</span>
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5} aria-hidden>
                        <path strokeLinecap="round" strokeLinejoin="round" d={icon} />
                      </svg>
                    </div>
                  </div>
                  <div className="min-w-0 space-y-3">
                    <h2 className="font-display text-lg font-semibold text-foreground sm:text-xl">{title}</h2>
                    <p className="text-sm leading-relaxed text-muted-foreground">{description}</p>
                    <ul className="grid gap-2 sm:grid-cols-2">
                      {features.map((feature) => (
                        <li key={feature} className="flex items-start gap-2 text-sm text-foreground/90">
                          <span className="mt-0.5 shrink-0 text-primary">&#10003;</span>
                          <span>{feature}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
                {/* Screenshot */}
                <div className="shrink-0 lg:w-[40%]">
                  <div className="overflow-hidden rounded-xl border border-white/[0.08] shadow-lg transition-transform hover:scale-[1.02]">
                    <Image
                      src={screenshot}
                      alt={title}
                      width={800}
                      height={500}
                      className="h-auto w-full"
                      loading="lazy"
                    />
                  </div>
                </div>
              </div>
            </div>
          </ScrollReveal>
        ))}
      </section>

      {/* CTA */}
      <ScrollReveal>
        <section className="mx-auto w-full max-w-5xl px-4 pb-16 sm:px-6">
          <div className="rounded-2xl border border-primary/20 bg-gradient-to-br from-primary/5 via-transparent to-accent/5 px-6 py-12 text-center sm:px-12">
            <h2 className="font-display text-premium-h2 font-bold text-foreground">
              {d.ctaReady}
            </h2>
            <p className="mx-auto mt-4 max-w-lg text-muted-foreground">
              {d.ctaReadyDesc}
            </p>
            <div className="mt-8 flex flex-wrap justify-center gap-4">
              <Button size="lg" className="btn-cta-primary h-12 px-8 text-base" asChild>
                <Link href="/signup">{d.ctaSignup}</Link>
              </Button>
              <Button size="lg" variant="secondary" className="h-12 px-8 text-base" asChild>
                <Link href="/demo/fan">{d.fanCardCta}</Link>
              </Button>
            </div>
          </div>
        </section>
      </ScrollReveal>
    </main>
  );
}
