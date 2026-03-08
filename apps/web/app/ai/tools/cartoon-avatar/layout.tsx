import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "AI Cartoon Avatar Generator — Creator Tool | Zinovia Fans",
  description:
    "Turn your photos into cartoon-style avatars with AI. Free tool for creators on Zinovia Fans — create unique profile pictures and branded content.",
  alternates: { canonical: "https://zinovia.ai/ai/tools/cartoon-avatar" },
  openGraph: {
    title: "AI Cartoon Avatar Generator — Creator Tool",
    description:
      "Turn your photos into cartoon-style avatars with AI. Free for Zinovia Fans creators.",
    url: "https://zinovia.ai/ai/tools/cartoon-avatar",
  },
};

export default function CartoonAvatarLayout({ children }: { children: ReactNode }) {
  return children;
}
