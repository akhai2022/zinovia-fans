import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "Motion Transfer / Character Replace — AI Studio | Zinovia Fans",
  description:
    "Transfer motion from a source video onto a target character. Full-body motion-driven character replacement powered by AI.",
  alternates: { canonical: "https://zinovia.ai/ai/tools/motion-transfer" },
  openGraph: {
    title: "Motion Transfer / Character Replace — AI Studio",
    description:
      "Full-body motion transfer and character replacement. Upload a driving video and target identity to generate a new video.",
    url: "https://zinovia.ai/ai/tools/motion-transfer",
  },
};

export default function MotionTransferLayout({ children }: { children: ReactNode }) {
  return children;
}
