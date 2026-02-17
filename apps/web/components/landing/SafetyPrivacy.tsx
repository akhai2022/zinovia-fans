import type { Dictionary } from "@/lib/i18n/types";

const ICON_PATHS: Record<string, string> = {
  card: "M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z",
  shield: "M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z",
  lock: "M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z",
  user: "M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z",
};

function FeatureIcon({ type }: { type: string }) {
  return (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5} aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d={ICON_PATHS[type] || ICON_PATHS.shield} />
    </svg>
  );
}

export function SafetyPrivacy({ t }: { t: Dictionary["safety"] }) {
  const FEATURES = [
    { title: t.securePaymentsTitle, description: t.securePaymentsDesc, icon: "card" },
    { title: t.verificationTitle, description: t.verificationDesc, icon: "shield" },
    { title: t.privateDeliveryTitle, description: t.privateDeliveryDesc, icon: "lock" },
    { title: t.ageGatedTitle, description: t.ageGatedDesc, icon: "user" },
  ];

  return (
    <section className="mx-auto w-full max-w-6xl section-pad px-4 sm:px-6" aria-labelledby="safety-heading">
      <div className="text-center">
        <h2 id="safety-heading" className="font-display text-premium-h2 font-bold text-foreground">
          {t.heading}
        </h2>
        <p className="mx-auto mt-3 max-w-xl text-muted-foreground">
          {t.subheading}
        </p>
      </div>
      <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {FEATURES.map(({ title, description, icon }) => (
          <div
            key={title}
            className="card-hover-lift flex flex-col gap-4 rounded-2xl border border-white/[0.06] bg-[rgb(18,18,24)] p-6"
          >
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-500/10 text-violet-400">
              <FeatureIcon type={icon} />
            </div>
            <h3 className="text-sm font-semibold text-foreground">{title}</h3>
            <p className="text-sm leading-relaxed text-muted-foreground">{description}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
