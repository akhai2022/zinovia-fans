const STATS = [
  { value: "10K+", label: "Creators earning" },
  { value: "48hr", label: "Payout speed" },
  { value: "92%", label: "Subscriber retention" },
];

export function StatsStrip() {
  return (
    <section className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 md:py-12" aria-label="Platform stats">
      <div className="grid grid-cols-3 gap-4 rounded-2xl border border-white/10 bg-card/80 py-8 backdrop-blur-sm md:gap-8 md:py-12">
        {STATS.map(({ value, label }) => (
          <div key={label} className="text-center">
            <p className="font-display text-2xl font-semibold text-foreground md:text-3xl">{value}</p>
            <p className="mt-1 text-sm text-muted-foreground">{label}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
