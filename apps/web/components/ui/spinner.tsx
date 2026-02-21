import { cn } from "@/lib/utils";

export function Spinner({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "material-symbols-outlined animate-spin inline-flex items-center justify-center leading-none select-none icon-base",
        className,
      )}
      aria-hidden
    >
      progress_activity
    </span>
  );
}
