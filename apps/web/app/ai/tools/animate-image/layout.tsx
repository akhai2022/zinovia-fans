import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "AI Image Animator — Bring Photos to Life | Zinovia Fans",
  description:
    "Animate still images with AI. Create eye-catching motion content for your subscribers — free tool for creators on Zinovia Fans.",
  alternates: { canonical: "https://zinovia.ai/ai/tools/animate-image" },
  openGraph: {
    title: "AI Image Animator — Bring Photos to Life",
    description:
      "Animate still images with AI. Create eye-catching motion content for your subscribers.",
    url: "https://zinovia.ai/ai/tools/animate-image",
  },
};

export default function AnimateImageLayout({ children }: { children: ReactNode }) {
  return children;
}
