import Link from "next/link";
import { Page } from "@/components/brand/Page";
import { Button } from "@/components/ui/button";
import { Breadcrumbs } from "@/components/seo/Breadcrumbs";

const SITE_URL = "https://zinovia.ai";

export const metadata = {
  title: "Content Protection for Creators — Signed URLs, Encryption & DMCA | Zinovia",
  description: "Protect your creator content with Zinovia's 5-layer security: signed URLs, AES-256 encryption, invisible watermarking, automated DMCA takedowns, and age gating. Compare content protection across OnlyFans, Patreon, Fansly, and FanVue.",
  alternates: { canonical: `${SITE_URL}/content-protection` },
  openGraph: {
    title: "Content Protection for Creators — Signed URLs, Encryption & DMCA | Zinovia",
    description: "Protect your creator content with Zinovia's 5-layer security: signed URLs, AES-256 encryption, invisible watermarking, automated DMCA takedowns, and age gating.",
    url: `${SITE_URL}/content-protection`,
    siteName: "Zinovia Fans",
  },
};

const PROTECTION_COMPARISON = [
  { platform: "Zinovia",  signedUrls: true,  aesEncryption: true,  watermarking: true,  dmcaSupport: true,  ageGating: true,  highlight: true },
  { platform: "OnlyFans", signedUrls: true,  aesEncryption: false, watermarking: true,  dmcaSupport: true,  ageGating: true,  highlight: false },
  { platform: "Patreon",  signedUrls: false, aesEncryption: false, watermarking: false, dmcaSupport: true,  ageGating: false, highlight: false },
  { platform: "Fansly",   signedUrls: true,  aesEncryption: false, watermarking: true,  dmcaSupport: true,  ageGating: true,  highlight: false },
  { platform: "FanVue",   signedUrls: false, aesEncryption: false, watermarking: false, dmcaSupport: true,  ageGating: true,  highlight: false },
];

const SECURITY_LAYERS = [
  {
    step: "01",
    title: "Signed URLs",
    description: "Every media file is served through time-limited, cryptographically signed URLs. Links expire within minutes, making it impossible to share direct download links or scrape content from your profile. Even if a URL is copied, it becomes invalid almost immediately.",
    icon: "M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1",
  },
  {
    step: "02",
    title: "AES-256 Encryption",
    description: "All content is encrypted at rest and in transit using AES-256, the same standard used by banks and governments. Your photos, videos, and messages are encrypted before they ever touch our servers, and decrypted only when viewed by a paying subscriber in their browser.",
    icon: "M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z",
  },
  {
    step: "03",
    title: "Invisible Watermarking",
    description: "Every piece of content served to a subscriber is invisibly watermarked with their unique account identifier. If your content is leaked, Zinovia can trace it back to the exact subscriber who captured it, enabling you to take action and protect your work.",
    icon: "M15 12a3 3 0 11-6 0 3 3 0 016 0z M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z",
  },
  {
    step: "04",
    title: "DMCA Takedown Support",
    description: "If your content appears on an unauthorized site, Zinovia's dedicated team handles DMCA takedown requests on your behalf. We monitor for leaks, file takedown notices, and work with hosting providers to get stolen content removed quickly.",
    icon: "M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z",
  },
  {
    step: "05",
    title: "Age Gating",
    description: "Zinovia enforces strict age verification for all users before they can access any creator content. This protects you legally, keeps your audience compliant with platform policies, and ensures minors never see age-restricted material.",
    icon: "M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z",
  },
];

const CONTENT_PROTECTION_FAQS = [
  {
    q: "How does Zinovia protect my content from being leaked?",
    a: "Zinovia uses a 5-layer security system: signed URLs that expire within minutes, AES-256 encryption for all media at rest and in transit, invisible watermarking tied to each subscriber, automated DMCA takedown support, and strict age gating. Together, these layers make it extremely difficult for anyone to steal or redistribute your content.",
  },
  {
    q: "What are signed URLs and why do they matter?",
    a: "Signed URLs are time-limited, cryptographically generated links that grant temporary access to your media files. Unlike permanent URLs, they expire within minutes, so even if someone copies a link, it stops working almost immediately. This prevents link sharing, scraping, and unauthorized downloads.",
  },
  {
    q: "Can Zinovia trace leaked content back to a subscriber?",
    a: "Yes. Every piece of content served on Zinovia is invisibly watermarked with the viewing subscriber's unique identifier. If your content appears on an unauthorized site, we can trace it back to the exact account that captured it, allowing you to take appropriate action.",
  },
  {
    q: "Does Zinovia handle DMCA takedowns for creators?",
    a: "Yes. Zinovia has a dedicated team that handles DMCA takedown requests on behalf of creators. When leaked content is identified, we file takedown notices with hosting providers and work to get the content removed as quickly as possible. You do not need to navigate the legal process alone.",
  },
  {
    q: "How does Zinovia's content protection compare to OnlyFans?",
    a: "Zinovia offers stronger protection than OnlyFans in several areas. Both platforms use signed URLs, watermarking, DMCA support, and age gating. However, Zinovia adds AES-256 encryption for all content at rest and in transit, which OnlyFans does not provide. This means your files are encrypted on our servers, not just protected by access controls.",
  },
  {
    q: "Is age verification mandatory on Zinovia?",
    a: "Yes. All users must complete age verification before they can access any creator content on Zinovia. This is enforced at the platform level, not on a per-creator basis, so you never have to worry about minors accessing your work. It also helps protect you legally in jurisdictions that require age gating for certain content types.",
  },
];

export default function ContentProtectionPage() {
  const faqJsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: CONTENT_PROTECTION_FAQS.map(({ q, a }) => ({
      "@type": "Question",
      name: q,
      acceptedAnswer: { "@type": "Answer", text: a },
    })),
  };

  return (
    <Page className="max-w-4xl space-y-12 py-12">
      <Breadcrumbs items={[{ label: "Content Protection" }]} />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }}
      />

      {/* Hero */}
      <header className="text-center space-y-4">
        <h1 className="font-display text-premium-h2 font-bold text-foreground">
          Your content,{" "}
          <span className="text-gradient-brand">fully protected</span>
        </h1>
        <p className="mx-auto max-w-xl text-muted-foreground">
          Zinovia wraps every piece of your content in 5 layers of security — signed URLs, AES-256 encryption, invisible watermarking, DMCA takedown support, and age gating — so you can create with confidence.
        </p>
        <div className="mx-auto flex max-w-md items-center justify-center gap-4 pt-4">
          <div className="flex-1 rounded-xl border-2 border-primary/50 bg-card p-4 text-center">
            <p className="text-xs font-medium text-primary">Zinovia</p>
            <p className="mt-1 font-display text-2xl font-bold text-foreground">5 layers</p>
          </div>
          <div className="text-muted-foreground text-sm font-medium">vs</div>
          <div className="flex-1 rounded-xl border border-white/[0.06] bg-card p-4 text-center">
            <p className="text-xs font-medium text-muted-foreground">Others</p>
            <p className="mt-1 font-display text-2xl font-bold text-muted-foreground">1&ndash;3 layers</p>
          </div>
        </div>
      </header>

      {/* Protection Comparison Table */}
      <section className="space-y-4">
        <h2 className="font-display text-xl font-semibold text-foreground text-center">Content protection comparison</h2>
        <p className="text-center text-sm text-muted-foreground">See which platforms actually protect your work.</p>
        <div className="overflow-x-auto rounded-2xl border border-white/[0.06]">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/[0.06] bg-card">
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Platform</th>
                <th className="px-4 py-3 text-center font-medium text-muted-foreground">Signed URLs</th>
                <th className="px-4 py-3 text-center font-medium text-muted-foreground">AES Encryption</th>
                <th className="px-4 py-3 text-center font-medium text-muted-foreground">Watermarking</th>
                <th className="px-4 py-3 text-center font-medium text-muted-foreground">DMCA Support</th>
                <th className="px-4 py-3 text-center font-medium text-muted-foreground">Age Gating</th>
              </tr>
            </thead>
            <tbody>
              {PROTECTION_COMPARISON.map((row, i) => (
                <tr
                  key={row.platform}
                  className={`${i % 2 === 0 ? "bg-background" : "bg-card"} ${row.highlight ? "font-medium text-foreground" : "text-muted-foreground"}`}
                >
                  <td className="px-4 py-3">
                    {row.platform}
                    {row.highlight && <span className="ml-2 text-xs text-primary">(You are here)</span>}
                  </td>
                  <td className="px-4 py-3 text-center">{row.signedUrls ? <Check highlight={row.highlight} /> : <Cross />}</td>
                  <td className="px-4 py-3 text-center">{row.aesEncryption ? <Check highlight={row.highlight} /> : <Cross />}</td>
                  <td className="px-4 py-3 text-center">{row.watermarking ? <Check highlight={row.highlight} /> : <Cross />}</td>
                  <td className="px-4 py-3 text-center">{row.dmcaSupport ? <Check highlight={row.highlight} /> : <Cross />}</td>
                  <td className="px-4 py-3 text-center">{row.ageGating ? <Check highlight={row.highlight} /> : <Cross />}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Security Layers */}
      <section className="space-y-6">
        <div className="text-center">
          <h2 className="font-display text-xl font-semibold text-foreground">5 layers of content security</h2>
          <p className="mt-2 text-muted-foreground">Every layer works together to keep your content safe.</p>
        </div>
        {SECURITY_LAYERS.map(({ step, title, description, icon }) => (
          <div key={step} className="rounded-2xl border border-white/[0.06] bg-card p-8">
            <div className="flex items-start gap-6">
              <div className="shrink-0 flex flex-col items-center gap-2">
                <span className="text-gradient-brand text-5xl font-bold">{step}</span>
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5} aria-hidden>
                    <path strokeLinecap="round" strokeLinejoin="round" d={icon} />
                  </svg>
                </div>
              </div>
              <div className="space-y-2">
                <h3 className="font-display text-lg font-semibold text-foreground">{title}</h3>
                <p className="text-sm leading-relaxed text-muted-foreground">{description}</p>
              </div>
            </div>
          </div>
        ))}
      </section>

      {/* FAQ */}
      <section className="space-y-4">
        <h2 className="font-display text-xl font-semibold text-foreground">Frequently Asked Questions</h2>
        <div className="divide-y divide-white/[0.06]">
          {CONTENT_PROTECTION_FAQS.map(({ q, a }) => (
            <details key={q} className="group py-5">
              <summary className="flex cursor-pointer items-center justify-between text-sm font-medium text-foreground">
                {q}
                <svg className="h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200 group-open:rotate-45" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                </svg>
              </summary>
              <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{a}</p>
            </details>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="rounded-2xl border border-white/[0.06] bg-card p-8 text-center">
        <h2 className="font-display text-xl font-bold text-foreground">Protect your content today</h2>
        <p className="mx-auto mt-3 max-w-lg text-sm text-muted-foreground">
          Join Zinovia and get 5-layer content protection out of the box. Signed URLs, encryption, watermarking, DMCA support, and age gating — all included, no extra cost.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-4">
          <Button size="lg" className="btn-cta-primary h-12 px-8 text-base" asChild>
            <Link href="/signup">Get started free</Link>
          </Button>
          <Button size="lg" variant="secondary" className="h-12 px-8 text-base" asChild>
            <Link href="/pricing">View pricing</Link>
          </Button>
        </div>
      </section>
    </Page>
  );
}

function Check({ highlight }: { highlight: boolean }) {
  return (
    <span className={`inline-flex items-center justify-center rounded-full ${highlight ? "bg-primary/10 text-primary" : "text-muted-foreground"} h-6 w-6`}>
      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5} aria-hidden>
        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
      </svg>
    </span>
  );
}

function Cross() {
  return (
    <span className="inline-flex items-center justify-center text-muted-foreground/40 h-6 w-6">
      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden>
        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
      </svg>
    </span>
  );
}
