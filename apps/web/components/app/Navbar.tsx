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
import "@/lib/api";

const NAV_LINKS_PUBLIC = [
  { href: "/", label: "Home" },
  { href: "/feed", label: "Feed" },
  { href: "/creators", label: "Creators" },
] as const;

const NAV_LINKS_AUTH = [
  { href: "/messages", label: "Messages" },
  { href: "/creator/post/new", label: "New post" },
  { href: "/settings/profile", label: "Settings" },
] as const;

export function Navbar({
  initialSession,
  sessionUnavailable = false,
}: {
  initialSession: UserOut | null;
  sessionUnavailable?: boolean;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [user, setUser] = useState<UserOut | null>(initialSession);
  const [unreadNotifications, setUnreadNotifications] = useState(0);
  const [mobileOpen, setMobileOpen] = useState(false);

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
    // Full navigation to "/" clears all client state (SWR cache, etc.)
    // and prevents back-button from showing authenticated content.
    window.location.href = "/";
  };

  return (
    <header className="sticky top-0 z-40 w-full border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
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
                  active && "bg-muted text-foreground"
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
                    (pathname === link.href || pathname.startsWith(link.href + "/")) && "bg-muted text-foreground"
                  )}
                >
                  <Link href={link.href}>{link.label}</Link>
                </Button>
              ))}
              <Button variant="ghost" size="sm" asChild>
                <Link href="/notifications">
                  Notifications{unreadNotifications > 0 ? ` (${unreadNotifications})` : ""}
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
                  <Link href="/me">Me</Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link href="/messages">Messages</Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link href="/settings/profile">Settings</Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link href="/billing/manage">Subscriptions</Link>
                </DropdownMenuItem>
                {user?.role === "admin" && (
                  <DropdownMenuItem asChild>
                    <Link href="/admin">Admin</Link>
                  </DropdownMenuItem>
                )}
                <DropdownMenuItem onClick={handleLogout}>
                  Logout
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <div className="flex items-center gap-2">
              <Button variant="secondary" size="sm" asChild>
                <Link href="/login">Login</Link>
              </Button>
              <Button size="sm" asChild>
                <Link href="/signup">Sign up</Link>
              </Button>
              {sessionUnavailable && (
                <span className="text-xs text-muted-foreground" title="Session check failed; API may be temporarily unavailable.">
                  reconnecting…
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
          Menu
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
              Notifications{unreadNotifications > 0 ? ` (${unreadNotifications})` : ""}
            </Link>
          )}
          {!user && (
            <div className="grid grid-cols-2 gap-2 pt-2">
              <Button className="btn-cta-primary" asChild>
                <Link href="/signup" onClick={() => setMobileOpen(false)}>Start Subscribing</Link>
              </Button>
              <Button variant="secondary" asChild>
                <Link href="/creators" onClick={() => setMobileOpen(false)}>Explore Creators</Link>
              </Button>
              <Link
                href="/login"
                onClick={() => setMobileOpen(false)}
                className="col-span-2 rounded-brand border border-border py-2 text-center text-sm font-medium text-muted-foreground hover:text-foreground"
              >
                Login
              </Link>
            </div>
          )}
        </div>
      </Drawer>
    </header>
  );
}
