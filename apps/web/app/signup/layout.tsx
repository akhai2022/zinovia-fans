import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "Sign Up — Join Zinovia Fans as a Creator or Fan",
  description:
    "Create your Zinovia Fans account. Join as a creator to monetize your fanbase with subscriptions, tips, and AI tools — or sign up as a fan to support your favourite creators.",
  alternates: { canonical: "https://zinovia.ai/signup" },
  openGraph: {
    title: "Sign Up — Join Zinovia Fans",
    description:
      "Create your account. Monetize your fanbase with subscriptions, tips, and AI tools — or support your favourite creators.",
    url: "https://zinovia.ai/signup",
  },
};

export default function SignupLayout({ children }: { children: ReactNode }) {
  return children;
}
