import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "Virtual Try-On — AI Studio | Zinovia Fans",
  description:
    "Upload a person photo and a garment image to see a realistic virtual try-on preview. AI-powered diffusion model, free for creators on Zinovia Fans.",
  alternates: { canonical: "https://zinovia.ai/ai/tools/virtual-tryon" },
  openGraph: {
    title: "Virtual Try-On — AI Studio",
    description:
      "See how clothes look on you with AI-powered virtual try-on. Free for Zinovia Fans creators.",
    url: "https://zinovia.ai/ai/tools/virtual-tryon",
  },
};

export default function VirtualTryOnLayout({ children }: { children: ReactNode }) {
  return children;
}
