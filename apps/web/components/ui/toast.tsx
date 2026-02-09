"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

export type ToastItem = { id: string; message: string; variant?: "default" | "success" | "error" };

const ToastContext = React.createContext<{
  toasts: ToastItem[];
  addToast: (message: string, variant?: ToastItem["variant"]) => void;
} | null>(null);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = React.useState<ToastItem[]>([]);
  const addToast = React.useCallback(
    (message: string, variant: ToastItem["variant"] = "default") => {
      const id = Math.random().toString(36).slice(2);
      setToasts((prev) => [...prev, { id, message, variant }]);
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
      }, 4000);
    },
    []
  );
  return (
    <ToastContext.Provider value={{ toasts, addToast }}>
      {children}
      <ToastViewport toasts={toasts} />
    </ToastContext.Provider>
  );
}

function ToastViewport({ toasts }: { toasts: ToastItem[] }) {
  return (
    <div
      className="fixed bottom-0 right-0 z-50 flex max-h-screen w-full flex-col-reverse gap-2 p-4 sm:max-w-[420px] sm:bottom-0 sm:right-0 sm:top-auto"
      aria-live="polite"
    >
      {toasts.map((t) => (
        <div
          key={t.id}
          className={cn(
            "pointer-events-auto rounded-brand border border-border bg-card px-4 py-3 text-sm text-card-foreground shadow-lg",
            t.variant === "success" && "border-green-500/50 bg-green-50 dark:bg-green-950/30",
            t.variant === "error" && "border-destructive/50 bg-destructive/10 text-destructive"
          )}
        >
          {t.message}
        </div>
      ))}
    </div>
  );
}

export function useToast() {
  const ctx = React.useContext(ToastContext);
  if (!ctx) return { addToast: () => {} };
  return { addToast: ctx.addToast };
}
