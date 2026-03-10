import Link from "next/link";
import { Page } from "@/components/brand/Page";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function ServerErrorPage() {
  return (
    <Page className="flex min-h-[60vh] items-center justify-center">
      <Card className="w-full max-w-md text-center">
        <CardHeader>
          <div className="mx-auto mb-2 flex h-16 w-16 items-center justify-center rounded-full bg-destructive/10">
            <span className="text-2xl font-bold text-destructive">!</span>
          </div>
          <CardTitle className="font-display text-premium-h3">Something went wrong</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Our servers are having trouble right now. Please try again in a few moments.
          </p>
          <div className="flex flex-wrap justify-center gap-3">
            <Button asChild>
              <Link href="/">Home</Link>
            </Button>
            <Button variant="ghost" size="sm" asChild>
              <Link href="mailto:support@zinovia.ai">Contact support</Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </Page>
  );
}
