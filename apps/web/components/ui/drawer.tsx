"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

export function Drawer({
  open,
  onClose,
  side = "right",
  title,
  children,
  className,
}: {
  open: boolean;
  onClose: () => void;
  side?: "left" | "right";
  title?: string;
  children: React.ReactNode;
  className?: string;
}) {
  React.useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50">
      <button
        type="button"
        aria-label="Close drawer backdrop"
        className="absolute inset-0 bg-foreground/20"
        onClick={onClose}
      />
      <aside
        className={cn(
          "absolute top-0 h-full w-[86vw] max-w-sm border-border bg-card p-5 shadow-premium-lg transition-transform duration-300 ease-out",
          side === "right" ? "right-0 border-l translate-x-0" : "left-0 border-r translate-x-0",
          className
        )}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-base font-semibold text-foreground">{title}</h2>
          <button type="button" onClick={onClose} className="rounded-md px-2 py-1 text-sm text-muted-foreground hover:bg-muted">
            Close
          </button>
        </div>
        {children}
      </aside>
    </div>
  );
}
