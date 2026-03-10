import { cookies } from "next/headers";
import Link from "next/link";
import type { Metadata } from "next";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { ScrollReveal } from "@/components/landing/ScrollReveal";
import { Breadcrumbs } from "@/components/seo/Breadcrumbs";
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
  "content_cut",
  "face_retouching_natural",
  "subtitles",
  "verified_user",
  "campaign",
  "translate",
  "animation",
  "closed_caption",
  "checkroom",
];

function getToolFeatures(t: Dictionary["aiToolsLanding"]) {
  return [
    { title: t.removeBgTitle, description: t.removeBgDesc, href: "/ai/tools/remove-bg", comingSoon: false },
    { title: t.cartoonTitle, description: t.cartoonDesc, href: "/ai/tools/cartoon-avatar", comingSoon: false },
    { title: t.captionsTitle, description: t.captionsDesc, href: "/ai/tools/auto-caption", comingSoon: false },
    { title: t.safetyTitle, description: t.safetyDesc, href: null, comingSoon: false },
    { title: t.promoTitle, description: t.promoDesc, href: null, comingSoon: false },
    { title: t.translateTitle, description: t.translateDesc, href: null, comingSoon: false },
    { title: t.animateTitle, description: t.animateDesc, href: "/ai/tools/animate-image", comingSoon: false },
    { title: t.autoCaptionTitle, description: t.autoCaptionDesc, href: "/ai/tools/auto-caption", comingSoon: false },
    { title: t.virtualTryOnTitle, description: t.virtualTryOnDesc, href: "/ai/tools/virtual-tryon", comingSoon: false },
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
      <Breadcrumbs items={[{ label: "AI Studio" }]} />
      {/* Hero */}
      <ScrollReveal>
        <section className="mx-auto w-full max-w-6xl px-4 pb-12 pt-16 sm:px-6 sm:pt-24">
          <div className="text-center">
            <div className="mx-auto mb-6 inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/5 px-4 py-1.5">
              <Icon name="auto_awesome" className="text-base text-primary" />
              <span className="text-xs font-medium text-primary">
                {t.aiFeatures.badge}
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
            {tools.map(({ title, description, href, comingSoon }, i) => {
              const content = (
                <>
                  <div className="flex items-center justify-between">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                      <Icon name={TOOL_ICONS[i]} className="text-xl" />
                    </div>
                    {comingSoon && (
                      <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-0.5 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                        {t.aiFeatures.comingSoonLabel}
                      </span>
                    )}
                    {href && !comingSoon && (
                      <span className="rounded-full border border-primary/20 bg-primary/5 px-2.5 py-0.5 text-[10px] font-medium uppercase tracking-wider text-primary">
                        {t.aiFeatures.tryItLabel}
                      </span>
                    )}
                  </div>
                  <h3 className="text-sm font-semibold text-foreground">
                    {title}
                  </h3>
                  <p className="text-sm leading-relaxed text-muted-foreground">
                    {description}
                  </p>
                </>
              );
              const cls = `sr-child card-hover-lift flex flex-col gap-4 rounded-2xl border border-white/[0.06] bg-card p-6 transition-colors hover:border-primary/20${comingSoon ? " opacity-75" : ""}`;
              return href ? (
                <Link key={title} href={href} className={cls}>
                  {content}
                </Link>
              ) : (
                <div key={title} className={cls}>
                  {content}
                </div>
              );
            })}
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
