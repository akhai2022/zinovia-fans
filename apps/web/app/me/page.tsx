"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { AuthService, type UserOut } from "@zinovia/contracts";
import { Page } from "@/components/brand/Page";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { useTranslation } from "@/lib/i18n";
import "@/lib/api";

function MePageSkeleton() {
  const { t } = useTranslation();
  return (
    <Page>
      <h1 className="text-2xl font-semibold tracking-tight text-foreground">{t.mePage.title}</h1>
      <Card className="mt-4">
        <CardHeader>
          <Skeleton className="h-6 w-32" />
          <Skeleton className="h-4 w-48" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-4 w-full" />
          <Skeleton className="mt-2 h-4 w-3/4" />
        </CardContent>
      </Card>
    </Page>
  );
}

function MePageContent() {
  const { t } = useTranslation();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [user, setUser] = useState<UserOut | null>(null);
  const [status, setStatus] = useState<"loading" | "loaded" | "error">("loading");

  useEffect(() => {
    AuthService.authMe()
      .then((data) => {
        setUser(data);
        setStatus("loaded");
      })
      .catch(() => {
        router.replace("/login?next=/me");
      });
  }, [router]);

  useEffect(() => {
    if (status !== "loaded" || !user || searchParams.get("from") !== "signup") return;
    if (user.role === "creator") {
      router.replace("/settings/profile");
    } else {
      router.replace("/feed");
    }
  }, [status, user, searchParams, router]);

  return (
    <Page>
      <h1 className="text-2xl font-semibold tracking-tight text-foreground">{t.mePage.title}</h1>
      {status === "loading" && (
        <Card className="mt-4">
          <CardHeader>
            <Skeleton className="h-6 w-32" />
            <Skeleton className="h-4 w-48" />
          </CardHeader>
          <CardContent>
            <Skeleton className="h-4 w-full" />
            <Skeleton className="mt-2 h-4 w-3/4" />
          </CardContent>
        </Card>
      )}
      {status === "error" && null}
      {status === "loaded" && user && (
        <Card className="mt-4">
          <CardHeader>
            <CardTitle>{t.mePage.accountTitle}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div>
              <span className="text-muted-foreground">{t.mePage.emailLabel}</span> {user.email}
            </div>
            <div>
              <span className="text-muted-foreground">{t.mePage.roleLabel}</span> {user.role}
            </div>
            <Button variant="outline" size="sm" className="mt-4" asChild>
              <Link href="/settings/profile">{t.mePage.editProfileLink}</Link>
            </Button>
          </CardContent>
        </Card>
      )}
    </Page>
  );
}

export default function MePage() {
  return (
    <Suspense fallback={<MePageSkeleton />}>
      <MePageContent />
    </Suspense>
  );
}
