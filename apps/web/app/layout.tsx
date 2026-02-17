import "./globals.css";
import type { ReactNode } from "react";
import { cookies } from "next/headers";
import { Inter, Space_Grotesk } from "next/font/google";
import { ApiBaseSync } from "@/components/app/ApiBaseSync";
import { ApiHealthBanner } from "@/components/app/ApiHealthBanner";
import { Navbar } from "@/components/app/Navbar";
import { Footer } from "@/components/app/Footer";
import { ToastProvider } from "@/components/ui/toast";
import { getSession } from "@/lib/api/auth";
import { I18nProvider } from "@/lib/i18n/context";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { DEFAULT_LOCALE, LOCALE_COOKIE, SUPPORTED_LOCALES, type Locale } from "@/lib/i18n/config";
// Validate critical env vars at startup (server-side only, logs warnings).
import "@/lib/envCheck";

const inter = Inter({
  subsets: ["latin"],
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
  title: "Zinovia Fans — Premium Creator Subscription Platform",
  description:
    "Subscribe to exclusive content from your favourite creators. Secure payouts, Stripe checkout, and private media delivery. For fans and creators.",
  openGraph: {
    title: "Zinovia Fans — Premium Creator Subscription Platform",
    description:
      "Subscribe to exclusive content from your favourite creators. Secure payouts, Stripe checkout, and private media delivery.",
    url: SITE_URL,
    siteName: "Zinovia Fans",
    locale: "en_US",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Zinovia Fans — Premium Creator Subscription Platform",
    description:
      "Subscribe to exclusive content from your favourite creators. Secure payouts and private delivery.",
  },
  metadataBase: new URL(SITE_URL),
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

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: "Zinovia Fans",
    url: SITE_URL,
    description:
      "Subscribe to exclusive content from your favourite creators. Secure payouts, Stripe checkout, and private media delivery.",
    publisher: {
      "@type": "Organization",
      name: "Zinovia",
      url: SITE_URL,
    },
    potentialAction: {
      "@type": "SearchAction",
      target: {
        "@type": "EntryPoint",
        urlTemplate: `${SITE_URL}/creators?q={search_term_string}`,
      },
      "query-input": "required name=search_term_string",
    },
  };

  return (
    <html lang={locale} className={`${inter.variable} ${spaceGrotesk.variable} scroll-smooth`}>
      <head>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      </head>
      <body className="min-h-screen bg-background font-sans text-foreground antialiased">
        <I18nProvider locale={locale} dictionary={dictionary}>
          <ToastProvider>
            <ApiBaseSync />
            <ApiHealthBanner />
            <Navbar initialSession={session.user} sessionUnavailable={session.unavailable} />
            {children}
            <Footer />
          </ToastProvider>
        </I18nProvider>
      </body>
    </html>
  );
}
