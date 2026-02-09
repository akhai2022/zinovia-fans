"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log to monitoring in production
    console.error(error);
  }, [error]);

  return (
    <main className="mx-auto flex min-h-[50vh] max-w-3xl flex-col items-center justify-center px-4 py-16">
      <h1 className="text-premium-h2 font-semibold text-foreground">
        Something went wrong
      </h1>
      <p className="mt-2 text-premium-body-sm text-muted-foreground text-center">
        We couldn’t load this page. Try again.
      </p>
      <Button
        variant="outline"
        size="sm"
        className="mt-6 rounded-premium-sm"
        onClick={reset}
        aria-label="Try again"
      >
        Try again
      </Button>
    </main>
  );
}
