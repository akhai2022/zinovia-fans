"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const VIDEO_WEBM = "/assets/zinovia_invite_subscribe_1080x1350.webm";
const VIDEO_MP4 = "/assets/zinovia_invite_subscribe_1080x1350.mp4";
const VIDEO_POSTER = "/assets/zinovia_invite_bg_1080x1350.jpg";

const BENEFITS = [
  "Exclusive photos and videos from your favourite creators",
  "Daily feed updates and subscriber-only posts",
  "Secure checkout and private media delivery",
];

/**
 * Subscribe Invite section with background video, glassmorphism overlay,
 * and gradient border. Respects prefers-reduced-motion.
 */
export function SubscribeInviteVideo() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [reducedMotion, setReducedMotion] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReducedMotion(mq.matches);
    const handler = (e: MediaQueryListEvent) => setReducedMotion(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    if (reducedMotion) {
      video.pause();
    } else {
      video.play().catch(() => {});
    }
  }, [reducedMotion]);

  return (
    <section
      className="relative mx-auto w-full max-w-6xl section-pad px-4 sm:px-6"
      aria-label="Subscribe invitation"
    >
      <div className="relative mx-auto max-w-4xl overflow-hidden rounded-3xl">
        {/* Subtle animated gradient border */}
        <div
          className="gradient-border-wrap absolute -inset-[1px] rounded-[calc(1.5rem+2px)] opacity-70"
          aria-hidden
        />

        {/* Fixed aspect 4:5 + max-height so video doesn't stretch/pixelate on ultrawide */}
        <div className="relative aspect-[4/5] max-h-[720px] w-full overflow-hidden rounded-3xl bg-muted md:max-h-[820px]">
          <video
            ref={videoRef}
            autoPlay={!reducedMotion}
            muted
            loop
            playsInline
            preload="metadata"
            poster={VIDEO_POSTER}
            className="absolute inset-0 h-full w-full object-cover"
            aria-hidden
          >
            <source src={VIDEO_WEBM} type="video/webm" />
            <source src={VIDEO_MP4} type="video/mp4" />
          </video>

          <div
            className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/50 to-black/30"
            aria-hidden
          />

          {/* Glassmorphism content card over bottom of video */}
          <div className="absolute inset-x-0 bottom-0 z-10 flex flex-col items-center px-6 py-16 sm:py-24 md:py-28">
            <div
              className={cn(
                "w-full max-w-lg rounded-2xl border border-white/10 bg-white/10 p-6 shadow-premium-lg backdrop-blur-md",
                "md:p-8"
              )}
            >
              <h2 className="font-display text-2xl font-semibold text-white sm:text-3xl md:text-4xl">
                Subscribe on{" "}
                <span className="text-gradient-brand">
                  Zinovia.ai
                </span>
              </h2>
              <ul className="mt-4 space-y-2 text-sm text-white/90 sm:text-base" role="list">
                {BENEFITS.map((benefit, i) => (
                  <li key={i} className="flex items-start gap-2">
                    <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-brand-gold" aria-hidden />
                    <span>{benefit}</span>
                  </li>
                ))}
              </ul>
              <div className="mt-6 flex flex-wrap justify-center gap-3">
                <Button
                  size="lg"
                  className="btn-cta-primary bg-white text-foreground shadow-lg hover:bg-white/90"
                  asChild
                >
                  <Link href="/signup">Start Subscribing</Link>
                </Button>
                <Button
                  size="lg"
                  variant="secondary"
                  className="border-white/30 bg-white/10 text-white backdrop-blur-sm hover:bg-white/20"
                  asChild
                >
                  <Link href="/creators">Explore Creators</Link>
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
