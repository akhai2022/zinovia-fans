import { cn } from "@/lib/utils";

interface ContainerProps {
  children: React.ReactNode;
  className?: string;
}

/** Max-width container for landing sections (max-w-6xl). */
export function Container({ children, className }: ContainerProps) {
  return (
    <div className={cn("mx-auto w-full max-w-6xl px-4 sm:px-6", className)}>
      {children}
    </div>
  );
}

/** Constrains copy block width for readability (max-w-2xl). */
export function CopyBlock({ children, className }: ContainerProps) {
  return <div className={cn("max-w-2xl", className)}>{children}</div>;
}
