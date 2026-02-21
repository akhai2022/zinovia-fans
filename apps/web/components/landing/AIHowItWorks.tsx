import type { Dictionary } from "@/lib/i18n/types";

function getSteps(t: Dictionary["aiHowItWorks"]) {
  return [
    { step: "01", title: t.step1Title, description: t.step1Desc },
    { step: "02", title: t.step2Title, description: t.step2Desc },
    { step: "03", title: t.step3Title, description: t.step3Desc },
  ];
}

export function AIHowItWorks({ t }: { t: Dictionary["aiHowItWorks"] }) {
  const steps = getSteps(t);

  return (
    <section
      className="mx-auto w-full max-w-6xl section-pad px-4 sm:px-6"
      aria-labelledby="ai-how-heading"
    >
      <div className="text-center">
        <h2
          id="ai-how-heading"
          className="font-display text-premium-h2 font-bold text-foreground"
        >
          {t.heading}
        </h2>
        <p className="mx-auto mt-3 max-w-xl text-muted-foreground">
          {t.subheading}
        </p>
      </div>

      <div className="mt-10 grid gap-6 md:grid-cols-3">
        {steps.map(({ step, title, description }) => (
          <div
            key={step}
            className="sr-child relative rounded-2xl border border-white/[0.06] bg-card p-6"
          >
            <span className="text-gradient-brand text-4xl font-bold">{step}</span>
            <h3 className="mt-3 text-base font-semibold text-foreground">{title}</h3>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              {description}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}
