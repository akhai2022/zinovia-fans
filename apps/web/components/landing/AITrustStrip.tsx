import type { Dictionary } from "@/lib/i18n/types";

const TRUST_ICONS = [
  "M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z",
  "M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z",
  "M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4",
];

function getTrustItems(t: Dictionary["aiTrust"]) {
  return [
    { title: t.privacyTitle, description: t.privacyDesc },
    { title: t.noThirdPartyTitle, description: t.noThirdPartyDesc },
    { title: t.auditTitle, description: t.auditDesc },
  ];
}

export function AITrustStrip({ t }: { t: Dictionary["aiTrust"] }) {
  const items = getTrustItems(t);

  return (
    <section className="mx-auto w-full max-w-6xl section-pad px-4 sm:px-6">
      <div className="rounded-2xl border border-white/[0.06] bg-card/50 px-6 py-8 sm:px-10">
        <div className="grid gap-8 sm:grid-cols-3">
          {items.map(({ title, description }, i) => (
            <div key={title} className="flex gap-4">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-400">
                <svg
                  className="h-5 w-5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={1.5}
                  aria-hidden
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d={TRUST_ICONS[i]} />
                </svg>
              </div>
              <div>
                <h3 className="text-sm font-semibold text-foreground">{title}</h3>
                <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                  {description}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
