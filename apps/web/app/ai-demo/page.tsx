import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ScrollReveal } from "@/components/landing/ScrollReveal";

function DemoCard({
  step,
  title,
  description,
  items,
}: {
  step: string;
  title: string;
  description: string;
  items: { label: string; detail: string }[];
}) {
  return (
    <div className="rounded-2xl border border-white/[0.06] bg-card p-6 sm:p-8">
      <div className="flex items-center gap-3 mb-4">
        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
          {step}
        </span>
        <h3 className="text-lg font-semibold text-foreground">{title}</h3>
      </div>
      <p className="text-sm text-muted-foreground mb-6">{description}</p>

      {/* Mock output area */}
      <div className="space-y-3">
        {items.map(({ label, detail }) => (
          <div
            key={label}
            className="flex items-start gap-3 rounded-xl border border-white/[0.04] bg-surface-alt p-4"
          >
            <div className="mt-0.5 h-2 w-2 shrink-0 rounded-full bg-primary" />
            <div>
              <p className="text-sm font-medium text-foreground">{label}</p>
              <p className="mt-0.5 text-xs text-muted-foreground">{detail}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function AIDemoPage() {
  return (
    <main className="hero-bg">
      {/* Hero */}
      <section className="mx-auto w-full max-w-4xl px-4 pt-24 pb-12 text-center sm:px-6">
        <ScrollReveal>
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
                d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z"
              />
            </svg>
            <span className="text-xs font-medium text-primary">AI Demo</span>
          </div>
          <h1 className="font-display text-3xl font-bold text-foreground sm:text-4xl">
            See AI in action
          </h1>
          <p className="mx-auto mt-4 max-w-lg text-muted-foreground">
            Here&apos;s how Zinovia&apos;s AI tools work behind the scenes — from upload to
            publish. Everything runs on CPU, on our servers, with zero external APIs.
          </p>
        </ScrollReveal>
      </section>

      {/* Demo sections */}
      <section className="mx-auto w-full max-w-4xl space-y-8 px-4 pb-12 sm:px-6">
        <ScrollReveal>
          <DemoCard
            step="1"
            title="Smart Previews"
            description="When you upload an image, AI generates multiple preview variants in the background."
            items={[
              {
                label: "Thumbnail (200px)",
                detail: "Smart-cropped square using face detection and saliency analysis",
              },
              {
                label: "Grid preview (600px)",
                detail: "Optimized for feed display with optional watermark footer",
              },
              {
                label: "Blur teaser",
                detail: "Gaussian blur + noise for PPV locked content — prevents reverse-engineering",
              },
              {
                label: "Aspect crops (1:1, 4:5, 16:9)",
                detail: "Attention-aware crops for Instagram, stories, and YouTube thumbnails",
              },
            ]}
          />
        </ScrollReveal>

        <ScrollReveal>
          <DemoCard
            step="2"
            title="Captions & Promo Copy"
            description="AI generates caption suggestions and promotional copy in three tone styles."
            items={[
              {
                label: "Short caption",
                detail: '"Stunning sunset over the rooftops — golden hour magic."',
              },
              {
                label: "Medium caption",
                detail: '"Caught this incredible sunset from the rooftop last evening. The way the light painted everything gold was unforgettable."',
              },
              {
                label: "Professional promo",
                detail: '"Exclusive: Sunset Content — Premium golden hour photography crafted for my most loyal subscribers."',
              },
              {
                label: "Hashtags",
                detail: "#sunset #goldenhour #exclusive #subscribers #premium #contentcreator #rooftop #photography #newcontent #trending",
              },
            ]}
          />
        </ScrollReveal>

        <ScrollReveal>
          <DemoCard
            step="3"
            title="Auto-Translate"
            description="Captions are translated into French and Spanish automatically via offline AI models."
            items={[
              {
                label: "Original (English)",
                detail: '"Golden hour from the rooftop — exclusive content for my subscribers."',
              },
              {
                label: "French",
                detail: '"L\'heure dorée depuis le toit — contenu exclusif pour mes abonnés."',
              },
              {
                label: "Spanish",
                detail: '"La hora dorada desde la azotea — contenido exclusivo para mis suscriptores."',
              },
            ]}
          />
        </ScrollReveal>
      </section>

      {/* CTA */}
      <ScrollReveal>
        <section className="mx-auto w-full max-w-4xl px-4 pb-24 text-center sm:px-6">
          <h2 className="font-display text-2xl font-bold text-foreground sm:text-3xl">
            Try it yourself
          </h2>
          <p className="mx-auto mt-4 max-w-md text-muted-foreground">
            Sign up free and start using AI tools with your first upload.
            No credit card required.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-4">
            <Button size="lg" className="btn-cta-primary h-12 px-8 text-base" asChild>
              <Link href="/signup">Sign up free</Link>
            </Button>
            <Button size="lg" variant="secondary" className="h-12 px-8 text-base" asChild>
              <Link href="/">Back to home</Link>
            </Button>
          </div>
        </section>
      </ScrollReveal>
    </main>
  );
}
