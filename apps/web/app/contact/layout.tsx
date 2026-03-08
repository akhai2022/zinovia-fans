import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "Contact Us — Zinovia Fans Support",
  description:
    "Get in touch with the Zinovia Fans team. Support for billing, account issues, privacy requests, creator partnerships, and content reports.",
  alternates: { canonical: "https://zinovia.ai/contact" },
  openGraph: {
    title: "Contact Us — Zinovia Fans Support",
    description:
      "Get in touch with the Zinovia Fans team. Support for billing, account issues, privacy requests, and creator partnerships.",
    url: "https://zinovia.ai/contact",
  },
};

export default function ContactLayout({ children }: { children: ReactNode }) {
  return children;
}
