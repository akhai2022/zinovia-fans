import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Section } from "./Section";

const PLANS = [
  {
    name: "Creator",
    description: "For individuals getting started",
    price: "You set your price",
    interval: "per month",
    bullets: ["Your own creator page", "Subscriptions & tips", "Subscriber-only content & DMs", "Monthly payouts"],
    cta: "Start as creator",
    href: "/signup",
    popular: false,
  },
  {
    name: "Creator Plus",
    description: "Same great product — we just highlight this one",
    price: "You set your price",
    interval: "per month",
    bullets: ["Everything in Creator", "Priority support", "Early access to new features"],
    cta: "Get started",
    href: "/signup",
    popular: true,
  },
  {
    name: "Fans",
    description: "Subscribe to creators you love",
    price: "Varies",
    interval: "by creator",
    bullets: ["Browse creators free", "Subscribe to unlock content", "Cancel anytime"],
    cta: "Browse creators",
    href: "/feed",
    popular: false,
  },
] as const;

export function PricingSection() {
  return (
    <Section
      id="pricing"
      title="Simple pricing"
      subtitle="You set your subscription price. We handle payments and payouts. Transparent fee. No hidden charges."
      tone="muted"
      aria-labelledby="pricing-heading"
    >
      <div className="grid gap-5 md:grid-cols-3 sm:gap-6">
        {PLANS.map((plan) => (
          <PricingCard key={plan.name} plan={plan} />
        ))}
      </div>
      <p className="mt-6 text-center text-premium-small text-muted-foreground">
        Cancel anytime. Access continues until the end of your billing period.
      </p>
    </Section>
  );
}

function PricingCard({ plan }: { plan: (typeof PLANS)[number] }) {
  const isPopular = plan.popular;
  return (
    <div
      className={`
        relative flex flex-col rounded-premium-xl border p-5 transition-all duration-fast motion-reduce:transition-none sm:p-6
        ${isPopular ? "border-brand/30 bg-card shadow-med ring-1 ring-brand/20" : "border-border/80 bg-card shadow-soft hover:shadow-med"}
      `}
    >
      {isPopular && (
        <div className="absolute -top-3 left-0 right-0 flex flex-col items-center">
          <Badge variant="popular">Most popular</Badge>
          <span className="mt-1 text-premium-label text-muted-foreground">Best for growth</span>
        </div>
      )}
      <h3 className="font-display text-premium-h3 font-semibold text-foreground">{plan.name}</h3>
      <p className="mt-1 text-premium-body-sm text-muted-foreground">{plan.description}</p>
      <div className="mt-4">
        <span className="text-premium-body font-semibold text-foreground">{plan.price}</span>
        <span className="text-premium-body-sm text-muted-foreground"> {plan.interval}</span>
      </div>
      <ul className="mt-4 flex-1 space-y-2" role="list">
        {plan.bullets.map((bullet) => (
          <li key={bullet} className="flex items-center gap-2 text-premium-body-sm text-foreground">
            <span className="text-success-500" aria-hidden><CheckIcon /></span>
            {bullet}
          </li>
        ))}
      </ul>
      <Button className="mt-6 w-full rounded-premium-sm" variant={isPopular ? "brand" : "outline"} asChild>
        <Link href={plan.href}>{plan.cta}</Link>
      </Button>
    </div>
  );
}

function CheckIcon() {
  return (
    <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20" aria-hidden>
      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
    </svg>
  );
}
