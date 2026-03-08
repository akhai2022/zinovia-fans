import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "Log In — Zinovia Fans",
  description:
    "Sign in to your Zinovia Fans account. Access your subscriptions, messages, and creator dashboard.",
  robots: { index: false, follow: true },
  alternates: { canonical: "https://zinovia.ai/login" },
};

export default function LoginLayout({ children }: { children: ReactNode }) {
  return children;
}
