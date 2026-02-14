/**
 * Sentry client-side configuration for Next.js.
 * Initialized only when NEXT_PUBLIC_SENTRY_DSN is set.
 *
 * Install: npm install @sentry/nextjs
 * Then add `withSentryConfig` wrapper in next.config.mjs.
 */

const SENTRY_DSN = process.env.NEXT_PUBLIC_SENTRY_DSN;

if (SENTRY_DSN) {
  // @ts-expect-error — @sentry/nextjs is an optional dependency; imported only when DSN is set.
  import("@sentry/nextjs").then((Sentry: any) => {
    Sentry.init({
      dsn: SENTRY_DSN,
      tracesSampleRate: 0.1,
      replaysSessionSampleRate: 0,
      replaysOnErrorSampleRate: 1.0,
      environment: process.env.NODE_ENV,
    });
  }).catch(() => {
    // @sentry/nextjs not installed; skip silently
  });
}

export {};
