import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "AI Auto Caption Generator — Creator Tool | Zinovia Fans",
  description:
    "Generate engaging captions for your posts with AI. Save time and boost engagement — free tool for creators on Zinovia Fans.",
  alternates: { canonical: "https://zinovia.ai/ai/tools/auto-caption" },
  openGraph: {
    title: "AI Auto Caption Generator — Creator Tool",
    description:
      "Generate engaging captions for your posts with AI. Save time and boost engagement.",
    url: "https://zinovia.ai/ai/tools/auto-caption",
  },
};

export default function AutoCaptionLayout({ children }: { children: ReactNode }) {
  return children;
}
