import Link from "next/link";
import { Page } from "@/components/brand/Page";

const SITE_URL = "https://zinovia.ai";

export const metadata = {
  title: "Compare Zinovia vs Other Platforms — Creator Platform Comparison",
  description: "See how Zinovia compares to Patreon, OnlyFans, Fanvue, Fansly and more. Fees, payouts, features — all side by side.",
  alternates: { canonical: `${SITE_URL}/compare` },
  openGraph: {
    title: "Compare Zinovia vs Other Platforms",
    description: "See how Zinovia compares to Patreon, OnlyFans, Fanvue, Fansly and more.",
    url: `${SITE_URL}/compare`,
    siteName: "Zinovia Fans",
  },
};

const COMPARISONS = [
  { slug: "patreon", name: "Patreon", tagline: "Lower fees, faster payouts, private content delivery" },
  { slug: "onlyfans", name: "OnlyFans", tagline: "Better creator tools, multilingual, secure global payments" },
  { slug: "fanvue", name: "Fanvue", tagline: "More features, global reach, transparent pricing" },
  { slug: "fansly", name: "Fansly", tagline: "Built-in messaging, analytics, and verified creator profiles" },
];

export default function ComparePage() {
  return (
    <Page className="max-w-4xl space-y-10 py-12">
      <header className="text-center space-y-3">
        <h1 className="font-display text-premium-h2 font-bold text-foreground">
          How Zinovia Compares
        </h1>
        <p className="mx-auto max-w-xl text-muted-foreground">
          Transparent, side-by-side comparisons so you can choose the right platform for your content.
        </p>
      </header>

      <section className="grid gap-4 sm:grid-cols-2">
        {COMPARISONS.map((c) => (
          <Link
            key={c.slug}
            href={`/compare/${c.slug}`}
            className="group rounded-2xl border border-white/[0.06] bg-card p-6 transition-colors hover:border-white/[0.12]"
          >
            <h2 className="font-display text-lg font-semibold text-foreground group-hover:text-gradient-brand">
              Zinovia vs {c.name}
            </h2>
            <p className="mt-2 text-sm text-muted-foreground">{c.tagline}</p>
            <span className="mt-4 inline-block text-sm font-medium text-primary">
              View comparison &rarr;
            </span>
          </Link>
        ))}
      </section>
    </Page>
  );
}
