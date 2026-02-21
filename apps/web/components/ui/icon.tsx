import { cn } from "@/lib/utils";

export function Icon({
  name,
  className,
  filled = false,
  "aria-hidden": ariaHidden = true,
}: {
  name: string;
  className?: string;
  filled?: boolean;
  "aria-hidden"?: boolean;
}) {
  return (
    <span
      className={cn(
        "material-symbols-outlined inline-flex items-center justify-center leading-none select-none",
        filled && "material-symbols-filled",
        className,
      )}
      aria-hidden={ariaHidden}
    >
      {name}
    </span>
  );
}
