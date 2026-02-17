"use client";

import Image from "next/image";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useTranslation } from "@/lib/i18n";

const HERO_IMAGES = [
  "/assets/hero_creator_1.jpg",
  "/assets/hero_creator_2.jpg",
  "/assets/hero_creator_3.jpg",
];

export function LandingHero() {
  const { t } = useTranslation();

  return (
    <section
      className="relative overflow-hidden"
      aria-labelledby="hero-heading"
    >
      {/* Background glow effects */}
      <div className="pointer-events-none absolute inset-0" aria-hidden>
        <div className="absolute left-1/2 top-0 h-[600px] w-[900px] -translate-x-1/2 -translate-y-1/3 rounded-full bg-gradient-to-br from-violet-600/20 via-purple-500/10 to-pink-500/5 blur-3xl" />
        <div className="absolute right-0 top-1/4 h-[400px] w-[400px] rounded-full bg-pink-500/10 blur-3xl" />
      </div>

      <div className="relative mx-auto max-w-6xl px-4 pb-16 pt-20 sm:px-6 sm:pb-24 sm:pt-28 md:pb-28 md:pt-32">
        <div className="md:grid md:grid-cols-2 md:items-center md:gap-12">
          {/* Left — copy + CTAs */}
          <div className="text-center md:text-left">
            <Badge variant="primary" className="mb-6 w-fit md:mx-0 mx-auto">
              {t.hero.badge}
            </Badge>

            <h1
              id="hero-heading"
              className="font-display text-premium-h1 font-bold leading-[1.08] tracking-[-0.03em] text-foreground"
            >
              {t.hero.heading}{" "}
              <span className="text-gradient-brand">{t.hero.headingAccent}</span>
            </h1>

            <p className="mt-6 max-w-xl text-lg leading-relaxed text-muted-foreground sm:text-xl md:mx-0 mx-auto">
              {t.hero.description}
            </p>

            <div className="mt-8 flex flex-wrap items-center gap-4 md:justify-start justify-center">
              <Button size="lg" className="btn-cta-primary h-12 px-8 text-base" asChild>
                <Link href="/signup">{t.hero.ctaCreator}</Link>
              </Button>
              <Button size="lg" variant="secondary" className="h-12 px-8 text-base" asChild>
                <Link href="/signup">{t.hero.ctaFan}</Link>
              </Button>
            </div>

            <p className="mt-10 text-sm font-medium text-muted-foreground">
              {t.hero.socialProof}{" "}
              <span className="text-gradient-brand font-semibold">{t.hero.socialProofCount}</span>{" "}
              {t.hero.socialProofSuffix}
            </p>
          </div>

          {/* Right — creator image showcase */}
          <div className="relative mt-12 hidden md:block" aria-label="Creator showcase">
            <div className="absolute -inset-8 rounded-3xl aurora-bg" aria-hidden />
            <div className="relative grid grid-cols-5 gap-3">
              {/* Tall left image */}
              <div className="col-span-3 overflow-hidden rounded-2xl border border-white/[0.06] shadow-lg">
                <div className="relative aspect-[3/4]">
                  <Image
                    src={HERO_IMAGES[0]}
                    alt="Creator"
                    fill
                    priority
                    quality={90}
                    className="object-cover"
                    sizes="420px"
                  />
                </div>
              </div>
              {/* Two stacked right images */}
              <div className="col-span-2 flex flex-col gap-3">
                <div className="overflow-hidden rounded-2xl border border-white/[0.06] shadow-lg">
                  <div className="relative aspect-square">
                    <Image
                      src={HERO_IMAGES[1]}
                      alt="Creator"
                      fill
                      priority
                      quality={90}
                      className="object-cover"
                      sizes="260px"
                    />
                  </div>
                </div>
                <div className="overflow-hidden rounded-2xl border border-white/[0.06] shadow-lg">
                  <div className="relative aspect-square">
                    <Image
                      src={HERO_IMAGES[2]}
                      alt="Creator"
                      fill
                      priority
                      quality={90}
                      className="object-cover"
                      sizes="260px"
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
