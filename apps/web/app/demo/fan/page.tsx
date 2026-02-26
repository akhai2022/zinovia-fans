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
  title: "Fan Demo — Zinovia",
  description:
    "Step-by-step walkthrough for fans: discover creators, subscribe, browse your feed, unlock content, and manage your account.",
  alternates: { canonical: `${SITE_URL}/demo/fan` },
  openGraph: {
    title: "Fan Demo — Zinovia",
    description: "Learn how to use every fan feature on Zinovia.",
    url: `${SITE_URL}/demo/fan`,
    siteName: "Zinovia Fans",
  },
};

const STEP_ICONS = [
  // 1. Signup
  "M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z",
  // 2. Discover
  "M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z",
  // 3. Profiles
  "M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z",
  // 4. Feed
  "M6 5c7.18 0 13 5.82 13 13M6 11a7 7 0 017 7m-6 0a1 1 0 11-2 0 1 1 0 012 0z",
  // 5. PPV
  "M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z",
  // 6. Messages
  "M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z",
  // 7. Billing
  "M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z",
  // 8. Notifications
  "M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9",
  // 9. Language
  "M3 5h12M9 3v2m1.048 9.5A18.022 18.022 0 016.412 9m6.088 9h7M11 21l5-10 5 10M12.751 5C11.783 10.77 8.07 15.61 3 18.129",
];

type StepKey =
  | "fanSignup"
  | "fanDiscover"
  | "fanProfiles"
  | "fanFeed"
  | "fanPpv"
  | "fanMessages"
  | "fanBilling"
  | "fanNotifications"
  | "fanLanguage";

const STEP_KEYS: StepKey[] = [
  "fanSignup",
  "fanDiscover",
  "fanProfiles",
  "fanFeed",
  "fanPpv",
  "fanMessages",
  "fanBilling",
  "fanNotifications",
  "fanLanguage",
];

export default async function FanDemoPage() {
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
    screenshot: DEMO_STEPS.fan[i],
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
              {d.fanTitle}
            </h1>
            <p className="mx-auto mt-4 max-w-2xl text-lg text-muted-foreground">
              {d.fanSubtitle}
            </p>
          </div>
        </section>
      </ScrollReveal>

      {/* Video Walkthrough */}
      <ScrollReveal>
        <section className="mx-auto w-full max-w-4xl px-4 pb-12 sm:px-6">
          <div className="overflow-hidden rounded-2xl border border-emerald-500/20 bg-card shadow-xl">
            <DemoVideoPlayer
              src={DEMO_VIDEOS.fan.src}
              poster={DEMO_VIDEOS.fan.poster}
              accentColor="bg-emerald-500/90"
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
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-400">
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
                          <span className="mt-0.5 shrink-0 text-emerald-400">&#10003;</span>
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
          <div className="rounded-2xl border border-emerald-500/20 bg-gradient-to-br from-emerald-500/5 via-transparent to-cyan-500/5 px-6 py-12 text-center sm:px-12">
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
                <Link href="/demo/creator">{d.creatorCardCta}</Link>
              </Button>
            </div>
          </div>
        </section>
      </ScrollReveal>
    </main>
  );
}
