/**
 * "As seen in" logos row — placeholders (text or simple shapes).
 * Replace with real logo images when available.
 */
const LOGO_PLACEHOLDERS = ["Press", "Tech", "Creator", "Media", "Award"];

export function AsSeenIn() {
  return (
    <section className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6" aria-label="As seen in">
      <p className="mb-6 text-center text-premium-small uppercase tracking-wider text-muted-foreground">
        As seen in
      </p>
      <div className="flex flex-wrap items-center justify-center gap-8 md:gap-12">
        {LOGO_PLACEHOLDERS.map((name) => (
          <span
            key={name}
            className="rounded-lg border border-white/10 bg-white/5 px-6 py-2 text-sm font-medium text-muted-foreground backdrop-blur-sm"
          >
            {name}
          </span>
        ))}
      </div>
    </section>
  );
}
