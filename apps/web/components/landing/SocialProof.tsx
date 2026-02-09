import { Section } from "./Section";
import { TestimonialAvatar } from "./TestimonialAvatar";
import { DEMO_ASSETS } from "@/lib/demoAssets";

export function SocialProof() {
  return (
    <Section id="social-proof" title="Built for real creators" tone="muted" aria-labelledby="social-heading">
      <div className="rounded-premium-xl border border-border/80 bg-card p-5 shadow-premium-sm sm:p-7">
        <blockquote className="text-premium-body text-foreground">
          &ldquo;Finally a platform that pays on time.&rdquo;
        </blockquote>
        <p className="mt-4 text-premium-body-sm text-muted-foreground">
          Join creators who&apos;ve already received payouts. We process payouts regularly so you can focus on your content.
        </p>
      </div>

      <div className="mt-6 grid gap-5 sm:grid-cols-2 sm:gap-6">
        <TestimonialCard
          quote="Short quote about payouts or ease of use. Replace with real creator testimonial."
          name="Creator name"
          role="Creator · Category"
          avatarSrc={DEMO_ASSETS.avatar[256]}
        />
        <TestimonialCard
          quote="Another quote. Structure ready for real testimonials when available."
          name="Creator name"
          role="Creator · Category"
          avatarSrc={DEMO_ASSETS.avatar[512]}
        />
      </div>
    </Section>
  );
}

function TestimonialCard({
  quote,
  name,
  role,
  avatarSrc,
}: {
  quote: string;
  name: string;
  role: string;
  avatarSrc: string | undefined;
}) {
  return (
    <div className="rounded-premium-lg border border-border/80 bg-card p-5 shadow-premium-sm transition-shadow duration-fast hover:shadow-premium-md motion-reduce:transition-none sm:p-6">
      <p className="text-premium-body-sm text-foreground">{quote}</p>
      <div className="mt-4 flex items-center gap-3">
        <TestimonialAvatar src={avatarSrc} name={name} />
        <div>
          <p className="text-premium-body-sm font-medium text-foreground">{name}</p>
          <p className="text-premium-small text-muted-foreground">{role}</p>
        </div>
      </div>
    </div>
  );
}
