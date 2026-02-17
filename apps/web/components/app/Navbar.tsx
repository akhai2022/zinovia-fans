"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { type UserOut } from "@zinovia/contracts";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Drawer } from "@/components/ui/drawer";
import { listNotifications } from "@/features/engagement/api";
import { logout } from "@/lib/api/auth";
import { cn } from "@/lib/utils";
import { useTranslation } from "@/lib/i18n";
import "@/lib/api";

export function Navbar({
  initialSession,
  sessionUnavailable = false,
}: {
  initialSession: UserOut | null;
  sessionUnavailable?: boolean;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const { t } = useTranslation();
  const [user, setUser] = useState<UserOut | null>(initialSession);
  const [unreadNotifications, setUnreadNotifications] = useState(0);
  const [mobileOpen, setMobileOpen] = useState(false);

  const NAV_LINKS_PUBLIC = [
    { href: "/", label: t.nav.home },
    { href: "/feed", label: t.nav.feed },
    { href: "/creators", label: t.nav.creators },
  ];

  const NAV_LINKS_AUTH = [
    { href: "/messages", label: t.nav.messages },
    { href: "/creator/post/new", label: t.nav.newPost },
    { href: "/settings/profile", label: t.nav.settings },
  ];

  useEffect(() => {
    setUser(initialSession);
  }, [initialSession]);

  useEffect(() => {
    if (!user) {
      setUnreadNotifications(0);
      return;
    }
    listNotifications()
      .then((res) => setUnreadNotifications(res.unread_count))
      .catch(() => setUnreadNotifications(0));
  }, [user, pathname]);

  const handleLogout = async () => {
    try {
      await logout();
    } catch {
      // Fallback to local UI reset even if API logout fails.
    }
    setUser(null);
    window.location.href = "/";
  };

  return (
    <header className="sticky top-0 z-40 w-full border-b border-white/[0.06] bg-[rgb(10,10,14)]/95 backdrop-blur supports-[backdrop-filter]:bg-[rgb(10,10,14)]/80">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
        <Link
          href="/"
          className="flex items-center gap-1.5 font-display text-lg font-semibold tracking-tight no-underline"
          aria-label="Zinovia Fans home"
        >
          <span className="text-gradient-brand">Zinovia</span>
          <span className="text-foreground/75">Fans</span>
        </Link>
        <nav className="hidden items-center gap-1 sm:flex sm:gap-2">
          {NAV_LINKS_PUBLIC.map(({ href, label }) => {
            const active = pathname === href || (href !== "/" && pathname.startsWith(href));
            return (
              <Button
                key={href}
                variant="ghost"
                size="sm"
                asChild
                className={cn(
                  active && "bg-white/10 text-foreground"
                )}
              >
                <Link href={href}>{label}</Link>
              </Button>
            );
          })}
          {user && (
            <>
              {NAV_LINKS_AUTH.map((link) => (
                <Button
                  key={link.href}
                  variant="ghost"
                  size="sm"
                  asChild
                  className={cn(
                    (pathname === link.href || pathname.startsWith(link.href + "/")) && "bg-white/10 text-foreground"
                  )}
                >
                  <Link href={link.href}>{link.label}</Link>
                </Button>
              ))}
              <Button variant="ghost" size="sm" asChild>
                <Link href="/notifications">
                  {t.nav.notifications}{unreadNotifications > 0 ? ` (${unreadNotifications})` : ""}
                </Link>
              </Button>
            </>
          )}
          {user ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  className="flex items-center gap-2 rounded-full focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <Avatar className="h-8 w-8">
                    <AvatarFallback className="text-xs">
                      {user.email?.slice(0, 2).toUpperCase() ?? "?"}
                    </AvatarFallback>
                  </Avatar>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem asChild>
                  <Link href="/me">{t.nav.me}</Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link href="/messages">{t.nav.messages}</Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link href="/settings/profile">{t.nav.settings}</Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link href="/billing/manage">{t.nav.subscriptions}</Link>
                </DropdownMenuItem>
                {user?.role === "admin" && (
                  <DropdownMenuItem asChild>
                    <Link href="/admin">{t.nav.admin}</Link>
                  </DropdownMenuItem>
                )}
                <DropdownMenuItem onClick={handleLogout}>
                  {t.nav.logout}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <div className="flex items-center gap-2">
              <Button variant="secondary" size="sm" asChild>
                <Link href="/login">{t.nav.login}</Link>
              </Button>
              <Button size="sm" asChild>
                <Link href="/signup">{t.nav.signup}</Link>
              </Button>
              {sessionUnavailable && (
                <span className="text-xs text-muted-foreground" title="Session check failed; API may be temporarily unavailable.">
                  {t.nav.reconnecting}
                </span>
              )}
            </div>
          )}
        </nav>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          className="sm:hidden"
          onClick={() => setMobileOpen(true)}
          aria-label="Open navigation menu"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
            <path d="M4 7H20" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            <path d="M4 12H20" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            <path d="M4 17H20" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
          {t.nav.menu}
        </Button>
      </div>
      <Drawer open={mobileOpen} onClose={() => setMobileOpen(false)} title="Navigation">
        <div className="space-y-2">
          {[...NAV_LINKS_PUBLIC, ...(user ? NAV_LINKS_AUTH : [])].map((item) => (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setMobileOpen(false)}
              className="block rounded-brand border border-border bg-card px-3 py-2 text-sm font-medium text-foreground"
            >
              {item.label}
            </Link>
          ))}
          {user && (
            <Link
              href="/notifications"
              onClick={() => setMobileOpen(false)}
              className="block rounded-brand border border-border bg-card px-3 py-2 text-sm font-medium text-foreground"
            >
              {t.nav.notifications}{unreadNotifications > 0 ? ` (${unreadNotifications})` : ""}
            </Link>
          )}
          {!user && (
            <div className="grid grid-cols-2 gap-2 pt-2">
              <Button className="btn-cta-primary" asChild>
                <Link href="/signup" onClick={() => setMobileOpen(false)}>{t.nav.startSubscribing}</Link>
              </Button>
              <Button variant="secondary" asChild>
                <Link href="/creators" onClick={() => setMobileOpen(false)}>{t.nav.exploreCreators}</Link>
              </Button>
              <Link
                href="/login"
                onClick={() => setMobileOpen(false)}
                className="col-span-2 rounded-brand border border-border py-2 text-center text-sm font-medium text-muted-foreground hover:text-foreground"
              >
                {t.nav.login}
              </Link>
            </div>
          )}
        </div>
      </Drawer>
    </header>
  );
}
