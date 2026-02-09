import Link from "next/link";
import { Container } from "./Container";

const FOOTER_LINKS: Record<
  string,
  Array<{ label: string; href?: string }>
> = {
  Product: [
    { label: "For creators", href: "/signup" },
    { label: "For fans", href: "/feed" },
    { label: "How it works", href: "#how-it-works" },
    { label: "Pricing", href: "#pricing" },
    { label: "Features", href: "#features" },
  ],
  Company: [{ label: "About", href: "/" }],
  Support: [{ label: "Help center" }, { label: "Contact" }],
  Legal: [
    { label: "Privacy policy" },
    { label: "Terms of service" },
    { label: "Refund policy", href: "#faq" },
  ],
};

const LINK_CLASS =
  "text-premium-body-sm text-muted-foreground hover:text-brand focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-ring focus-visible:ring-offset-2 rounded transition-colors duration-fast";

export function Footer() {
  return (
    <footer
      className="relative border-t border-border/80 bg-surface-2/50 py-10"
      aria-label="Footer"
    >
      {/* Brand gradient line */}
      <div
        className="absolute left-0 right-0 top-0 h-0.5 bg-brand-gradient opacity-60"
        aria-hidden
      />
      <Container>
        <div className="grid gap-8 sm:grid-cols-2 md:grid-cols-4">
          {Object.entries(FOOTER_LINKS).map(([heading, links]) => (
            <div key={heading}>
              <h3 className="text-premium-body-sm font-semibold text-foreground">
                {heading}
              </h3>
              <ul className="mt-3 space-y-2">
                {links.map(({ label, href }) => (
                  <li key={label}>
                    {href ? (
                      <Link href={href} className={LINK_CLASS}>
                        {label}
                      </Link>
                    ) : (
                      <span className="text-premium-body-sm text-muted-foreground">
                        {label}
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <div className="mt-10 flex flex-col gap-4 border-t border-border/80 pt-8 sm:flex-row sm:items-center sm:justify-between">
          <Link
            href="/"
            className="font-semibold tracking-tight text-foreground no-underline hover:text-foreground/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 rounded"
          >
            Zinovia Fans
          </Link>
          <p className="text-premium-small text-muted-foreground">
            © {new Date().getFullYear()} Zinovia Fans. All rights reserved.
          </p>
        </div>
      </Container>
    </footer>
  );
}
