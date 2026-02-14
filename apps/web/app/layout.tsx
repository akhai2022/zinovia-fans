import "./globals.css";
import type { ReactNode } from "react";
import { cookies } from "next/headers";
import { ApiBaseSync } from "@/components/app/ApiBaseSync";
import { ApiHealthBanner } from "@/components/app/ApiHealthBanner";
import { Navbar } from "@/components/app/Navbar";
import { Footer } from "@/components/app/Footer";
import { ToastProvider } from "@/components/ui/toast";
import { getSession } from "@/lib/api/auth";
// Validate critical env vars at startup (server-side only, logs warnings).
import "@/lib/envCheck";

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
  return (
    <html lang="en" className="scroll-smooth">
      <body className="min-h-screen bg-background font-sans text-foreground antialiased">
        <ToastProvider>
          <ApiBaseSync />
          <ApiHealthBanner />
          <Navbar initialSession={session.user} sessionUnavailable={session.unavailable} />
          {children}
          <Footer />
        </ToastProvider>
      </body>
    </html>
  );
}
