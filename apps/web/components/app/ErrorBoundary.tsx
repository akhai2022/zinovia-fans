"use client";

import { Component, type ReactNode } from "react";
import Link from "next/link";
import { Page } from "@/components/brand/Page";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

type Props = {
  children: ReactNode;
  /** Heading shown in the error card. */
  title?: string;
  /** Description shown below the heading. */
  description?: string;
};

type State = {
  hasError: boolean;
  error: Error | null;
};

/**
 * Reusable client-side error boundary.
 * Catches render errors in children and shows a recovery UI.
 */
export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    // Log to monitoring; guard against missing window (shouldn't happen in use client)
    console.error("[ErrorBoundary]", error, info.componentStack);
  }

  render() {
    if (!this.state.hasError) {
      return this.props.children;
    }

    const title = this.props.title ?? "Something went wrong";
    const description =
      this.props.description ?? "An unexpected error occurred. Please try refreshing.";

    return (
      <Page className="flex min-h-[60vh] items-center justify-center">
        <Card className="w-full max-w-md border-border shadow-premium-md">
          <CardHeader>
            <CardTitle className="font-display text-premium-h3">{title}</CardTitle>
            <CardDescription>{description}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-xs text-muted-foreground break-all">
              {this.state.error?.message ?? "Unknown error"}
            </p>
            <Button
              variant="secondary"
              className="w-full"
              onClick={() => {
                this.setState({ hasError: false, error: null });
                window.location.reload();
              }}
            >
              Refresh page
            </Button>
            <p className="text-center text-xs text-muted-foreground">
              If the problem persists,{" "}
              <Link href="/contact" className="text-primary underline-offset-4 hover:underline">
                contact support
              </Link>
              .
            </p>
          </CardContent>
        </Card>
      </Page>
    );
  }
}
