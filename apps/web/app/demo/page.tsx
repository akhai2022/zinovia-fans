import Link from "next/link";
import type { Metadata } from "next";
import { cookies } from "next/headers";
import { Button } from "@/components/ui/button";
import { ScrollReveal } from "@/components/landing/ScrollReveal";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { DEFAULT_LOCALE, LOCALE_COOKIE, SUPPORTED_LOCALES, type Locale } from "@/lib/i18n/config";

const SITE_URL = "https://zinovia.ai";

export const metadata: Metadata = {
  title: "Platform Demo — Zinovia",
  description:
    "Explore how Zinovia works for creators and fans. Step-by-step walkthroughs of every feature.",
  alternates: { canonical: `${SITE_URL}/demo` },
  openGraph: {
    title: "Platform Demo — Zinovia",
    description: "Explore how Zinovia works for creators and fans.",
    url: `${SITE_URL}/demo`,
    siteName: "Zinovia Fans",
  },
};

const PERSONAS = [
  {
    key: "creator" as const,
    href: "/demo/creator",
    icon: "M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z",
    gradient: "from-primary/10 to-accent/10",
    border: "border-primary/20",
  },
  {
    key: "fan" as const,
    href: "/demo/fan",
    icon: "M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z",
    gradient: "from-emerald-500/10 to-cyan-500/10",
    border: "border-emerald-500/20",
  },
];

export default async function DemoIndexPage() {
  const localeCookie = cookies().get(LOCALE_COOKIE)?.value ?? DEFAULT_LOCALE;
  const locale: Locale = (SUPPORTED_LOCALES as readonly string[]).includes(localeCookie)
    ? (localeCookie as Locale)
    : DEFAULT_LOCALE;
  const t = await getDictionary(locale);
  const d = t.demo;

  return (
    <main className="hero-bg">
      {/* Hero */}
      <ScrollReveal>
        <section className="mx-auto w-full max-w-5xl px-4 pb-12 pt-16 sm:px-6 sm:pt-24">
          <div className="text-center">
            <div className="mx-auto mb-6 inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/5 px-4 py-1.5">
              <svg className="h-4 w-4 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5.25 5.653c0-.856.917-1.398 1.667-.986l11.54 6.348a1.125 1.125 0 010 1.971l-11.54 6.347a1.125 1.125 0 01-1.667-.985V5.653z" />
              </svg>
              <span className="text-xs font-medium text-primary">{d.navLabel}</span>
            </div>
            <h1 className="font-display text-4xl font-bold tracking-tight text-foreground sm:text-5xl">
              {d.indexTitle}
            </h1>
            <p className="mx-auto mt-4 max-w-2xl text-lg text-muted-foreground">
              {d.indexSubtitle}
            </p>
          </div>
        </section>
      </ScrollReveal>

      {/* Persona Cards */}
      <ScrollReveal>
        <section className="mx-auto w-full max-w-5xl px-4 pb-16 sm:px-6">
          <div className="grid gap-6 sm:grid-cols-2">
            {PERSONAS.map(({ key, href, icon, gradient, border }) => {
              const title = key === "creator" ? d.creatorCardTitle : d.fanCardTitle;
              const desc = key === "creator" ? d.creatorCardDescription : d.fanCardDescription;
              const cta = key === "creator" ? d.creatorCardCta : d.fanCardCta;

              return (
                <Link
                  key={key}
                  href={href}
                  className={`group flex flex-col gap-6 rounded-2xl border ${border} bg-gradient-to-br ${gradient} p-8 transition-all hover:scale-[1.02] hover:shadow-xl`}
                >
                  <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white/10">
                    <svg className="h-7 w-7 text-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d={icon} />
                    </svg>
                  </div>
                  <div className="space-y-2">
                    <h2 className="font-display text-2xl font-bold text-foreground">{title}</h2>
                    <p className="text-sm leading-relaxed text-muted-foreground">{desc}</p>
                  </div>
                  <div className="mt-auto">
                    <span className="inline-flex items-center gap-2 text-sm font-semibold text-primary group-hover:gap-3 transition-all">
                      {cta}
                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
                      </svg>
                    </span>
                  </div>
                </Link>
              );
            })}
          </div>
        </section>
      </ScrollReveal>

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
                <Link href="/creators">{d.ctaExplore}</Link>
              </Button>
            </div>
          </div>
        </section>
      </ScrollReveal>
    </main>
  );
}
