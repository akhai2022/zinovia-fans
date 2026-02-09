import { cn } from "@/lib/utils";

export function CardSection({
  title,
  children,
  className,
}: {
  title: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("space-y-3", className)}>
      <h2 className="text-lg font-semibold tracking-tight text-foreground">
        {title}
      </h2>
      <div className="space-y-4">{children}</div>
    </section>
  );
}
