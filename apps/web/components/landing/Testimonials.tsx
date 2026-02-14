import { Card } from "@/components/ui/card";

const TESTIMONIALS = [
  {
    quote: "Zinovia made it easy to go from posting to getting paid. Payouts are on time, every time.",
    author: "Alex",
    role: "Creator",
  },
  {
    quote: "Finally a platform that feels premium. My subscribers love the exclusive feed and DMs.",
    author: "Jordan",
    role: "Creator",
  },
  {
    quote: "I support a few creators here. The checkout is smooth and I always know what I'm paying for.",
    author: "Sam",
    role: "Fan",
  },
];

export function Testimonials() {
  return (
    <section className="mx-auto w-full max-w-6xl px-4 py-12 sm:px-6 md:py-16" aria-labelledby="testimonials-heading">
      <h2 id="testimonials-heading" className="font-display text-premium-h2 font-semibold text-foreground">
        What people say
      </h2>
      <div className="mt-8 grid gap-6 md:grid-cols-3">
        {TESTIMONIALS.map(({ quote, author, role }) => (
          <Card
            key={author}
            className="card-hover-lift flex flex-col rounded-2xl border border-white/10 p-6 shadow-premium-md"
          >
            <p className="flex-1 text-premium-body text-muted-foreground">&ldquo;{quote}&rdquo;</p>
            <p className="mt-4 font-medium text-foreground">{author}</p>
            <p className="text-sm text-muted-foreground">{role}</p>
          </Card>
        ))}
      </div>
    </section>
  );
}
