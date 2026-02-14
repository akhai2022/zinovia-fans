import Link from "next/link";
import { Page } from "@/components/brand/Page";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function NotFound() {
  return (
    <Page className="flex min-h-[60vh] items-center justify-center">
      <Card className="w-full max-w-md text-center">
        <CardHeader>
          <div className="mx-auto mb-2 flex h-16 w-16 items-center justify-center rounded-full bg-muted">
            <span className="text-3xl font-bold text-muted-foreground">404</span>
          </div>
          <CardTitle className="font-display text-premium-h3">Page not found</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            The page you&apos;re looking for doesn&apos;t exist or has been moved.
          </p>
          <div className="flex flex-wrap justify-center gap-3">
            <Button asChild>
              <Link href="/">Home</Link>
            </Button>
            <Button variant="secondary" asChild>
              <Link href="/creators">Discover creators</Link>
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
