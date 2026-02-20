import type { Dictionary } from "@/lib/i18n/types";

export function Testimonials({ t }: { t: Dictionary["testimonials"] }) {
  const TESTIMONIALS = [
    { quote: t.quote1, author: "Alex R.", role: t.roleCreator, initials: "AR" },
    { quote: t.quote2, author: "Jordan B.", role: t.roleCreator, initials: "JB" },
    { quote: t.quote3, author: "Sam T.", role: t.roleSubscriber, initials: "ST" },
    { quote: t.quote4, author: "Casey L.", role: t.roleCreator, initials: "CL" },
  ];

  return (
    <section className="mx-auto w-full max-w-6xl section-pad px-4 sm:px-6" aria-labelledby="testimonials-heading">
      <div className="text-center">
        <h2 id="testimonials-heading" className="font-display text-premium-h2 font-bold text-foreground">
          {t.heading}
        </h2>
        <p className="mx-auto mt-3 max-w-xl text-muted-foreground">
          {t.subheading}
        </p>
      </div>
      <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {TESTIMONIALS.map(({ quote, author, role, initials }) => (
          <div
            key={author}
            className="card-hover-lift flex flex-col rounded-2xl border border-white/[0.06] bg-card p-6"
          >
            <p className="flex-1 text-sm leading-relaxed text-muted-foreground">
              &ldquo;{quote}&rdquo;
            </p>
            <div className="mt-5 flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                {initials}
              </div>
              <div>
                <p className="text-sm font-medium text-foreground">{author}</p>
                <p className="text-xs text-muted-foreground">{role}</p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
