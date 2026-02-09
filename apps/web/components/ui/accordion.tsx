"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

const AccordionContext = React.createContext<{
  openId: string | null;
  setOpenId: (id: string | null) => void;
} | null>(null);

function useAccordion() {
  const ctx = React.useContext(AccordionContext);
  if (!ctx) return { openId: null, setOpenId: () => {} };
  return ctx;
}

interface AccordionProps {
  type?: "single";
  defaultValue?: string | null;
  children: React.ReactNode;
  className?: string;
}

function Accordion({
  type = "single",
  defaultValue = null,
  children,
  className,
}: AccordionProps) {
  const [openId, setOpenId] = React.useState<string | null>(defaultValue);
  const value = React.useMemo(
    () => ({
      openId,
      setOpenId: (id: string | null) =>
        setOpenId((prev) => (type === "single" && prev === id ? null : id)),
    }),
    [openId, type]
  );
  return (
    <AccordionContext.Provider value={value}>
      <div className={cn("space-y-1", className)}>{children}</div>
    </AccordionContext.Provider>
  );
}

interface AccordionItemProps {
  value: string;
  children: React.ReactNode;
  className?: string;
}

function AccordionItem({ value, children, className }: AccordionItemProps) {
  return (
    <div className={cn("rounded-premium-sm border border-border", className)}>
      {children}
    </div>
  );
}

interface AccordionTriggerProps {
  value: string;
  children: React.ReactNode;
  className?: string;
}

function AccordionTrigger({ value, children, className }: AccordionTriggerProps) {
  const { openId, setOpenId } = useAccordion();
  const isOpen = openId === value;
  return (
    <button
      type="button"
      onClick={() => setOpenId(value)}
      className={cn(
        "flex w-full items-center justify-between px-4 py-3 text-left text-premium-body-sm font-medium text-foreground hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset rounded-t-premium-sm",
        isOpen && "rounded-b-none",
        !isOpen && "rounded-premium-sm",
        className
      )}
      aria-expanded={isOpen}
      aria-controls={`accordion-content-${value}`}
      id={`accordion-trigger-${value}`}
    >
      {children}
      <span
        className={cn(
          "shrink-0 text-muted-foreground transition-transform duration-fast",
          isOpen && "rotate-180"
        )}
        aria-hidden
      >
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </span>
    </button>
  );
}

interface AccordionContentProps {
  value: string;
  children: React.ReactNode;
  className?: string;
}

function AccordionContent({ value, children, className }: AccordionContentProps) {
  const { openId } = useAccordion();
  const isOpen = openId === value;
  if (!isOpen) return null;
  return (
    <div
      id={`accordion-content-${value}`}
      role="region"
      aria-labelledby={`accordion-trigger-${value}`}
      className={cn("border-t border-border px-4 py-3 text-premium-body-sm text-muted-foreground", className)}
    >
      {children}
    </div>
  );
}

export { Accordion, AccordionItem, AccordionTrigger, AccordionContent };
