import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "AI Background Remover — Free Creator Tool | Zinovia Fans",
  description:
    "Remove backgrounds from images instantly with AI. Free tool for creators on Zinovia Fans — perfect for thumbnails, profile photos, and promotional content.",
  alternates: { canonical: "https://zinovia.ai/ai/tools/remove-bg" },
  openGraph: {
    title: "AI Background Remover — Free Creator Tool",
    description:
      "Remove backgrounds from images instantly with AI. Free for Zinovia Fans creators.",
    url: "https://zinovia.ai/ai/tools/remove-bg",
  },
};

export default function RemoveBgLayout({ children }: { children: ReactNode }) {
  return children;
}
