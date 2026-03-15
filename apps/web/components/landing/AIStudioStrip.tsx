import Link from "next/link";
import { Button } from "@/components/ui/button";
import type { Dictionary } from "@/lib/i18n/types";

const CARDS = [
  { key: "removeBg", icon: "content_cut", href: "/ai/tools/remove-bg", isNew: false },
  { key: "cartoon", icon: "brush", href: "/ai/tools/cartoon-avatar", isNew: false },
  { key: "animate", icon: "animation", href: "/ai/tools/animate-image", isNew: false },
  { key: "autoCaption", icon: "subtitles", href: "/ai/tools/auto-caption", isNew: false },
  { key: "safety", icon: "shield", href: "/ai", isNew: false },
  { key: "virtualTryOn", icon: "checkroom", href: "/ai/tools/virtual-tryon", isNew: false },
  { key: "motionTransfer", icon: "movie_creation", href: "/ai/tools/motion-transfer", isNew: true },
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
    case "motionTransfer": return t.motionTransferTitle;
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
    case "motionTransfer": return t.motionTransferDesc;
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
        {CARDS.map(({ key, icon, href, isNew }) => (
          <Link
            key={key}
            href={href}
            className={`sr-child card-hover-lift group relative flex flex-col gap-3 rounded-2xl border p-6 transition-colors hover:border-primary/20 ${
              isNew
                ? "border-primary/40 bg-gradient-to-br from-primary/[0.08] via-card to-card ring-1 ring-primary/20"
                : "border-white/[0.06] bg-card"
            }`}
          >
            {isNew && (
              <span className="absolute right-4 top-4 inline-flex animate-pulse items-center gap-1 rounded-full bg-primary px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider text-white shadow-lg shadow-primary/30">
                <span className="material-symbols-outlined text-sm">bolt</span>
                New
              </span>
            )}
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
