"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Home,
  Rss,
  Users,
  Search,
  MessageCircle,
  PenSquare,
  FolderOpen,
  LayoutGrid,
  Settings,
  Bell,
  User,
  CreditCard,
  ShieldCheck,
  LogOut,
  LogIn,
  UserPlus,
  Menu,
  Compass,
  Clock,
  HelpCircle,
} from "lucide-react";
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

function formatRelativeTime(dateStr: string | null | undefined): string {
  if (!dateStr) return "Never";
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMin = Math.floor(diffMs / 60_000);
  if (diffMin < 1) return "Just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHours = Math.floor(diffMin / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString();
}

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
    { href: "/", label: t.nav.home, icon: Home },
    { href: "/creators", label: t.nav.creators, icon: Users },
    { href: "/search", label: "Search", icon: Search },
  ];

  const isCreator = user?.role === "creator" || user?.role === "admin";

  const NAV_LINKS_AUTH = [
    { href: "/feed", label: t.nav.feed, icon: Rss },
    { href: "/messages", label: t.nav.messages, icon: MessageCircle },
    ...(isCreator
      ? [
          { href: "/creator/post/new", label: t.nav.newPost, icon: PenSquare },
          { href: "/creator/vault", label: t.nav.vault, icon: FolderOpen },
          { href: "/creator/collections", label: t.nav.collections, icon: LayoutGrid },
        ]
      : []),
    { href: "/settings/profile", label: t.nav.settings, icon: Settings },
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
    <header data-testid="navbar" className="sticky top-0 z-40 w-full border-b border-white/[0.06] bg-[rgb(10,10,14)]/95 backdrop-blur supports-[backdrop-filter]:bg-[rgb(10,10,14)]/80">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
        <Link
          href="/"
          className="flex items-center gap-1.5 font-display text-lg font-semibold tracking-tight no-underline"
          aria-label="Zinovia Fans home"
        >
          <span className="text-gradient-brand">Zinovia</span>
          <span className="text-foreground/75">Fans</span>
        </Link>

        {/* Desktop nav */}
        <nav className="hidden items-center gap-1 sm:flex sm:gap-1.5">
          {NAV_LINKS_PUBLIC.map(({ href, label, icon: Icon }) => {
            const active = pathname === href || (href !== "/" && pathname.startsWith(href));
            return (
              <Button
                key={href}
                variant="ghost"
                size="sm"
                asChild
                className={cn(active && "bg-white/10 text-foreground")}
              >
                <Link href={href} className="flex items-center gap-1.5">
                  <Icon className="h-4 w-4" />
                  <span>{label}</span>
                </Link>
              </Button>
            );
          })}

          {user && (
            <>
              {NAV_LINKS_AUTH.map(({ href, label, icon: Icon }) => {
                const active = pathname === href || pathname.startsWith(href + "/");
                return (
                  <Button
                    key={href}
                    variant="ghost"
                    size="sm"
                    asChild
                    className={cn(active && "bg-white/10 text-foreground")}
                  >
                    <Link href={href} className="flex items-center gap-1.5">
                      <Icon className="h-4 w-4" />
                      <span>{label}</span>
                    </Link>
                  </Button>
                );
              })}

              {/* Notifications */}
              <Button variant="ghost" size="sm" asChild>
                <Link href="/notifications" className="relative flex items-center gap-1.5">
                  <Bell className="h-4 w-4" />
                  <span>{t.nav.notifications}</span>
                  {unreadNotifications > 0 && (
                    <span className="absolute -right-1 -top-1 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-primary px-1 text-[10px] font-bold text-white">
                      {unreadNotifications > 99 ? "99+" : unreadNotifications}
                    </span>
                  )}
                </Link>
              </Button>
            </>
          )}

          {/* User dropdown / auth buttons */}
          {user ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  className="ml-1 flex items-center gap-2 rounded-full focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <div className="relative">
                    <Avatar className="h-8 w-8">
                      <AvatarFallback className="text-xs">
                        {user.email?.slice(0, 2).toUpperCase() ?? "?"}
                      </AvatarFallback>
                    </Avatar>
                    <span className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-[rgb(10,10,14)] bg-emerald-500" />
                  </div>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                {/* User info header */}
                <div className="border-b border-border px-3 py-2.5">
                  <div className="flex items-center gap-2">
                    <span className="h-2 w-2 shrink-0 rounded-full bg-emerald-500" title="Online" />
                    <span className="text-sm font-medium text-foreground truncate">
                      {user.profile?.display_name || user.email}
                    </span>
                    <span className={cn(
                      "ml-auto shrink-0 rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase leading-none",
                      user.role === "creator"
                        ? "bg-primary/15 text-primary"
                        : user.role === "admin"
                          ? "bg-amber-500/15 text-amber-400"
                          : "bg-emerald-500/15 text-emerald-400"
                    )}>
                      {user.role === "fan" ? "Fan" : user.role}
                    </span>
                  </div>
                  <p className="mt-0.5 text-xs text-muted-foreground truncate">{user.email}</p>
                  {user.last_login_at && (
                    <p className="mt-1 flex items-center gap-1 text-[11px] text-muted-foreground">
                      <Clock className="h-3 w-3" />
                      Last login: {formatRelativeTime(user.last_login_at)}
                    </p>
                  )}
                </div>
                <DropdownMenuItem asChild>
                  <Link href="/me" className="flex items-center gap-2">
                    <User className="h-4 w-4 text-muted-foreground" />
                    {t.nav.me}
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link href="/messages" className="flex items-center gap-2">
                    <MessageCircle className="h-4 w-4 text-muted-foreground" />
                    {t.nav.messages}
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link href="/settings/profile" className="flex items-center gap-2">
                    <Settings className="h-4 w-4 text-muted-foreground" />
                    {t.nav.settings}
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link href="/billing/manage" className="flex items-center gap-2">
                    <CreditCard className="h-4 w-4 text-muted-foreground" />
                    {t.nav.subscriptions}
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link href="/contact" className="flex items-center gap-2">
                    <HelpCircle className="h-4 w-4 text-muted-foreground" />
                    {t.nav.support}
                  </Link>
                </DropdownMenuItem>
                {user?.role === "admin" && (
                  <DropdownMenuItem asChild>
                    <Link href="/admin" className="flex items-center gap-2">
                      <ShieldCheck className="h-4 w-4 text-muted-foreground" />
                      {t.nav.admin}
                    </Link>
                  </DropdownMenuItem>
                )}
                <DropdownMenuItem onClick={handleLogout} className="flex items-center gap-2">
                  <LogOut className="h-4 w-4 text-muted-foreground" />
                  {t.nav.logout}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="sm" asChild>
                <Link href="/login" className="flex items-center gap-1.5">
                  <LogIn className="h-3.5 w-3.5" />
                  {t.nav.login}
                </Link>
              </Button>
              <Button size="sm" className="btn-cta-primary" asChild>
                <Link href="/signup" className="flex items-center gap-1.5">
                  <UserPlus className="h-3.5 w-3.5" />
                  {t.nav.signup}
                </Link>
              </Button>
              {sessionUnavailable && (
                <span className="text-xs text-muted-foreground" title="Session check failed; API may be temporarily unavailable.">
                  {t.nav.reconnecting}
                </span>
              )}
            </div>
          )}
        </nav>

        {/* Mobile hamburger */}
        <Button
          type="button"
          variant="secondary"
          size="sm"
          className="sm:hidden"
          onClick={() => setMobileOpen(true)}
          aria-label="Open navigation menu"
        >
          <Menu className="h-4 w-4" />
          <span className="ml-1">{t.nav.menu}</span>
        </Button>
      </div>

      {/* Mobile drawer */}
      <Drawer open={mobileOpen} onClose={() => setMobileOpen(false)} title="Navigation">
        <div className="space-y-1.5">
          {[...NAV_LINKS_PUBLIC, ...(user ? NAV_LINKS_AUTH : [])].map(({ href, label, icon: Icon }) => {
            const active = pathname === href || (href !== "/" && pathname.startsWith(href));
            return (
              <Link
                key={href}
                href={href}
                onClick={() => setMobileOpen(false)}
                className={cn(
                  "flex items-center gap-3 rounded-brand border border-border px-3 py-2.5 text-sm font-medium text-foreground transition-colors",
                  active ? "bg-white/10 border-primary/30" : "bg-card hover:bg-white/5"
                )}
              >
                <Icon className="h-4 w-4 text-muted-foreground" />
                {label}
              </Link>
            );
          })}

          {user && (
            <>
              <Link
                href="/notifications"
                onClick={() => setMobileOpen(false)}
                className={cn(
                  "flex items-center gap-3 rounded-brand border border-border px-3 py-2.5 text-sm font-medium text-foreground transition-colors",
                  pathname === "/notifications" ? "bg-white/10 border-primary/30" : "bg-card hover:bg-white/5"
                )}
              >
                <Bell className="h-4 w-4 text-muted-foreground" />
                {t.nav.notifications}
                {unreadNotifications > 0 && (
                  <span className="ml-auto flex h-5 min-w-[20px] items-center justify-center rounded-full bg-primary px-1.5 text-[10px] font-bold text-white">
                    {unreadNotifications > 99 ? "99+" : unreadNotifications}
                  </span>
                )}
              </Link>
              <Link
                href="/contact"
                onClick={() => setMobileOpen(false)}
                className={cn(
                  "flex items-center gap-3 rounded-brand border border-border px-3 py-2.5 text-sm font-medium text-foreground transition-colors",
                  pathname === "/contact" ? "bg-white/10 border-primary/30" : "bg-card hover:bg-white/5"
                )}
              >
                <HelpCircle className="h-4 w-4 text-muted-foreground" />
                {t.nav.support}
              </Link>
              {user?.role === "admin" && (
                <Link
                  href="/admin"
                  onClick={() => setMobileOpen(false)}
                  className={cn(
                    "flex items-center gap-3 rounded-brand border border-border px-3 py-2.5 text-sm font-medium text-foreground transition-colors",
                    pathname.startsWith("/admin") ? "bg-white/10 border-primary/30" : "bg-card hover:bg-white/5"
                  )}
                >
                  <ShieldCheck className="h-4 w-4 text-muted-foreground" />
                  {t.nav.admin}
                </Link>
              )}
              <button
                type="button"
                onClick={() => { setMobileOpen(false); handleLogout(); }}
                className="flex w-full items-center gap-3 rounded-brand border border-border px-3 py-2.5 text-sm font-medium text-foreground transition-colors bg-card hover:bg-white/5"
              >
                <LogOut className="h-4 w-4 text-muted-foreground" />
                {t.nav.logout}
              </button>
            </>
          )}

          {!user && (
            <div className="flex flex-col gap-2 pt-3">
              <Button className="btn-cta-primary w-full" asChild>
                <Link href="/signup" onClick={() => setMobileOpen(false)} className="flex items-center justify-center gap-1.5">
                  <UserPlus className="h-4 w-4" />
                  {t.nav.startSubscribing}
                </Link>
              </Button>
              <Button variant="outline" className="w-full" asChild>
                <Link href="/login" onClick={() => setMobileOpen(false)} className="flex items-center justify-center gap-1.5">
                  <LogIn className="h-4 w-4" />
                  {t.nav.login}
                </Link>
              </Button>
              <Button variant="ghost" size="sm" className="w-full" asChild>
                <Link href="/creators" onClick={() => setMobileOpen(false)} className="flex items-center justify-center gap-1.5">
                  <Compass className="h-3.5 w-3.5" />
                  {t.nav.exploreCreators}
                </Link>
              </Button>
            </div>
          )}
        </div>
      </Drawer>
    </header>
  );
}
