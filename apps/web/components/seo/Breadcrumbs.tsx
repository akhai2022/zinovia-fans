import Link from "next/link";

const SITE_URL = "https://zinovia.ai";

export interface BreadcrumbItem {
  label: string;
  href?: string;
}

/**
 * Renders a visible breadcrumb trail and injects BreadcrumbList JSON-LD schema.
 * Usage: <Breadcrumbs items={[{ label: "Compare", href: "/compare" }, { label: "vs Patreon" }]} />
 * The last item is treated as the current page (no link).
 */
export function Breadcrumbs({ items }: { items: BreadcrumbItem[] }) {
  const all: BreadcrumbItem[] = [{ label: "Home", href: "/" }, ...items];

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: all.map((item, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: item.label,
      ...(item.href ? { item: `${SITE_URL}${item.href}` } : {}),
    })),
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <nav aria-label="Breadcrumb" className="text-sm text-muted-foreground">
        <ol className="flex flex-wrap items-center gap-1">
          {all.map((item, i) => {
            const isLast = i === all.length - 1;
            return (
              <li key={i} className="flex items-center gap-1">
                {i > 0 && <span className="text-border">/</span>}
                {item.href && !isLast ? (
                  <Link href={item.href} className="hover:text-foreground transition-colors">
                    {item.label}
                  </Link>
                ) : (
                  <span className={isLast ? "text-foreground font-medium" : ""}>{item.label}</span>
                )}
              </li>
            );
          })}
        </ol>
      </nav>
    </>
  );
}
