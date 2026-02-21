import type { Dictionary } from "@/lib/i18n/types";

const ICON_PATHS: Record<string, string> = {
  blur: "M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z",
  crop: "M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4",
  tag: "M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A2 2 0 013 12V7a4 4 0 014-4z",
};

function FeatureIcon({ type }: { type: string }) {
  return (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5} aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d={ICON_PATHS[type] || ICON_PATHS.blur} />
    </svg>
  );
}

export function SmartMedia({ t }: { t: Dictionary["smartMedia"] }) {
  const FEATURES = [
    { title: t.instantPreviewsTitle, description: t.instantPreviewsDesc, icon: "blur" },
    { title: t.smartThumbnailsTitle, description: t.smartThumbnailsDesc, icon: "crop" },
    { title: t.securePreviewsTitle, description: t.securePreviewsDesc, icon: "tag" },
  ];

  return (
    <section className="mx-auto w-full max-w-6xl section-pad px-4 sm:px-6" aria-labelledby="smart-media-heading">
      <div className="text-center">
        <h2 id="smart-media-heading" className="font-display text-premium-h2 font-bold text-foreground">
          {t.heading}
        </h2>
        <p className="mx-auto mt-3 max-w-xl text-muted-foreground">
          {t.subheading}
        </p>
      </div>
      <div className="mt-10 grid gap-4 sm:grid-cols-3">
        {FEATURES.map(({ title, description, icon }) => (
          <div
            key={title}
            className="sr-child card-hover-lift flex flex-col gap-4 rounded-2xl border border-white/[0.06] bg-card p-6"
          >
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
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
