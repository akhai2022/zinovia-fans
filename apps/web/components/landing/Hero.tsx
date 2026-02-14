"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { CreatorAvatar } from "@/components/ui/CreatorAvatar";
import { HeroBackground } from "@/components/brand/HeroBackground";
import { BrandAssetsService } from "@/features/ai/api";
import { Container, CopyBlock } from "./Container";
import { ProductPreview } from "./ProductPreview";
import { DEMO_ASSETS } from "@/lib/demoAssets";
import "@/lib/api";

const FEATURED_PLACEHOLDER = [
  { displayName: "Alex", handle: "alex" },
  { displayName: "Jordan", handle: "jordan" },
  { displayName: "Sam", handle: "sam" },
];

export function Hero() {
  const [heroImageUrl, setHeroImageUrl] = useState<string | null>(null);
  useEffect(() => {
    BrandAssetsService.get()
      .then((res) => setHeroImageUrl(res.landing_hero ?? null))
      .catch(() => {});
  }, []);

  return (
    <HeroBackground
      backgroundImageUrl={heroImageUrl}
      withGrid
      withGrain
      className="min-h-[68vh] md:min-h-[60vh] flex flex-col justify-center"
    >
      <section
        className="relative flex flex-col justify-center"
        aria-labelledby="hero-heading"
      >
        <Container className="flex flex-col md:flex-row md:items-center md:justify-between gap-8 md:gap-10 py-10 sm:py-14 md:py-16">
          <div className="flex-1 flex flex-col md:max-w-[55%]">
            <CopyBlock>
              <span
                className="inline-block rounded-full border border-brand/20 bg-brand-gradient-subtle px-3 py-1 text-premium-label font-medium uppercase tracking-wide text-foreground/80 mb-4"
                aria-hidden
              >
                Creator subscription platform
              </span>
              <h1
                id="hero-heading"
                className="font-display text-premium-h1 font-semibold tracking-tight text-foreground"
              >
                Where creators get paid, and fans get in.
              </h1>
              <p className="mt-3 text-premium-body text-muted-foreground sm:text-lg">
                Set your subscription, share your content, get paid on time. No
                gatekeeping.
              </p>
              <div className="mt-6 flex flex-wrap items-center gap-3">
                <Button variant="brand" size="lg" className="rounded-premium-sm" asChild>
                  <Link href="/signup">Start as creator</Link>
                </Button>
                <Button
                  variant="outline"
                  size="lg"
                  className="rounded-premium-sm"
                  asChild
                >
                  <Link href="#how-it-works">See how it works</Link>
                </Button>
              </div>
              <p className="mt-3 text-premium-small text-muted-foreground">
                Free to join. No credit card to browse.
              </p>
              {/* Featured creators mini-row */}
              <div className="mt-6 flex items-center gap-4">
                <div className="flex -space-x-2">
                  {FEATURED_PLACEHOLDER.map((c) => (
                    <CreatorAvatar
                      key={c.handle}
                      src={DEMO_ASSETS.avatar[256]}
                      displayName={c.displayName}
                      handle={c.handle}
                      size="sm"
                      withRing
                      className="border-2 border-background"
                    />
                  ))}
                </div>
                <p className="text-premium-body-sm text-muted-foreground">
                  Join creators already earning on Zinovia
                </p>
              </div>
            </CopyBlock>
          </div>
          <div className="flex-1 flex justify-center md:justify-end md:min-w-0">
            <ProductPreview />
          </div>
        </Container>
      </section>
    </HeroBackground>
  );
}
