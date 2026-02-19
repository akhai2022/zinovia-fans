"use client";

import Image from "next/image";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { useTranslation } from "@/lib/i18n";
import { BLUR } from "@/lib/blur-placeholders";

export function SubscribeInviteVideo() {
  const { t } = useTranslation();

  return (
    <section
      className="relative mx-auto w-full max-w-6xl section-pad px-4 sm:px-6"
      aria-label="Subscribe invitation"
    >
      <div className="relative mx-auto max-w-4xl overflow-hidden rounded-3xl">
        <div
          className="gradient-border-wrap absolute -inset-[1px] rounded-[calc(1.5rem+2px)] opacity-50"
          aria-hidden
        />

        <div className="relative aspect-[16/10] w-full overflow-hidden rounded-3xl bg-[rgb(14,14,18)]">
          <Image
            src="/assets/hero_abstract.jpg"
            alt="Abstract gradient"
            fill
            loading="lazy"
            quality={90}
            className="object-cover opacity-60"
            sizes="(max-width: 768px) 100vw, 900px"
            placeholder="blur"
            blurDataURL={BLUR["/assets/hero_abstract.jpg"]}
          />

          <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/30 to-black/10" aria-hidden />

          {/* Floating creator thumbnails */}
          <div className="absolute inset-0 flex items-center justify-center gap-4 px-8" aria-hidden>
            {["/assets/creator_fitness.jpg", "/assets/creator_fashion.jpg", "/assets/creator_art.jpg"].map((src, i) => (
              <div
                key={src}
                className="relative h-32 w-24 overflow-hidden rounded-xl border border-white/10 shadow-lg sm:h-44 sm:w-32 md:h-56 md:w-40"
                style={{ transform: `rotate(${(i - 1) * 5}deg) translateY(${i === 1 ? -12 : 8}px)` }}
              >
                <Image
                  src={src}
                  alt=""
                  fill
                  loading="lazy"
                  quality={80}
                  className="object-cover"
                  sizes="160px"
                  placeholder="blur"
                  blurDataURL={BLUR[src]}
                />
              </div>
            ))}
          </div>

          <div className="absolute inset-x-0 bottom-0 z-10 px-6 pb-10 pt-16 sm:pb-14 md:pb-16">
            <div className="mx-auto max-w-lg text-center">
              <h2 className="font-display text-2xl font-bold text-white sm:text-3xl md:text-4xl">
                {t.subscribeInvite.heading}{" "}
                <span className="text-gradient-brand">{t.subscribeInvite.headingAccent}</span>
              </h2>
              <p className="mx-auto mt-3 max-w-md text-sm text-white/70 sm:text-base">
                {t.subscribeInvite.description}
              </p>
              <div className="mt-6 flex flex-wrap justify-center gap-3">
                <Button size="lg" className="btn-cta-primary h-11 px-6" asChild>
                  <Link href="/signup">{t.subscribeInvite.ctaEarn}</Link>
                </Button>
                <Button
                  size="lg"
                  variant="secondary"
                  className="h-11 border-white/20 bg-white/10 px-6 text-white hover:bg-white/20"
                  asChild
                >
                  <Link href="/creators">{t.subscribeInvite.ctaExplore}</Link>
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
