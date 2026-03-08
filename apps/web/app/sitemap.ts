import type { MetadataRoute } from "next";

const SITE_URL = "https://zinovia.ai";

const LOCALES = ["en", "es", "fr", "de", "pt", "tr", "ro", "pl", "it"] as const;

type SitemapCreator = {
  handle: string;
  updated_at: string;
};

async function fetchCreatorsForSitemap(): Promise<SitemapCreator[]> {
  try {
    const apiBase = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8000";
    const res = await fetch(`${apiBase}/creators/sitemap`, {
      next: { revalidate: 3600 },
    });
    if (!res.ok) return [];
    return (await res.json()) as SitemapCreator[];
  } catch {
    return [];
  }
}

/** Build hreflang alternates object — all locales point to the same URL (cookie-based i18n). */
function alternates(url: string): { languages: Record<string, string> } {
  const languages: Record<string, string> = {};
  for (const locale of LOCALES) {
    languages[locale] = url;
  }
  languages["x-default"] = url;
  return { languages };
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const creators = await fetchCreatorsForSitemap();

  const now = new Date();

  const staticPages: MetadataRoute.Sitemap = [
    // Core pages
    { url: SITE_URL, lastModified: now, changeFrequency: "weekly", priority: 1, alternates: alternates(SITE_URL) },
    { url: `${SITE_URL}/creators`, lastModified: now, changeFrequency: "daily", priority: 0.9, alternates: alternates(`${SITE_URL}/creators`) },
    { url: `${SITE_URL}/pricing`, lastModified: now, changeFrequency: "monthly", priority: 0.8, alternates: alternates(`${SITE_URL}/pricing`) },
    { url: `${SITE_URL}/about`, lastModified: now, changeFrequency: "monthly", priority: 0.7, alternates: alternates(`${SITE_URL}/about`) },
    { url: `${SITE_URL}/how-it-works`, lastModified: now, changeFrequency: "monthly", priority: 0.7, alternates: alternates(`${SITE_URL}/how-it-works`) },
    { url: `${SITE_URL}/help`, lastModified: now, changeFrequency: "monthly", priority: 0.4, alternates: alternates(`${SITE_URL}/help`) },
    { url: `${SITE_URL}/contact`, lastModified: now, changeFrequency: "monthly", priority: 0.4, alternates: alternates(`${SITE_URL}/contact`) },
    { url: `${SITE_URL}/privacy`, lastModified: now, changeFrequency: "monthly", priority: 0.3, alternates: alternates(`${SITE_URL}/privacy`) },
    { url: `${SITE_URL}/terms`, lastModified: now, changeFrequency: "monthly", priority: 0.3, alternates: alternates(`${SITE_URL}/terms`) },
    // Comparison pages
    { url: `${SITE_URL}/compare`, lastModified: now, changeFrequency: "monthly", priority: 0.7, alternates: alternates(`${SITE_URL}/compare`) },
    { url: `${SITE_URL}/compare/patreon`, lastModified: now, changeFrequency: "monthly", priority: 0.7, alternates: alternates(`${SITE_URL}/compare/patreon`) },
    { url: `${SITE_URL}/compare/onlyfans`, lastModified: now, changeFrequency: "monthly", priority: 0.7, alternates: alternates(`${SITE_URL}/compare/onlyfans`) },
    { url: `${SITE_URL}/compare/fanvue`, lastModified: now, changeFrequency: "monthly", priority: 0.7, alternates: alternates(`${SITE_URL}/compare/fanvue`) },
    { url: `${SITE_URL}/compare/fansly`, lastModified: now, changeFrequency: "monthly", priority: 0.7, alternates: alternates(`${SITE_URL}/compare/fansly`) },
    { url: `${SITE_URL}/compare/passes`, lastModified: now, changeFrequency: "monthly", priority: 0.7, alternates: alternates(`${SITE_URL}/compare/passes`) },
    { url: `${SITE_URL}/compare/loyalfans`, lastModified: now, changeFrequency: "monthly", priority: 0.7, alternates: alternates(`${SITE_URL}/compare/loyalfans`) },
    { url: `${SITE_URL}/compare/ko-fi`, lastModified: now, changeFrequency: "monthly", priority: 0.7, alternates: alternates(`${SITE_URL}/compare/ko-fi`) },
    { url: `${SITE_URL}/compare/gumroad`, lastModified: now, changeFrequency: "monthly", priority: 0.7, alternates: alternates(`${SITE_URL}/compare/gumroad`) },
    { url: `${SITE_URL}/compare/fanfix`, lastModified: now, changeFrequency: "monthly", priority: 0.7, alternates: alternates(`${SITE_URL}/compare/fanfix`) },
    { url: `${SITE_URL}/compare/unfiltrd`, lastModified: now, changeFrequency: "monthly", priority: 0.7, alternates: alternates(`${SITE_URL}/compare/unfiltrd`) },
    { url: `${SITE_URL}/compare/mym`, lastModified: now, changeFrequency: "monthly", priority: 0.7, alternates: alternates(`${SITE_URL}/compare/mym`) },
    { url: `${SITE_URL}/compare/scrile-connect`, lastModified: now, changeFrequency: "monthly", priority: 0.7, alternates: alternates(`${SITE_URL}/compare/scrile-connect`) },
    { url: `${SITE_URL}/compare/fourthwall`, lastModified: now, changeFrequency: "monthly", priority: 0.7, alternates: alternates(`${SITE_URL}/compare/fourthwall`) },
    // Feature pages
    { url: `${SITE_URL}/features/subscriptions`, lastModified: now, changeFrequency: "monthly", priority: 0.6, alternates: alternates(`${SITE_URL}/features/subscriptions`) },
    { url: `${SITE_URL}/features/payouts`, lastModified: now, changeFrequency: "monthly", priority: 0.6, alternates: alternates(`${SITE_URL}/features/payouts`) },
    { url: `${SITE_URL}/features/messaging`, lastModified: now, changeFrequency: "monthly", priority: 0.6, alternates: alternates(`${SITE_URL}/features/messaging`) },
    { url: `${SITE_URL}/features/paid-content`, lastModified: now, changeFrequency: "monthly", priority: 0.6, alternates: alternates(`${SITE_URL}/features/paid-content`) },
    { url: `${SITE_URL}/features/ai-tools`, lastModified: now, changeFrequency: "monthly", priority: 0.6, alternates: alternates(`${SITE_URL}/features/ai-tools`) },
    { url: `${SITE_URL}/features/content-security`, lastModified: now, changeFrequency: "monthly", priority: 0.6, alternates: alternates(`${SITE_URL}/features/content-security`) },
    { url: `${SITE_URL}/features/analytics`, lastModified: now, changeFrequency: "monthly", priority: 0.6, alternates: alternates(`${SITE_URL}/features/analytics`) },
    // Standalone feature pages
    { url: `${SITE_URL}/fast-payouts`, lastModified: now, changeFrequency: "monthly", priority: 0.7, alternates: alternates(`${SITE_URL}/fast-payouts`) },
    { url: `${SITE_URL}/content-protection`, lastModified: now, changeFrequency: "monthly", priority: 0.7, alternates: alternates(`${SITE_URL}/content-protection`) },
    // AI Studio & AI tools
    { url: `${SITE_URL}/ai`, lastModified: now, changeFrequency: "monthly", priority: 0.7, alternates: alternates(`${SITE_URL}/ai`) },
    { url: `${SITE_URL}/ai/tools/remove-bg`, lastModified: now, changeFrequency: "monthly", priority: 0.5, alternates: alternates(`${SITE_URL}/ai/tools/remove-bg`) },
    { url: `${SITE_URL}/ai/tools/cartoon-avatar`, lastModified: now, changeFrequency: "monthly", priority: 0.5, alternates: alternates(`${SITE_URL}/ai/tools/cartoon-avatar`) },
    { url: `${SITE_URL}/ai/tools/animate-image`, lastModified: now, changeFrequency: "monthly", priority: 0.5, alternates: alternates(`${SITE_URL}/ai/tools/animate-image`) },
    { url: `${SITE_URL}/ai/tools/auto-caption`, lastModified: now, changeFrequency: "monthly", priority: 0.5, alternates: alternates(`${SITE_URL}/ai/tools/auto-caption`) },
    // Auth pages (indexable)
    { url: `${SITE_URL}/signup`, lastModified: now, changeFrequency: "monthly", priority: 0.8, alternates: alternates(`${SITE_URL}/signup`) },
    // Features hub
    { url: `${SITE_URL}/features`, lastModified: now, changeFrequency: "monthly", priority: 0.7, alternates: alternates(`${SITE_URL}/features`) },
    // Alternatives section
    { url: `${SITE_URL}/alternatives`, lastModified: now, changeFrequency: "monthly", priority: 0.7, alternates: alternates(`${SITE_URL}/alternatives`) },
    { url: `${SITE_URL}/alternatives/onlyfans-alternatives`, lastModified: now, changeFrequency: "monthly", priority: 0.7, alternates: alternates(`${SITE_URL}/alternatives/onlyfans-alternatives`) },
    { url: `${SITE_URL}/alternatives/patreon-alternatives`, lastModified: now, changeFrequency: "monthly", priority: 0.7, alternates: alternates(`${SITE_URL}/alternatives/patreon-alternatives`) },
    { url: `${SITE_URL}/alternatives/creator-platforms`, lastModified: now, changeFrequency: "monthly", priority: 0.7, alternates: alternates(`${SITE_URL}/alternatives/creator-platforms`) },
    // Guides section
    { url: `${SITE_URL}/guides`, lastModified: now, changeFrequency: "monthly", priority: 0.6, alternates: alternates(`${SITE_URL}/guides`) },
    { url: `${SITE_URL}/guides/ai-tools-for-creators`, lastModified: now, changeFrequency: "monthly", priority: 0.6, alternates: alternates(`${SITE_URL}/guides/ai-tools-for-creators`) },
    { url: `${SITE_URL}/guides/creator-platform-fees-compared`, lastModified: now, changeFrequency: "monthly", priority: 0.6, alternates: alternates(`${SITE_URL}/guides/creator-platform-fees-compared`) },
    { url: `${SITE_URL}/guides/content-protection-for-creators`, lastModified: now, changeFrequency: "monthly", priority: 0.6, alternates: alternates(`${SITE_URL}/guides/content-protection-for-creators`) },
    { url: `${SITE_URL}/guides/how-to-start-earning-as-creator`, lastModified: now, changeFrequency: "monthly", priority: 0.6, alternates: alternates(`${SITE_URL}/guides/how-to-start-earning-as-creator`) },
    { url: `${SITE_URL}/guides/european-creator-platforms`, lastModified: now, changeFrequency: "monthly", priority: 0.6, alternates: alternates(`${SITE_URL}/guides/european-creator-platforms`) },
    // Niche landing pages
    { url: `${SITE_URL}/for/fitness-creators`, lastModified: now, changeFrequency: "monthly", priority: 0.6, alternates: alternates(`${SITE_URL}/for/fitness-creators`) },
    { url: `${SITE_URL}/for/musicians`, lastModified: now, changeFrequency: "monthly", priority: 0.6, alternates: alternates(`${SITE_URL}/for/musicians`) },
    { url: `${SITE_URL}/for/podcasters`, lastModified: now, changeFrequency: "monthly", priority: 0.6, alternates: alternates(`${SITE_URL}/for/podcasters`) },
    { url: `${SITE_URL}/for/artists`, lastModified: now, changeFrequency: "monthly", priority: 0.6, alternates: alternates(`${SITE_URL}/for/artists`) },
    { url: `${SITE_URL}/for/cosplayers`, lastModified: now, changeFrequency: "monthly", priority: 0.6, alternates: alternates(`${SITE_URL}/for/cosplayers`) },
    { url: `${SITE_URL}/for/writers`, lastModified: now, changeFrequency: "monthly", priority: 0.6, alternates: alternates(`${SITE_URL}/for/writers`) },
    { url: `${SITE_URL}/for/educators`, lastModified: now, changeFrequency: "monthly", priority: 0.6, alternates: alternates(`${SITE_URL}/for/educators`) },
    { url: `${SITE_URL}/for/fashion-creators`, lastModified: now, changeFrequency: "monthly", priority: 0.6, alternates: alternates(`${SITE_URL}/for/fashion-creators`) },
    { url: `${SITE_URL}/for/travel-creators`, lastModified: now, changeFrequency: "monthly", priority: 0.6, alternates: alternates(`${SITE_URL}/for/travel-creators`) },
    { url: `${SITE_URL}/for/gen-z-creators`, lastModified: now, changeFrequency: "monthly", priority: 0.6, alternates: alternates(`${SITE_URL}/for/gen-z-creators`) },
    { url: `${SITE_URL}/for/lifestyle-creators`, lastModified: now, changeFrequency: "monthly", priority: 0.6, alternates: alternates(`${SITE_URL}/for/lifestyle-creators`) },
  ];

  const creatorPages: MetadataRoute.Sitemap = creators.map((c) => {
    const url = `${SITE_URL}/creators/${c.handle}`;
    return {
      url,
      lastModified: new Date(c.updated_at),
      changeFrequency: "weekly" as const,
      priority: 0.8,
      alternates: alternates(url),
    };
  });

  return [...staticPages, ...creatorPages];
}
