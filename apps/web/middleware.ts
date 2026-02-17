import { NextRequest, NextResponse } from "next/server";
import {
  SUPPORTED_LOCALES,
  DEFAULT_LOCALE,
  LOCALE_COOKIE,
  COUNTRY_TO_LOCALE,
  type Locale,
} from "@/lib/i18n/config";

function isSupported(v: string): v is Locale {
  return (SUPPORTED_LOCALES as readonly string[]).includes(v);
}

/**
 * Routes that require an authenticated session.
 * Unauthenticated visitors are redirected to /login?next=<path>.
 */
const PROTECTED_PREFIXES = [
  "/me",
  "/messages",
  "/admin",
  "/billing",
  "/settings",
  "/notifications",
  "/onboarding",
  "/ai/images",
  "/creator/post",
];

function isProtectedRoute(pathname: string): boolean {
  return PROTECTED_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(prefix + "/"),
  );
}

/**
 * Detect locale from (in priority order):
 * 1. Existing cookie (user previously visited or manually switched)
 * 2. CloudFront-Viewer-Country header (geo-IP from CDN)
 * 3. X-Vercel-IP-Country header (Vercel hosting)
 * 4. Accept-Language header (browser preference)
 * 5. Default to English
 */
function detectLocale(req: NextRequest): Locale {
  // 1. Cookie already set
  const cookie = req.cookies.get(LOCALE_COOKIE)?.value;
  if (cookie && isSupported(cookie)) return cookie;

  // 2. CloudFront geo header
  const cfCountry = req.headers.get("cloudfront-viewer-country");
  if (cfCountry) {
    const mapped = COUNTRY_TO_LOCALE[cfCountry.toUpperCase()];
    if (mapped) return mapped;
  }

  // 3. Vercel geo header
  const vercelCountry = req.headers.get("x-vercel-ip-country");
  if (vercelCountry) {
    const mapped = COUNTRY_TO_LOCALE[vercelCountry.toUpperCase()];
    if (mapped) return mapped;
  }

  // 4. Accept-Language
  const acceptLang = req.headers.get("accept-language");
  if (acceptLang) {
    // Parse "en-US,en;q=0.9,fr;q=0.8" → try each language tag
    const tags = acceptLang
      .split(",")
      .map((part) => {
        const [tag, q] = part.trim().split(";q=");
        return { lang: tag.trim().split("-")[0].toLowerCase(), q: q ? parseFloat(q) : 1 };
      })
      .sort((a, b) => b.q - a.q);

    for (const { lang } of tags) {
      if (isSupported(lang)) return lang;
    }
  }

  return DEFAULT_LOCALE;
}

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Auth gate: redirect unauthenticated users away from protected routes
  if (isProtectedRoute(pathname)) {
    const hasSession = req.cookies.has("access_token");
    if (!hasSession) {
      const loginUrl = req.nextUrl.clone();
      loginUrl.pathname = "/login";
      loginUrl.searchParams.set("next", pathname);
      return NextResponse.redirect(loginUrl);
    }
  }

  const locale = detectLocale(req);
  const res = NextResponse.next();

  // Set/refresh locale cookie (1 year, accessible client-side for hydration)
  if (req.cookies.get(LOCALE_COOKIE)?.value !== locale) {
    res.cookies.set(LOCALE_COOKIE, locale, {
      path: "/",
      maxAge: 60 * 60 * 24 * 365,
      sameSite: "lax",
    });
  }

  // Pass locale via header so server components can read it without cookies() call
  res.headers.set("x-zinovia-locale", locale);

  return res;
}

export const config = {
  // Run on all page routes but skip static assets / api / _next
  matcher: ["/((?!api|_next/static|_next/image|assets|favicon\\.ico).*)"],
};
