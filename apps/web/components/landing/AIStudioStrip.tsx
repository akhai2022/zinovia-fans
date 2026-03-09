import Link from "next/link";
import { Button } from "@/components/ui/button";
import type { Dictionary } from "@/lib/i18n/types";

const CARDS = [
  { key: "removeBg", icon: "content_cut", href: "/ai/tools/remove-bg" },
  { key: "cartoon", icon: "brush", href: "/ai/tools/cartoon-avatar" },
  { key: "animate", icon: "animation", href: "/ai/tools/animate-image" },
  { key: "autoCaption", icon: "subtitles", href: "/ai/tools/auto-caption" },
  { key: "safety", icon: "shield", href: "/ai" },
  { key: "virtualTryOn", icon: "checkroom", href: "/ai/tools/virtual-tryon" },
] as const;

type CardKey = (typeof CARDS)[number]["key"];

function getCardTitle(key: CardKey, t: Dictionary["aiStudioStrip"]): string {
  switch (key) {
    case "removeBg": return t.removeBgTitle;
    case "cartoon": return t.cartoonTitle;
    case "animate": return t.animateTitle;
    case "autoCaption": return t.autoCaptionTitle;
    case "safety": return t.safetyTitle;
    case "virtualTryOn": return t.virtualTryOnTitle;
  }
}

function getCardDesc(key: CardKey, t: Dictionary["aiStudioStrip"]): string {
  switch (key) {
    case "removeBg": return t.removeBgDesc;
    case "cartoon": return t.cartoonDesc;
    case "animate": return t.animateDesc;
    case "autoCaption": return t.autoCaptionDesc;
    case "safety": return t.safetyDesc;
    case "virtualTryOn": return t.virtualTryOnDesc;
  }
}

export function AIStudioStrip({ t }: { t: Dictionary["aiStudioStrip"] }) {
  return (
    <section
      className="mx-auto w-full max-w-6xl section-pad px-4 sm:px-6"
      aria-labelledby="ai-studio-heading"
    >
      <div className="text-center">
        <div className="mx-auto mb-4 inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/5 px-4 py-1.5">
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
          <span className="text-xs font-medium text-primary">{t.badge}</span>
        </div>
        <h2
          id="ai-studio-heading"
          className="font-display text-premium-h2 font-bold text-foreground"
        >
          {t.heading}
        </h2>
        <p className="mx-auto mt-3 max-w-xl text-muted-foreground">
          {t.subheading}
        </p>
      </div>

      <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {CARDS.map(({ key, icon, href }) => (
          <Link
            key={key}
            href={href}
            className="sr-child card-hover-lift group flex flex-col gap-3 rounded-2xl border border-white/[0.06] bg-card p-6 transition-colors hover:border-primary/20"
          >
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary transition-transform group-hover:scale-110">
              <span className="material-symbols-outlined text-xl">{icon}</span>
            </div>
            <h3 className="text-sm font-semibold text-foreground">
              {getCardTitle(key, t)}
            </h3>
            <p className="text-sm leading-relaxed text-muted-foreground">
              {getCardDesc(key, t)}
            </p>
          </Link>
        ))}
      </div>

      <div className="mt-8 flex flex-wrap justify-center gap-4">
        <Button size="lg" className="btn-cta-primary h-12 px-8 text-base" asChild>
          <Link href="/signup">{t.ctaStart}</Link>
        </Button>
        <Button size="lg" variant="secondary" className="h-12 px-8 text-base" asChild>
          <Link href="/ai">{t.ctaExplore}</Link>
        </Button>
      </div>
    </section>
  );
}
