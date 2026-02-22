import { cookies } from "next/headers";
import Link from "next/link";
import type { Metadata } from "next";
import { Button } from "@/components/ui/button";
import { ScrollReveal } from "@/components/landing/ScrollReveal";
import { AIForCreators } from "@/components/landing/AIForCreators";
import { AIHowItWorks } from "@/components/landing/AIHowItWorks";
import { AITrustStrip } from "@/components/landing/AITrustStrip";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { DEFAULT_LOCALE, LOCALE_COOKIE, SUPPORTED_LOCALES, type Locale } from "@/lib/i18n/config";
import type { Dictionary } from "@/lib/i18n/types";

export const metadata: Metadata = {
  title: "AI Studio — Zinovia",
  description:
    "Powerful AI tools for creators: remove backgrounds, generate captions, scan for safety, and more — all built into your workflow.",
};

const TOOL_ICONS = [
  "M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z",
  "M14.121 14.121L19 19m-7-7l7-7m-7 7l-2.879 2.879M12 12L9.121 9.121m0 5.758a3 3 0 10-4.243 4.243 3 3 0 004.243-4.243zm0-5.758a3 3 0 10-4.243-4.243 3 3 0 004.243 4.243z",
  "M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z",
  "M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z",
  "M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z",
  "M3 5h12M9 3v2m1.048 9.5A18.022 18.022 0 016.412 9m6.088 9h7M11 21l5-10 5 10M12.751 5C11.783 10.77 8.07 15.61 3 18.129",
];

function getToolFeatures(t: Dictionary["aiToolsLanding"]) {
  return [
    { title: t.removeBgTitle, description: t.removeBgDesc, comingSoon: false },
    { title: t.cartoonTitle, description: t.cartoonDesc, comingSoon: false },
    { title: t.captionsTitle, description: t.captionsDesc, comingSoon: false },
    { title: t.safetyTitle, description: t.safetyDesc, comingSoon: false },
    { title: t.promoTitle, description: t.promoDesc, comingSoon: false },
    { title: t.translateTitle, description: t.translateDesc, comingSoon: false },
  ];
}

export default async function AiStudioLandingPage() {
  const localeCookie = cookies().get(LOCALE_COOKIE)?.value ?? DEFAULT_LOCALE;
  const locale: Locale = (SUPPORTED_LOCALES as readonly string[]).includes(
    localeCookie,
  )
    ? (localeCookie as Locale)
    : DEFAULT_LOCALE;
  const t = await getDictionary(locale);
  const tl = t.aiToolsLanding;
  const tools = getToolFeatures(tl);

  return (
    <main className="hero-bg">
      {/* Hero */}
      <ScrollReveal>
        <section className="mx-auto w-full max-w-6xl px-4 pb-12 pt-16 sm:px-6 sm:pt-24">
          <div className="text-center">
            <div className="mx-auto mb-6 inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/5 px-4 py-1.5">
              <svg
                className="h-4 w-4 text-primary"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={1.5}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 00-2.455 2.456z"
                />
              </svg>
              <span className="text-xs font-medium text-primary">
                AI-Powered
              </span>
            </div>
            <h1 className="font-display text-4xl font-bold tracking-tight text-foreground sm:text-5xl">
              {tl.heroTitle}
            </h1>
            <p className="mx-auto mt-4 max-w-2xl text-lg text-muted-foreground">
              {tl.heroDescription}
            </p>
            <div className="mt-8 flex flex-wrap justify-center gap-4">
              <Button
                size="lg"
                className="btn-cta-primary h-12 px-8 text-base"
                asChild
              >
                <Link href="/ai/images">{tl.ctaGetStarted}</Link>
              </Button>
              <Button
                size="lg"
                variant="secondary"
                className="h-12 px-8 text-base"
                asChild
              >
                <Link href="/signup">{tl.ctaSignUp}</Link>
              </Button>
            </div>
          </div>
        </section>
      </ScrollReveal>

      {/* Tool Features Grid */}
      <ScrollReveal>
        <section
          className="mx-auto w-full max-w-6xl px-4 py-12 sm:px-6"
          aria-labelledby="ai-tools-features"
        >
          <div className="text-center">
            <h2
              id="ai-tools-features"
              className="font-display text-premium-h2 font-bold text-foreground"
            >
              {t.aiFeatures.heading}
            </h2>
            <p className="mx-auto mt-3 max-w-xl text-muted-foreground">
              {t.aiFeatures.subheading}
            </p>
          </div>
          <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {tools.map(({ title, description, comingSoon }, i) => (
              <div
                key={title}
                className={`sr-child card-hover-lift flex flex-col gap-4 rounded-2xl border border-white/[0.06] bg-card p-6${comingSoon ? " opacity-75" : ""}`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                    <svg
                      className="h-5 w-5"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={1.5}
                      aria-hidden
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d={TOOL_ICONS[i]}
                      />
                    </svg>
                  </div>
                  {comingSoon && (
                    <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-0.5 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                      {t.aiFeatures.comingSoonLabel}
                    </span>
                  )}
                </div>
                <h3 className="text-sm font-semibold text-foreground">
                  {title}
                </h3>
                <p className="text-sm leading-relaxed text-muted-foreground">
                  {description}
                </p>
              </div>
            ))}
          </div>
        </section>
      </ScrollReveal>

      {/* How It Works */}
      <ScrollReveal>
        <AIHowItWorks t={t.aiHowItWorks} />
      </ScrollReveal>

      {/* Trust Strip */}
      <ScrollReveal>
        <AITrustStrip t={t.aiTrust} />
      </ScrollReveal>

      {/* CTA */}
      <ScrollReveal>
        <section className="mx-auto w-full max-w-6xl px-4 py-16 sm:px-6">
          <div className="rounded-2xl border border-primary/20 bg-gradient-to-br from-primary/5 via-transparent to-accent/5 px-6 py-12 text-center sm:px-12">
            <h2 className="font-display text-premium-h2 font-bold text-foreground">
              {t.aiCta.heading}
            </h2>
            <p className="mx-auto mt-4 max-w-lg text-muted-foreground">
              {t.aiCta.description}
            </p>
            <div className="mt-8 flex flex-wrap justify-center gap-4">
              <Button
                size="lg"
                className="btn-cta-primary h-12 px-8 text-base"
                asChild
              >
                <Link href="/signup">{t.aiCta.ctaStart}</Link>
              </Button>
              <Button
                size="lg"
                variant="secondary"
                className="h-12 px-8 text-base"
                asChild
              >
                <Link href="/ai/images">{tl.ctaGetStarted}</Link>
              </Button>
            </div>
          </div>
        </section>
      </ScrollReveal>
    </main>
  );
}
