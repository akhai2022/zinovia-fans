import { cn } from "@/lib/utils";

export function StatPill({
  value,
  label,
  variant = "neutral",
  className,
}: {
  value: number | string;
  label: string;
  variant?: "neutral" | "accent";
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-premium-sm px-2.5 py-0.5 text-premium-small font-medium",
        variant === "accent"
          ? "bg-accent-50 text-accent-700"
          : "bg-neutral-100 text-muted-foreground",
        className
      )}
    >
      <span
        className={cn(
          "tabular-nums",
          variant === "accent" ? "font-semibold text-accent-700" : "font-semibold text-foreground"
        )}
      >
        {value}
      </span>
      <span className="ml-1">{label}</span>
    </span>
  );
}
