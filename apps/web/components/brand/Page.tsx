import { cn } from "@/lib/utils";

const CONTAINER_CLASS =
  "mx-auto w-full max-w-3xl px-4 py-6 sm:px-6 sm:py-8";

export function Page({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <main className={cn(CONTAINER_CLASS, className)}>
      {children}
    </main>
  );
}
