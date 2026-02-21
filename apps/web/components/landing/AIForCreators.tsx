import type { Dictionary } from "@/lib/i18n/types";

const AI_FEATURE_ICONS = [
  "M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z",
  "M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z",
  "M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A2 2 0 013 12V7a4 4 0 014-4z",
  "M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z",
  "M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z",
  "M3 5h12M9 3v2m1.048 9.5A18.022 18.022 0 016.412 9m6.088 9h7M11 21l5-10 5 10M12.751 5C11.783 10.77 8.07 15.61 3 18.129",
];

function getFeatures(t: Dictionary["aiFeatures"]) {
  return [
    { title: t.safetyScanTitle, description: t.safetyScanDesc, comingSoon: false },
    { title: t.smartCaptionsTitle, description: t.smartCaptionsDesc, comingSoon: false },
    { title: t.autoTagsTitle, description: t.autoTagsDesc, comingSoon: false },
    { title: t.smartPreviewsTitle, description: t.smartPreviewsDesc, comingSoon: false },
    { title: t.promoCopyTitle, description: t.promoCopyDesc, comingSoon: true },
    { title: t.autoTranslateTitle, description: t.autoTranslateDesc, comingSoon: true },
  ];
}

export function AIForCreators({ t }: { t: Dictionary["aiFeatures"] }) {
  const features = getFeatures(t);

  return (
    <section
      className="mx-auto w-full max-w-6xl section-pad px-4 sm:px-6"
      aria-labelledby="ai-features-heading"
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
          id="ai-features-heading"
          className="font-display text-premium-h2 font-bold text-foreground"
        >
          {t.heading}
        </h2>
        <p className="mx-auto mt-3 max-w-xl text-muted-foreground">
          {t.subheading}
        </p>
      </div>

      <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {features.map(({ title, description, comingSoon }, i) => (
          <div
            key={title}
            className={`sr-child card-hover-lift flex flex-col gap-4 rounded-2xl border border-white/[0.06] bg-card p-6${comingSoon ? " opacity-75" : ""}`}
          >
            <div className="flex items-center justify-between">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <svg
                  className="h-5 w-5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={1.5}
                  aria-hidden
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d={AI_FEATURE_ICONS[i]} />
                </svg>
              </div>
              {comingSoon && (
                <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-0.5 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                  {t.comingSoonLabel}
                </span>
              )}
            </div>
            <h3 className="text-sm font-semibold text-foreground">{title}</h3>
            <p className="text-sm leading-relaxed text-muted-foreground">{description}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
