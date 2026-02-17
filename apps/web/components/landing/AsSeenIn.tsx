const PUBLICATIONS = [
  "TechCrunch",
  "Forbes",
  "Business Insider",
  "The Verge",
  "Wired",
  "Bloomberg",
];

export function AsSeenIn({ heading }: { heading: string }) {
  return (
    <section className="border-y border-white/5 bg-white/[0.02] py-6" aria-label="Featured in">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <p className="mb-4 text-center text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground/60">
          {heading}
        </p>
        <div className="relative overflow-hidden">
          <div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-16 bg-gradient-to-r from-[rgb(10,10,14)] to-transparent" />
          <div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-16 bg-gradient-to-l from-[rgb(10,10,14)] to-transparent" />
          <div className="animate-marquee flex w-max items-center gap-16">
            {[...PUBLICATIONS, ...PUBLICATIONS].map((name, i) => (
              <span
                key={`${name}-${i}`}
                className="whitespace-nowrap text-base font-semibold tracking-wide text-white/20"
              >
                {name}
              </span>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
