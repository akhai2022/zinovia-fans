import { Card } from "@/components/ui/card";

const ITEMS = [
  {
    title: "Stripe checkout",
    description: "Secure payments with industry-standard encryption.",
    Icon: StripeIcon,
  },
  {
    title: "Identity verification",
    description: "Creators are verified to keep the community safe.",
    Icon: ShieldIcon,
  },
  {
    title: "Private media delivery",
    description: "Content is delivered securely; only you and your subscribers see it.",
    Icon: LockIcon,
  },
  {
    title: "Age-gated access",
    description: "Age verification where required for restricted content.",
    Icon: AgeIcon,
  },
];

function StripeIcon() {
  return (
    <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5} aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
    </svg>
  );
}
function ShieldIcon() {
  return (
    <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5} aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
    </svg>
  );
}
function LockIcon() {
  return (
    <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5} aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
    </svg>
  );
}
function AgeIcon() {
  return (
    <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5} aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
    </svg>
  );
}

export function SafetyPrivacy() {
  return (
    <section className="mx-auto w-full max-w-6xl px-4 py-12 sm:px-6 md:py-16" aria-labelledby="safety-heading">
      <h2 id="safety-heading" className="font-display text-premium-h2 font-semibold text-foreground">
        Safety &amp; Privacy
      </h2>
      <p className="mt-2 max-w-[55ch] text-premium-body text-muted-foreground prose-width">
        We&apos;re built for trust: secure payments, verified creators, and private delivery.
      </p>
      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {ITEMS.map(({ title, description, Icon }) => (
          <Card
            key={title}
            className="card-hover-lift flex flex-col gap-3 rounded-2xl border border-white/10 p-5 shadow-premium-sm"
          >
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-plum/10 text-brand-plum">
              <Icon />
            </div>
            <h3 className="font-semibold text-foreground">{title}</h3>
            <p className="text-sm leading-relaxed text-muted-foreground">{description}</p>
          </Card>
        ))}
      </div>
    </section>
  );
}
