import * as React from "react";
import { cn } from "@/lib/utils";

export function Icon({
  children,
  className,
  size = 20,
}: {
  children: React.ReactNode;
  className?: string;
  size?: number;
}) {
  return (
    <span
      className={cn("inline-flex shrink-0 items-center justify-center", className)}
      style={{ width: size, height: size }}
      aria-hidden
    >
      {children}
    </span>
  );
}
