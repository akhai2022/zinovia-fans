"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const HERO_GLAM = "/assets/zinovia_creator_glam_4x5.jpg";
const HERO_STAR = "/assets/zinovia_creator_star_4x5.jpg";
const COLLAGE = "/assets/zinovia_collage_promo_v2.png";

type Segment = "fans" | "creators";

const FANS_COPY = {
  badge: "Premium creators, trusted payouts",
  title: "Subscribe to exclusive content.",
  highlight: "Unlock the feed.",
  body: "Support your favourite creators and get access to exclusive photos, videos, and daily updates — all in one place, on Zinovia.ai.",
  primaryCta: "Start Subscribing",
  primaryHref: "/signup",
  secondaryCta: "Explore Creators",
  secondaryHref: "/creators",
};

const CREATORS_COPY = {
  badge: "Earn on your terms",
  title: "Build your audience.",
  highlight: "Earn recurring revenue.",
  body: "Set your subscription price, publish premium posts and paywalled content, and receive payouts securely. Built for conversion and trust.",
  primaryCta: "Become a Creator",
  primaryHref: "/signup",
  secondaryCta: "See top creators",
  secondaryHref: "/creators",
};

export function LandingHero() {
  const [segment, setSegment] = useState<Segment>("fans");
  const copy = segment === "fans" ? FANS_COPY : CREATORS_COPY;

  return (
    <section
      className="relative mx-auto w-full max-w-6xl gap-8 section-pad px-4 sm:px-6 md:grid md:grid-cols-2 md:items-center md:gap-12"
      aria-labelledby="hero-heading"
    >
      {/* Grain overlay */}
      <div className="pointer-events-none absolute inset-0 z-0 hero-grain" aria-hidden />

      {/* Left — segment control + copy + CTAs */}
      <div className="relative z-10 space-y-6">
        <div
          role="tablist"
          aria-label="Audience type"
          className="inline-flex rounded-xl border border-white/10 bg-white/5 p-1 backdrop-blur-sm"
        >
          <button
            type="button"
            role="tab"
            aria-selected={segment === "fans"}
            aria-controls="hero-copy"
            id="tab-fans"
            onClick={() => setSegment("fans")}
            className={cn(
              "rounded-lg px-4 py-2 text-sm font-medium transition-all duration-200",
              segment === "fans"
                ? "bg-white/90 text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            For Fans
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={segment === "creators"}
            aria-controls="hero-copy"
            id="tab-creators"
            onClick={() => setSegment("creators")}
            className={cn(
              "rounded-lg px-4 py-2 text-sm font-medium transition-all duration-200",
              segment === "creators"
                ? "bg-white/90 text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            For Creators
          </button>
        </div>

        <div id="hero-copy" role="tabpanel" aria-labelledby={segment === "fans" ? "tab-fans" : "tab-creators"} className="space-y-5">
          <Badge variant="primary" className="w-fit">
            {copy.badge}
          </Badge>
          <h1
            id="hero-heading"
            className="font-display text-premium-h1 font-semibold leading-tight tracking-[-0.02em] text-foreground"
          >
            {copy.title}{" "}
            <span className="text-gradient-brand">{copy.highlight}</span>
          </h1>
          <p className="max-w-[55ch] text-premium-body leading-relaxed text-muted-foreground prose-width">
            {copy.body}
          </p>
          <div className="flex flex-wrap gap-3 pt-1">
            <Button size="lg" className="btn-cta-primary" asChild>
              <Link href={copy.primaryHref}>{copy.primaryCta}</Link>
            </Button>
            <Button size="lg" variant="secondary" asChild>
              <Link href={copy.secondaryHref}>{copy.secondaryCta}</Link>
            </Button>
          </div>
        </div>
      </div>

      {/* Right — media gallery with aurora */}
      <div className="relative mt-8 grid grid-cols-2 gap-3 md:mt-0" aria-label="Creator showcase">
        <div className="absolute -inset-4 -z-10 rounded-3xl aurora-bg" aria-hidden />
        <Card className="col-span-2 overflow-hidden rounded-2xl border border-white/10 shadow-premium-lg sm:col-span-1 sm:row-span-2">
          <div className="relative aspect-[4/5] w-full sm:aspect-[4/5]">
            <Image
              src={HERO_GLAM}
              alt="Creator — premium portrait"
              fill
              priority
              quality={90}
              className="object-cover"
              sizes="(max-width: 768px) 100vw, 420px"
            />
          </div>
        </Card>
        <Card className="overflow-hidden rounded-2xl border border-white/10 shadow-premium-md">
          <div className="relative aspect-[4/5] w-full">
            <Image
              src={HERO_STAR}
              alt="Creator — star portrait"
              fill
              priority
              quality={90}
              className="object-cover"
              sizes="(max-width: 768px) 50vw, 260px"
            />
          </div>
        </Card>
        <Card className="overflow-hidden rounded-2xl border border-white/10 shadow-premium-md">
          <div className="relative aspect-[4/5] w-full">
            <Image
              src={COLLAGE}
              alt="Creator collage — subscribe promo"
              fill
              priority
              quality={90}
              className="object-cover"
              sizes="(max-width: 768px) 50vw, 260px"
            />
          </div>
        </Card>
      </div>
    </section>
  );
}
