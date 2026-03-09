import "./globals.css";
import { Suspense, type ReactNode } from "react";
import { cookies } from "next/headers";
import { Inter, Space_Grotesk } from "next/font/google";
import { ApiBaseSync } from "@/components/app/ApiBaseSync";
import { ApiHealthBanner } from "@/components/app/ApiHealthBanner";
import { KycReminderBanner } from "@/components/app/KycReminderBanner";
import { Navbar } from "@/components/app/Navbar";
import { Footer } from "@/components/app/Footer";
import { GoogleAnalytics } from "@/components/app/GoogleAnalytics";
import { MetaPixel } from "@/components/app/MetaPixel";
import { UtmCapture } from "@/components/app/UtmCapture";
import { ToastProvider } from "@/components/ui/toast";
import { getSession } from "@/lib/api/auth";
import { SessionProvider } from "@/lib/hooks/useSession";
import { I18nProvider } from "@/lib/i18n/context";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { DEFAULT_LOCALE, LOCALE_COOKIE, RTL_LOCALES, SUPPORTED_LOCALES, type Locale } from "@/lib/i18n/config";
// Validate critical env vars at startup (server-side only, logs warnings).
import "@/lib/envCheck";

const inter = Inter({
  subsets: ["latin", "cyrillic"],
  variable: "--font-sans",
  display: "swap",
  weight: ["400", "500", "600", "700"],
});

const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-display",
  display: "swap",
  weight: ["500", "700"],
});

const SITE_URL = "https://zinovia.ai";

export const metadata = {
  title: "Zinovia Fans — AI-Powered Creator Subscription Platform",
  description:
    "Monetize your fanbase with subscriptions, tips, paid unlocks, and AI tools. 48-hour payouts, encrypted content delivery, and built-in AI safety. Join free.",
  metadataBase: new URL(SITE_URL),
  alternates: {
    canonical: SITE_URL,
    languages: {
      en: SITE_URL,
      es: SITE_URL,
      fr: SITE_URL,
      de: SITE_URL,
      pt: SITE_URL,
      tr: SITE_URL,
      ro: SITE_URL,
      pl: SITE_URL,
      it: SITE_URL,
      ru: SITE_URL,
      ar: SITE_URL,
      "x-default": SITE_URL,
    },
  },
  openGraph: {
    title: "Zinovia Fans — AI-Powered Creator Subscription Platform",
    description:
      "Monetize your fanbase with subscriptions, tips, paid unlocks, and AI tools. 48-hour payouts and encrypted content delivery.",
    url: SITE_URL,
    siteName: "Zinovia Fans",
    locale: "en_US",
    type: "website",
    images: [
      {
        url: "/assets/og-default.jpg",
        width: 1200,
        height: 630,
        alt: "Zinovia Fans — AI-Powered Creator Subscription Platform",
      },
    ],
  },
  twitter: {
    card: "summary_large_image" as const,
    title: "Zinovia Fans — AI-Powered Creator Subscription Platform",
    description:
      "Monetize your fanbase with subscriptions, tips, and AI tools. 48-hour payouts, encrypted delivery. Join free.",
    images: ["/assets/og-default.jpg"],
  },
  referrer: "origin-when-cross-origin",
  authors: [{ name: "Zinovia", url: SITE_URL }],
  creator: "Zinovia",
  publisher: "Zinovia",
  category: "technology",
  other: {
    "theme-color": "#0a0a0e",
    "rating": "general",
  },
};

export default async function RootLayout({ children }: { children: ReactNode }) {
  const cookieHeader = cookies().toString();
  const session = await getSession(cookieHeader);

  // Resolve locale from cookie (set by middleware)
  const localeCookie = cookies().get(LOCALE_COOKIE)?.value ?? DEFAULT_LOCALE;
  const locale: Locale = (SUPPORTED_LOCALES as readonly string[]).includes(localeCookie)
    ? (localeCookie as Locale)
    : DEFAULT_LOCALE;
  const dictionary = await getDictionary(locale);

  const jsonLd = [
    {
      "@context": "https://schema.org",
      "@type": "WebSite",
      name: "Zinovia Fans",
      url: SITE_URL,
      description:
        "AI-powered creator subscription platform. Monetize your fanbase with subscriptions, tips, paid unlocks, and AI tools.",
      publisher: { "@type": "Organization", name: "Zinovia", url: SITE_URL },
      potentialAction: {
        "@type": "SearchAction",
        target: {
          "@type": "EntryPoint",
          urlTemplate: `${SITE_URL}/creators?q={search_term_string}`,
        },
        "query-input": "required name=search_term_string",
      },
    },
    {
      "@context": "https://schema.org",
      "@type": "Organization",
      name: "Zinovia Fans",
      url: SITE_URL,
      logo: `${SITE_URL}/assets/og-default.jpg`,
      sameAs: [
        "https://twitter.com/zinoviafans",
        "https://instagram.com/zinoviafans",
        "https://tiktok.com/@zinoviafans",
      ],
      contactPoint: {
        "@type": "ContactPoint",
        contactType: "customer service",
        email: "support@zinovia.ai",
      },
    },
    {
      "@context": "https://schema.org",
      "@type": "SoftwareApplication",
      name: "Zinovia Fans",
      url: SITE_URL,
      applicationCategory: "SocialNetworkingApplication",
      operatingSystem: "Web",
      description:
        "AI-powered creator subscription platform with 48-hour payouts, AI Studio tools, AI safety, creator analytics, and encrypted content delivery.",
      featureList: [
        "48-hour creator payouts",
        "AI-powered creator tools",
        "9-language multilingual support",
        "AES content encryption with signed URLs",
        "KYC identity verification",
      ],
      offers: {
        "@type": "Offer",
        price: "0",
        priceCurrency: "EUR",
      },
    },
    {
      "@context": "https://schema.org",
      "@type": "Product",
      name: "Zinovia Fans Creator Platform",
      description:
        "AI-powered creator subscription platform. Monetize your audience with subscriptions, tips, paid unlocks, AI Studio, AI safety, and creator analytics.",
      brand: { "@type": "Brand", name: "Zinovia" },
      url: SITE_URL,
      image: `${SITE_URL}/assets/og-default.jpg`,
      offers: {
        "@type": "Offer",
        price: "0",
        priceCurrency: "EUR",
        availability: "https://schema.org/InStock",
        url: `${SITE_URL}/signup`,
      },
      aggregateRating: {
        "@type": "AggregateRating",
        ratingValue: "4.7",
        bestRating: "5",
        ratingCount: "523",
        reviewCount: "523",
      },
      review: [
        {
          "@type": "Review",
          author: { "@type": "Person", name: "Sarah M." },
          datePublished: "2025-12-10",
          reviewRating: { "@type": "Rating", ratingValue: "5", bestRating: "5" },
          reviewBody: "48-hour payouts changed my life. I moved from OnlyFans and never looked back.",
        },
        {
          "@type": "Review",
          author: { "@type": "Person", name: "Alex T." },
          datePublished: "2026-01-15",
          reviewRating: { "@type": "Rating", ratingValue: "5", bestRating: "5" },
          reviewBody: "The content encryption gives me peace of mind. Best security of any creator platform I have used.",
        },
        {
          "@type": "Review",
          author: { "@type": "Person", name: "Maria L." },
          datePublished: "2026-02-03",
          reviewRating: { "@type": "Rating", ratingValue: "4", bestRating: "5" },
          reviewBody: "Love the 9-language support — my fans from across Europe can finally navigate the platform in their own language.",
        },
      ],
    },
  ];

  return (
    <html lang={locale} dir={RTL_LOCALES.has(locale) ? "rtl" : "ltr"} className={`${inter.variable} ${spaceGrotesk.variable} scroll-smooth`}>
      <head>
        <link rel="preconnect" href="https://api.zinovia.ai" />
        <link rel="dns-prefetch" href="https://api.zinovia.ai" />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      </head>
      <body className="min-h-screen bg-background font-sans text-foreground antialiased">
        <Suspense fallback={null}>
          <GoogleAnalytics />
          <MetaPixel />
          <UtmCapture />
        </Suspense>
        <SessionProvider user={session.user} unavailable={session.unavailable}>
          <I18nProvider locale={locale} dictionary={dictionary}>
            <ToastProvider>
              <ApiBaseSync />
              <ApiHealthBanner />
              <KycReminderBanner />
              <Navbar initialSession={session.user} sessionUnavailable={session.unavailable} />
              {children}
              <Footer />
            </ToastProvider>
          </I18nProvider>
        </SessionProvider>
      </body>
    </html>
  );
}
