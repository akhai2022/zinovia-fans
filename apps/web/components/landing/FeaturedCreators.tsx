"use client";

import Image from "next/image";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useTranslation } from "@/lib/i18n";

const CREATORS = [
  { name: "Alex Rivera", handle: "@alexrivera", niche: "Fitness", image: "/assets/creator_fitness.jpg" },
  { name: "Jordan Blake", handle: "@jordanblake", niche: "Art", image: "/assets/creator_art.jpg" },
  { name: "Sam Taylor", handle: "@samtaylor", niche: "Lifestyle", image: "/assets/creator_lifestyle.jpg" },
  { name: "Casey Lee", handle: "@caseylee", niche: "Music", image: "/assets/creator_music.jpg" },
  { name: "Morgan James", handle: "@morganjames", niche: "Travel", image: "/assets/creator_travel.jpg" },
  { name: "Riley Quinn", handle: "@rileyquinn", niche: "Fashion", image: "/assets/creator_fashion.jpg" },
];

function CreatorCard({ name, handle, niche, image, subscribeLabel }: typeof CREATORS[number] & { subscribeLabel: string }) {
  return (
    <div
      className={cn(
        "group relative flex-shrink-0 overflow-hidden rounded-2xl",
        "w-[220px] sm:w-[240px] md:w-full",
        "border border-white/[0.06] bg-[rgb(18,18,24)]",
        "transition-all duration-300",
        "hover:-translate-y-1 hover:border-white/10 hover:shadow-lg",
        "motion-reduce:hover:translate-y-0"
      )}
    >
      <div className="relative aspect-[3/4] w-full overflow-hidden">
        <Image
          src={image}
          alt={name}
          fill
          quality={85}
          className="object-cover transition-transform duration-500 group-hover:scale-[1.03] motion-reduce:transition-none"
          sizes="(max-width: 768px) 50vw, 240px"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent" />
        <div className="absolute bottom-0 left-0 right-0 p-4">
          <p className="font-semibold text-white">{name}</p>
          <p className="text-sm text-white/60">{handle}</p>
        </div>
      </div>
      <div className="flex items-center justify-between px-4 py-3">
        <span className="rounded-full bg-violet-500/10 px-3 py-1 text-xs font-medium text-violet-400">
          {niche}
        </span>
        <Button size="sm" className="btn-cta-primary h-8 px-4 text-xs" asChild>
          <Link href="/creators">{subscribeLabel}</Link>
        </Button>
      </div>
    </div>
  );
}

export function FeaturedCreators() {
  const { t } = useTranslation();

  return (
    <section className="mx-auto w-full max-w-6xl section-pad px-4 sm:px-6" aria-labelledby="featured-heading">
      <div className="text-center">
        <h2 id="featured-heading" className="font-display text-premium-h2 font-bold text-foreground">
          {t.featuredCreators.heading}
        </h2>
        <p className="mx-auto mt-3 max-w-xl text-muted-foreground">
          {t.featuredCreators.subheading}
        </p>
      </div>
      <div className="mt-10 flex gap-4 overflow-x-auto pb-2 md:grid md:grid-cols-3 md:gap-5 md:overflow-visible md:pb-0 lg:grid-cols-6">
        {CREATORS.map((c) => (
          <CreatorCard key={c.handle} {...c} subscribeLabel={t.featuredCreators.subscribe} />
        ))}
      </div>
    </section>
  );
}
