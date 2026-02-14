"use client";

import { useParams } from "next/navigation";
import { Page } from "@/components/brand/Page";

export default function FutureFeatureDetailPage() {
  const params = useParams<{ feature: string }>();
  return (
    <Page>
      <h1 className="text-2xl font-semibold tracking-tight">Scaffold: {params.feature}</h1>
      <p className="mt-3 text-sm text-muted-foreground">
        This page is a Phase 2/3 placeholder to keep future delivery incremental and avoid refactors.
      </p>
    </Page>
  );
}

