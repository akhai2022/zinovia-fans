"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getApiBaseUrl } from "@/lib/apiBase";
import { Page } from "@/components/brand/Page";
import { Button } from "@/components/ui/button";

type HealthState = "idle" | "loading" | "ok" | "error";

export default function DebugPage() {
  const [healthState, setHealthState] = useState<HealthState>("idle");
  const [healthDetail, setHealthDetail] = useState<string>("");
  const isDev = process.env.NODE_ENV === "development";

  useEffect(() => {
    if (!isDev) return;
    setHealthState("loading");
    const base = getApiBaseUrl();
    fetch(`${base}/health`, { credentials: "include" })
      .then((res) => {
        if (res.ok) {
          return res.json().then((data) => {
            setHealthState("ok");
            setHealthDetail(JSON.stringify(data, null, 2));
          });
        }
        setHealthState("error");
        setHealthDetail(`${res.status} ${res.statusText}`);
      })
      .catch((err) => {
        setHealthState("error");
        setHealthDetail(err instanceof Error ? err.message : "Request failed");
      });
  }, [isDev]);

  if (!isDev) {
    return (
      <Page>
        <p className="text-sm text-muted-foreground">Debug page is only available in development.</p>
        <Button variant="ghost" size="sm" className="mt-4" asChild>
          <Link href="/">Home</Link>
        </Button>
      </Page>
    );
  }

  const baseUrl = getApiBaseUrl();

  return (
    <Page className="space-y-6">
      <h1 className="text-premium-h2 font-semibold tracking-tight text-foreground">
        Dev diagnostics
      </h1>

      <div className="card-premium rounded-premium-lg p-4">
        <h2 className="text-premium-h3 font-medium text-foreground mb-3">Theme swatches</h2>
        <div className="flex flex-wrap gap-4">
          <div className="flex flex-col items-center gap-1">
            <div className="h-12 w-12 rounded-lg bg-primary" title="primary" />
            <span className="text-premium-small text-muted-foreground">primary</span>
          </div>
          <div className="flex flex-col items-center gap-1">
            <div className="h-12 w-12 rounded-lg bg-accent" title="accent" />
            <span className="text-premium-small text-muted-foreground">accent</span>
          </div>
          <div className="flex flex-col items-center gap-1">
            <div className="h-12 w-12 rounded-lg bg-brand" title="brand" />
            <span className="text-premium-small text-muted-foreground">brand</span>
          </div>
          <div className="flex flex-col items-center gap-1">
            <div className="h-12 w-12 rounded-lg border border-border bg-card" title="card" />
            <span className="text-premium-small text-muted-foreground">card</span>
          </div>
        </div>
      </div>

      <dl className="space-y-2 text-sm">
        <div>
          <dt className="font-medium text-muted-foreground">API base URL</dt>
          <dd className="mt-0.5 font-mono text-foreground">{baseUrl}</dd>
        </div>
        <div>
          <dt className="font-medium text-muted-foreground">/health</dt>
          <dd className="mt-0.5">
            {healthState === "idle" && <span className="text-muted-foreground">—</span>}
            {healthState === "loading" && <span className="text-muted-foreground">Checking…</span>}
            {healthState === "ok" && (
              <span className="text-[var(--success-500)]">OK</span>
            )}
            {healthState === "error" && (
              <span className="text-destructive">{healthDetail}</span>
            )}
          </dd>
          {healthDetail && healthState === "ok" && (
            <pre className="mt-2 overflow-auto rounded bg-muted p-2 text-xs">
              {healthDetail}
            </pre>
          )}
        </div>
      </dl>
      <Button variant="ghost" size="sm" asChild>
        <Link href="/">Home</Link>
      </Button>
    </Page>
  );
}
