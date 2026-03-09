"use client";

import Link from "next/link";
import { useTranslation } from "@/lib/i18n";
import { LanguageSwitcher } from "@/components/app/LanguageSwitcher";

const SOCIAL_LINKS = [
  {
    label: "Twitter",
    href: "https://twitter.com/zinoviafans",
    icon: "M22.46 6c-.77.35-1.6.58-2.46.69a4.3 4.3 0 001.88-2.38 8.59 8.59 0 01-2.72 1.04 4.28 4.28 0 00-7.29 3.9A12.14 12.14 0 013.16 4.86a4.28 4.28 0 001.32 5.71 4.24 4.24 0 01-1.94-.54v.05a4.28 4.28 0 003.43 4.19 4.27 4.27 0 01-1.93.07 4.28 4.28 0 004 2.97A8.58 8.58 0 012 19.54a12.1 12.1 0 006.56 1.92c7.88 0 12.2-6.53 12.2-12.2 0-.19 0-.37-.01-.56A8.72 8.72 0 0024 6.56a8.49 8.49 0 01-2.54.7z",
  },
  {
    label: "Instagram",
    href: "https://instagram.com/zinoviafans",
    icon: "M7.75 2h8.5A5.75 5.75 0 0122 7.75v8.5A5.75 5.75 0 0116.25 22h-8.5A5.75 5.75 0 012 16.25v-8.5A5.75 5.75 0 017.75 2zm0 1.5A4.25 4.25 0 003.5 7.75v8.5A4.25 4.25 0 007.75 20.5h8.5a4.25 4.25 0 004.25-4.25v-8.5A4.25 4.25 0 0016.25 3.5h-8.5zM12 7a5 5 0 110 10 5 5 0 010-10zm0 1.5a3.5 3.5 0 100 7 3.5 3.5 0 000-7zm5.25-.88a.88.88 0 110 1.76.88.88 0 010-1.76z",
  },
  {
    label: "TikTok",
    href: "https://tiktok.com/@zinoviafans",
    icon: "M19.59 6.69a4.83 4.83 0 01-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 01-2.88 2.5 2.89 2.89 0 01-2.89-2.89 2.89 2.89 0 012.89-2.89c.28 0 .54.04.79.1v-3.5a6.37 6.37 0 00-.79-.05A6.34 6.34 0 003.15 15.2a6.34 6.34 0 0010.86 4.46V13.1a8.24 8.24 0 005.58 2.18V11.8a4.84 4.84 0 01-3.59-1.52V6.69h3.59z",
  },
] as const;

export function Footer() {
  const { t } = useTranslation();

  const SECTIONS = [
    {
      title: "Product",
      links: [
        { href: "/pricing", label: "Pricing" },
        { href: "/how-it-works", label: "How It Works" },
        { href: "/fast-payouts", label: "Fast Payouts" },
        { href: "/content-protection", label: "Content Protection" },
        { href: "/demo", label: t.nav.demo },
      ],
    },
    {
      title: "Resources",
      links: [
        { href: "/guides", label: "Guides" },
        { href: "/compare", label: "Compare Platforms" },
        { href: "/alternatives", label: "Alternatives" },
        { href: "/for/fitness-creators", label: "For Fitness Creators" },
        { href: "/for/musicians", label: "For Musicians" },
        { href: "/for/artists", label: "For Artists" },
      ],
    },
    {
      title: "Company",
      links: [
        { href: "/about", label: "About" },
        { href: "/contact", label: t.footer.contact },
        { href: "/help", label: t.footer.help },
        { href: "/creators", label: "Explore Creators" },
      ],
    },
    {
      title: "Legal",
      links: [
        { href: "/privacy", label: t.footer.privacy },
        { href: "/terms", label: t.footer.terms },
      ],
    },
  ];

  return (
    <footer className="mt-16 border-t border-white/[0.06] bg-background">
      <div className="mx-auto w-full max-w-6xl px-4 py-10 sm:px-6">
        <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-5">
          {/* Brand column */}
          <div className="flex flex-col gap-4 lg:col-span-1">
            <p className="font-display text-sm font-semibold tracking-tight">
              <span className="text-gradient-brand">Zinovia</span>{" "}
              <span className="text-foreground/75">Fans</span>
            </p>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Premium creator subscription platform with fast payouts, AI tools, and content encryption.
            </p>
            <div className="flex items-center gap-3">
              {SOCIAL_LINKS.map((social) => (
                <a
                  key={social.label}
                  href={social.href}
                  target="_blank"
                  rel="noopener noreferrer nofollow"
                  aria-label={social.label}
                  className="flex h-8 w-8 items-center justify-center rounded-full bg-white/5 text-muted-foreground transition-colors hover:bg-white/10 hover:text-foreground"
                >
                  <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24" aria-hidden>
                    <path d={social.icon} />
                  </svg>
                </a>
              ))}
            </div>
          </div>

          {/* Link sections */}
          {SECTIONS.map((section) => (
            <nav key={section.title} className="flex flex-col gap-2">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-foreground/60">{section.title}</h3>
              {section.links.map((link) => (
                <Link key={link.href} href={link.href} className="text-sm text-muted-foreground transition-colors hover:text-foreground">
                  {link.label}
                </Link>
              ))}
            </nav>
          ))}
        </div>

        <div className="mt-8 flex flex-col items-center justify-between gap-4 border-t border-white/[0.06] pt-6 sm:flex-row">
          <p className="text-xs text-muted-foreground">
            &copy; {new Date().getFullYear()} Zinovia Fans. All rights reserved.
          </p>
          <LanguageSwitcher />
        </div>
      </div>
    </footer>
  );
}
