import type { Dictionary } from "@/lib/i18n/types";

export function StatsStrip({ t }: { t: Dictionary["stats"] }) {
  const STATS = [
    { value: t.creatorsValue, label: t.creatorsLabel },
    { value: t.payoutValue, label: t.payoutLabel },
    { value: t.retentionValue, label: t.retentionLabel },
    { value: t.totalPayoutsValue, label: t.totalPayoutsLabel },
  ];

  return (
    <section className="mx-auto w-full max-w-6xl px-4 sm:px-6" aria-label="Platform statistics">
      <div className="grid grid-cols-2 gap-px overflow-hidden rounded-2xl border border-white/[0.06] bg-white/[0.03] md:grid-cols-4">
        {STATS.map(({ value, label }) => (
          <div key={label} className="bg-[rgb(14,14,18)] px-6 py-8 text-center md:py-10">
            <p className="font-display text-3xl font-bold text-foreground md:text-4xl">
              {value}
            </p>
            <p className="mt-1.5 text-sm text-muted-foreground">{label}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
