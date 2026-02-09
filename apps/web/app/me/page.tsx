"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { AuthService, type UserOut } from "@zinovia/contracts";
import { Page } from "@/components/brand/Page";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import "@/lib/api";

function MePageSkeleton() {
  return (
    <Page>
      <h1 className="text-2xl font-semibold tracking-tight text-foreground">Me</h1>
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
      .catch(() => setStatus("error"));
  }, []);

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
      <h1 className="text-2xl font-semibold tracking-tight text-foreground">Me</h1>
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
      {status === "error" && (
        <p className="mt-4 text-muted-foreground">Not authenticated.</p>
      )}
      {status === "loaded" && user && (
        <Card className="mt-4">
          <CardHeader>
            <CardTitle>Account</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div>
              <span className="text-muted-foreground">Email:</span> {user.email}
            </div>
            <div>
              <span className="text-muted-foreground">Role:</span> {user.role}
            </div>
            <Button variant="outline" size="sm" className="mt-4" asChild>
              <Link href="/settings/profile">Edit profile</Link>
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
