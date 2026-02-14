"use client";

import { useEffect } from "react";

/**
 * Global error boundary for the entire app. This catches errors that
 * occur outside of the root layout (which is rare but possible).
 * It must include its own <html> and <body> tags.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Global error:", error);
  }, [error]);

  return (
    <html lang="en">
      <body style={{ fontFamily: "system-ui, sans-serif", backgroundColor: "#fafafa", color: "#111" }}>
        <div
          style={{
            display: "flex",
            minHeight: "100vh",
            alignItems: "center",
            justifyContent: "center",
            padding: "2rem",
          }}
        >
          <div style={{ maxWidth: "28rem", textAlign: "center" }}>
            <h1 style={{ fontSize: "1.5rem", fontWeight: 600, marginBottom: "1rem" }}>
              Something went wrong
            </h1>
            <p style={{ color: "#666", marginBottom: "0.5rem" }}>
              An unexpected error occurred. Please try again or contact support.
            </p>
            {error.digest && (
              <p style={{ fontSize: "0.75rem", color: "#999", marginBottom: "1rem" }}>
                Error ID: {error.digest}
              </p>
            )}
            <div style={{ display: "flex", gap: "0.75rem", justifyContent: "center" }}>
              <button
                onClick={reset}
                style={{
                  padding: "0.5rem 1rem",
                  backgroundColor: "#111",
                  color: "#fff",
                  border: "none",
                  borderRadius: "0.5rem",
                  cursor: "pointer",
                }}
              >
                Try again
              </button>
              <a
                href="/"
                style={{
                  padding: "0.5rem 1rem",
                  border: "1px solid #ddd",
                  borderRadius: "0.5rem",
                  textDecoration: "none",
                  color: "#111",
                }}
              >
                Home
              </a>
              <a
                href="mailto:support@zinovia.ai"
                style={{
                  padding: "0.5rem 1rem",
                  color: "#666",
                  textDecoration: "underline",
                }}
              >
                Contact support
              </a>
            </div>
          </div>
        </div>
      </body>
    </html>
  );
}
