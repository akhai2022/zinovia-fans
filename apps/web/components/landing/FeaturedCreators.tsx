"use client";

import Image from "next/image";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

/** High-quality photography from /public/assets — duplicated for 6 cards. */
const FEATURED_IMAGES = [
  "/assets/zinovia_creator_glam_4x5.jpg",
  "/assets/zinovia_creator_star_4x5.jpg",
  "/assets/zinovia_collage_promo_v2.png",
  "/assets/zinovia_creator_glam_4x5.jpg",
  "/assets/zinovia_creator_star_4x5.jpg",
  "/assets/zinovia_collage_promo_v2.png",
];

const FEATURED = [
  { name: "Alex Rivera", price: "9.99", tags: ["Fitness", "Lifestyle"], image: FEATURED_IMAGES[0] },
  { name: "Jordan Blake", price: "9.99", tags: ["Creative", "Art"], image: FEATURED_IMAGES[1] },
  { name: "Sam Taylor", price: "9.99", tags: ["Wellness", "Mindfulness"], image: FEATURED_IMAGES[2] },
  { name: "Casey Lee", price: "9.99", tags: ["Fitness", "Nutrition"], image: FEATURED_IMAGES[3] },
  { name: "Morgan James", price: "9.99", tags: ["Lifestyle", "Travel"], image: FEATURED_IMAGES[4] },
  { name: "Riley Quinn", price: "9.99", tags: ["Creative", "Music"], image: FEATURED_IMAGES[5] },
];

function CreatorCard({
  name,
  price,
  tags,
  image,
}: {
  name: string;
  price: string;
  tags: string[];
  image: string;
}) {
  return (
    <Card
      className={cn(
        "group relative flex flex-shrink-0 flex-col overflow-hidden rounded-2xl border border-white/10 shadow-premium-md",
        "transition-all duration-300 ease-premium-out",
        "hover:-translate-y-1 hover:shadow-premium-lg",
        "w-[280px] sm:w-[300px] md:w-full"
      )}
    >
      {/* Shine overlay on hover — sweep animation */}
      <div
        className="pointer-events-none absolute inset-0 z-10 opacity-0 transition-opacity duration-300 group-hover:opacity-100 group-hover:animate-card-shine motion-reduce:animate-none"
        aria-hidden
        style={{
          background: "linear-gradient(105deg, transparent 40%, rgba(255,255,255,0.08) 45%, rgba(255,255,255,0.15) 50%, transparent 55%)",
          backgroundSize: "200% 100%",
        }}
      />
      <div className="relative aspect-[4/5] w-full overflow-hidden bg-muted [contain:layout]">
        <Image
          src={image}
          alt={`${name} — creator profile`}
          fill
          quality={90}
          className="object-cover transition-transform duration-500 group-hover:scale-105"
          sizes="(max-width: 768px) 280px, 600px"
        />
      </div>
      <div className="flex flex-col gap-3 p-4">
        <p className="font-semibold text-foreground">{name}</p>
        <p className="text-sm font-medium text-foreground">
          €{price}
          <span className="font-normal text-muted-foreground">/mo</span>
        </p>
        <div className="flex flex-wrap gap-1.5">
          {tags.map((tag) => (
            <span
              key={tag}
              className="rounded-md bg-brand-plum/10 px-2 py-0.5 text-xs font-medium text-foreground/80"
            >
              {tag}
            </span>
          ))}
        </div>
        <Button size="sm" className="btn-cta-primary mt-1 w-full" asChild>
          <Link href="/creators">Subscribe</Link>
        </Button>
      </div>
    </Card>
  );
}

export function FeaturedCreators() {
  return (
    <section className="mx-auto w-full max-w-6xl section-pad px-4 sm:px-6" aria-labelledby="featured-creators-heading">
      <h2 id="featured-creators-heading" className="font-display text-premium-h2 font-semibold text-foreground">
        Featured creators
      </h2>
      <p className="mt-2 max-w-[55ch] text-premium-body text-muted-foreground prose-width">
        Support creators you love and get exclusive content.
      </p>
      {/* Mobile: horizontal scroll; Desktop: 3-col grid */}
      <div className="mt-8 flex gap-4 overflow-x-auto pb-2 scrollbar-thin md:grid md:grid-cols-3 md:overflow-visible md:gap-6 md:pb-0">
        {FEATURED.map((creator) => (
          <CreatorCard key={creator.name} {...creator} />
        ))}
      </div>
    </section>
  );
}
