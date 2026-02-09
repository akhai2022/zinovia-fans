import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Section } from "./Section";

const STEPS = [
  { step: 1, title: "Create your space", description: "Set your page in minutes. Add a photo, price, and you're live." },
  { step: 2, title: "Share & earn", description: "Post content. Subscribers get access; you get paid monthly." },
  { step: 3, title: "Get paid on time", description: "Payouts to your bank. Transparent fees, no surprises." },
] as const;

export function HowItWorks() {
  return (
    <Section id="how-it-works" title="How it works" tone="muted" aria-labelledby="how-heading">
      <div className="grid gap-5 sm:grid-cols-3 sm:gap-6">
        {STEPS.map(({ step, title, description }) => (
          <div
            key={step}
            className="group relative rounded-premium-lg border border-border/80 bg-card p-5 shadow-premium-sm transition-shadow duration-fast hover:shadow-premium-md motion-reduce:transition-none sm:p-6"
          >
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-accent-50 text-accent-600 text-premium-body font-semibold" aria-hidden>
              {step}
            </span>
            <h3 className="mt-4 text-premium-h3 font-semibold text-foreground">{title}</h3>
            <p className="mt-2 text-premium-body-sm text-muted-foreground">{description}</p>
          </div>
        ))}
      </div>
      <div className="mt-6 text-center">
        <Button className="rounded-premium-sm transition-transform duration-fast active:scale-[0.98] motion-reduce:transform-none" asChild>
          <Link href="/signup">Get started</Link>
        </Button>
      </div>
    </Section>
  );
}
