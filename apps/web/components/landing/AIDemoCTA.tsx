import Link from "next/link";
import { Button } from "@/components/ui/button";
import type { Dictionary } from "@/lib/i18n/types";

export function AIDemoCTA({ t }: { t: Dictionary["aiCta"] }) {
  return (
    <section
      className="mx-auto w-full max-w-6xl section-pad px-4 sm:px-6"
      aria-labelledby="ai-cta-heading"
    >
      <div className="rounded-2xl border border-primary/20 bg-gradient-to-br from-primary/5 via-transparent to-accent/5 px-6 py-12 text-center sm:px-12">
        <h2
          id="ai-cta-heading"
          className="font-display text-premium-h2 font-bold text-foreground"
        >
          {t.heading}
        </h2>
        <p className="mx-auto mt-4 max-w-lg text-muted-foreground">
          {t.description}
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-4">
          <Button size="lg" className="btn-cta-primary h-12 px-8 text-base" asChild>
            <Link href="/signup">{t.ctaStart}</Link>
          </Button>
          <Button size="lg" variant="secondary" className="h-12 px-8 text-base" asChild>
            <Link href="/ai-demo">{t.ctaDemo}</Link>
          </Button>
        </div>
      </div>
    </section>
  );
}
