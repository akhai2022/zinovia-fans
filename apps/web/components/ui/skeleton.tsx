import { cn } from "@/lib/utils";

function Skeleton({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("animate-pulse rounded-brand bg-surface-alt", className)}
      {...props}
    />
  );
}

export { Skeleton };
