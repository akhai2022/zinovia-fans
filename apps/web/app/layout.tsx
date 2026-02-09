import "./globals.css";
import type { ReactNode } from "react";
import { Inter, Sora } from "next/font/google";
import { ApiBaseSync } from "@/components/app/ApiBaseSync";
import { Navbar } from "@/components/app/Navbar";
import { ToastProvider } from "@/components/ui/toast";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
});

const sora = Sora({
  subsets: ["latin"],
  variable: "--font-display",
  display: "swap",
});

export const metadata = {
  title: "Zinovia Fans",
  description: "Creator subscription platform",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} ${sora.variable}`}>
      <body className="min-h-screen bg-background font-sans text-foreground antialiased">
        <ToastProvider>
          <ApiBaseSync />
          <Navbar />
          {children}
        </ToastProvider>
      </body>
    </html>
  );
}
