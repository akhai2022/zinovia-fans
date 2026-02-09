"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { AuthService, type UserOut } from "@zinovia/contracts";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import "@/lib/api";

const NAV_LINKS_ALWAYS = [
  { href: "/", label: "Home" },
  { href: "/feed", label: "Feed" },
  { href: "/creators", label: "Creators" },
] as const;

const NAV_LINK_SETTINGS = { href: "/settings/profile", label: "Settings" } as const;
const NAV_LINK_NEW_POST = { href: "/creator/post/new", label: "New post" } as const;

export function Navbar() {
  const pathname = usePathname();
  const [user, setUser] = useState<UserOut | null>(null);
  const [loading, setLoading] = useState(true);

  // Refetch auth on pathname change so after login/signup redirect we show the correct state
  useEffect(() => {
    setLoading(true);
    AuthService.authMe()
      .then(setUser)
      .catch(() => setUser(null))
      .finally(() => setLoading(false));
  }, [pathname]);

  const handleLogout = () => {
    setUser(null);
  };

  return (
    <header className="sticky top-0 z-40 w-full border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4 sm:px-6">
        <Link
          href="/"
          className="flex items-center gap-1.5 font-semibold tracking-tight no-underline"
          aria-label="Zinovia Fans home"
        >
          <span className="text-gradient-brand">Zinovia</span>
          <span className="text-foreground/70">Fans</span>
        </Link>
        <nav className="flex items-center gap-1 sm:gap-2">
          {NAV_LINKS_ALWAYS.map(({ href, label }) => {
            const active = pathname === href || (href !== "/" && pathname.startsWith(href));
            return (
              <Button
                key={href}
                variant="ghost"
                size="sm"
                asChild
                className={cn(
                  active && "bg-accent/50 ring-brand rounded-brand"
                )}
              >
                <Link href={href}>{label}</Link>
              </Button>
            );
          })}
          {user && (
            <>
              <Button
                variant="ghost"
                size="sm"
                asChild
                className={cn(
                  (pathname === NAV_LINK_NEW_POST.href || pathname.startsWith(NAV_LINK_NEW_POST.href + "/")) && "bg-accent/50 ring-brand rounded-brand"
                )}
              >
                <Link href={NAV_LINK_NEW_POST.href}>{NAV_LINK_NEW_POST.label}</Link>
              </Button>
              <Button
                variant="ghost"
                size="sm"
                asChild
                className={cn(
                  (pathname === NAV_LINK_SETTINGS.href || pathname.startsWith(NAV_LINK_SETTINGS.href + "/")) && "bg-accent/50 ring-brand rounded-brand"
                )}
              >
                <Link href={NAV_LINK_SETTINGS.href}>{NAV_LINK_SETTINGS.label}</Link>
              </Button>
            </>
          )}
          {loading ? (
            <span className="h-8 w-16 animate-pulse rounded-brand bg-muted" />
          ) : user ? (
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
                  <Link href="/settings/profile">Settings</Link>
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleLogout}>
                  Logout
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <div className="flex items-center gap-1">
              <Button variant="outline" size="sm" className="btn-secondary" asChild>
                <Link href="/login">Login</Link>
              </Button>
              <Button size="sm" className="btn-primary" asChild>
                <Link href="/signup">Sign up</Link>
              </Button>
            </div>
          )}
        </nav>
      </div>
    </header>
  );
}
