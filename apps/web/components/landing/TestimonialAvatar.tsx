"use client";

import Image from "next/image";
import { cn } from "@/lib/utils";

/**
 * Avatar for testimonials: image or initials in gradient circle (no blank block).
 */
export function TestimonialAvatar({
  src,
  name,
  className,
}: {
  src?: string | null;
  name: string;
  className?: string;
}) {
  const initials = name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((s) => s[0]?.toUpperCase())
    .join("") || "ZF";

  return (
    <div
      className={cn(
        "relative h-10 w-10 shrink-0 overflow-hidden rounded-full border border-border/60 bg-gradient-to-br from-accent-500/30 to-secondary/40 flex items-center justify-center",
        className
      )}
    >
      {src ? (
        <Image src={src} alt="" fill loading="lazy" quality={75} className="object-cover" sizes="40px" />
      ) : (
        <span className="text-xs font-semibold text-foreground/70">{initials}</span>
      )}
    </div>
  );
}
