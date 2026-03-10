import Link from "next/link";
import { Page } from "@/components/brand/Page";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function ForbiddenPage() {
  return (
    <Page className="flex min-h-[60vh] items-center justify-center">
      <Card className="w-full max-w-md text-center">
        <CardHeader>
          <div className="mx-auto mb-2 flex h-16 w-16 items-center justify-center rounded-full bg-destructive/10">
            <span className="text-3xl font-bold text-destructive">403</span>
          </div>
          <CardTitle className="font-display text-premium-h3">Access denied</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            You don&apos;t have permission to access this resource.
          </p>
          <div className="flex flex-wrap justify-center gap-3">
            <Button asChild>
              <Link href="/">Home</Link>
            </Button>
            <Button variant="ghost" size="sm" asChild>
              <Link href="/help">Help</Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </Page>
  );
}
