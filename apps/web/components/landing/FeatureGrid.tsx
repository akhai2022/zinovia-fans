import { Section } from "./Section";

const FEATURED = {
  title: "Subscriptions, tips & paid messages",
  description:
    "One place to earn from your community. Set your price, offer subscriber-only content and DMs, and get paid on a predictable schedule.",
};

const FEATURES = [
  { title: "DMs that respect boundaries", description: "Message requests, subscriber-only DMs, you choose." },
  { title: "You're in control", description: "Decide what's public, for followers, or for subscribers only." },
  { title: "See what works", description: "Simple stats so you can focus on content that converts." },
] as const;

export function FeatureGrid() {
  return (
    <Section id="features" title="Everything you need to grow" aria-labelledby="features-heading">
      <div className="mb-6 rounded-premium-xl border border-border/80 bg-gradient-to-br from-card to-muted/30 p-6 shadow-premium-md transition-shadow duration-fast hover:shadow-premium-lg motion-reduce:transition-none sm:p-7">
        <h3 className="text-premium-h3 font-semibold text-foreground">{FEATURED.title}</h3>
        <p className="mt-2 max-w-2xl text-premium-body-sm text-muted-foreground">{FEATURED.description}</p>
      </div>

      <div className="grid gap-5 sm:grid-cols-3 sm:gap-6">
        {FEATURES.map(({ title, description }) => (
          <div
            key={title}
            className="rounded-premium-lg border border-border/80 bg-card p-5 shadow-premium-sm transition-shadow duration-fast hover:shadow-premium-md motion-reduce:transition-none sm:p-6"
          >
            <h3 className="text-premium-h3 font-semibold text-foreground">{title}</h3>
            <p className="mt-2 text-premium-body-sm text-muted-foreground">{description}</p>
          </div>
        ))}
      </div>
    </Section>
  );
}
