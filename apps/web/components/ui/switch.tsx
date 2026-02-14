"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

const Switch = React.forwardRef<
  HTMLButtonElement,
  React.ButtonHTMLAttributes<HTMLButtonElement> & { checked?: boolean; onCheckedChange?: (checked: boolean) => void }
>(({ className, checked, onCheckedChange, onClick, ...props }, ref) => {
  const [internalChecked, setInternalChecked] = React.useState(checked ?? false);
  const isControlled = checked !== undefined;
  const value = isControlled ? checked : internalChecked;
  const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    const next = !value;
    if (!isControlled) setInternalChecked(next);
    onCheckedChange?.(next);
    onClick?.(e);
  };
  return (
    <button
      type="button"
      role="switch"
      aria-checked={value}
      ref={ref}
      className={cn(
        "peer inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full border border-border shadow-premium-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/35 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
        value ? "bg-primary border-primary/70" : "bg-surface-alt",
        className
      )}
      onClick={handleClick}
      {...props}
    >
      <span
        className={cn(
          "pointer-events-none block h-5 w-5 rounded-full bg-card shadow-premium-sm ring-0 transition-transform",
          value ? "translate-x-5" : "translate-x-0.5"
        )}
      />
    </button>
  );
});
Switch.displayName = "Switch";

export { Switch };
