"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Page } from "@/components/brand/Page";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { Skeleton } from "@/components/ui/skeleton";
import { apiFetch } from "@/lib/api/client";
import { getApiErrorMessage } from "@/lib/errors";
import { useTranslation, interpolate } from "@/lib/i18n";
import "@/lib/api";

type SubscriptionItem = {
  subscription_id: string;
  creator_user_id: string;
  status: string;
  ccbill_subscription_id: string | null;
  current_period_end: string | null;
  cancel_at_period_end: boolean;
  cancel_at: string | null;
  updated_at: string;
};

type BillingStatus = {
  fan_user_id: string;
  items: SubscriptionItem[];
};

export default function BillingManagePage() {
  const router = useRouter();
  const { t } = useTranslation();
  const [status, setStatus] = useState<BillingStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchStatus = useCallback(async () => {
    try {
      const data = await apiFetch<BillingStatus>("/billing/status", {
        method: "GET",
      });
      setStatus(data);
      setError(null);
    } catch (err) {
      const { kind } = getApiErrorMessage(err);
      if (kind === "unauthorized") {
        router.replace("/login?next=/billing/manage");
        return;
      }
      setError(getApiErrorMessage(err).message);
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  const cancelSubscription = async (subscriptionId: string) => {
    setCancellingId(subscriptionId);
    try {
      await apiFetch(`/billing/subscriptions/${subscriptionId}/cancel`, {
        method: "POST",
      });
      await fetchStatus();
    } catch (err) {
      setError(getApiErrorMessage(err).message);
    } finally {
      setCancellingId(null);
    }
  };

  if (loading) {
    return (
      <Page className="max-w-2xl space-y-4">
        <h1 className="font-display text-premium-h2 font-semibold text-foreground">
          {t.billing.title}
        </h1>
        <Card>
          <CardContent className="space-y-3 p-6">
            <Skeleton className="h-6 w-48" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-3/4" />
          </CardContent>
        </Card>
      </Page>
    );
  }

  const subscriptions = status?.items ?? [];
  const activeSubscriptions = subscriptions.filter(
    (s) => s.status === "active" || s.status === "trialing",
  );

  return (
    <Page className="max-w-2xl space-y-6">
      <h1 className="font-display text-premium-h2 font-semibold text-foreground">
        {t.billing.title}
      </h1>

      {error && (
        <Card className="border-destructive/20 bg-destructive/5 p-4">
          <p className="text-sm text-destructive">{error}</p>
        </Card>
      )}

      {subscriptions.length === 0 && (
        <Card className="py-12 text-center">
          <p className="font-display text-lg font-semibold text-foreground">
            {t.billing.noSubscriptionsTitle}
          </p>
          <p className="mt-2 text-sm text-muted-foreground">
            {t.billing.noSubscriptionsDescription}
          </p>
          <Button size="sm" className="mt-4" asChild>
            <Link href="/creators"><Icon name="explore" className="mr-1.5 icon-sm" />{t.billing.discoverCreators}</Link>
          </Button>
        </Card>
      )}

      {activeSubscriptions.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>{t.billing.activeSubscriptionsTitle}</CardTitle>
            <CardDescription>
              {interpolate(t.billing.activeSubscriptionsDescription, { count: activeSubscriptions.length })}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {activeSubscriptions.map((sub) => (
              <div
                key={sub.subscription_id}
                className="flex items-center justify-between rounded-lg border border-border p-3"
              >
                <div>
                  <p className="text-sm font-medium text-foreground">
                    {interpolate(t.billing.creatorLabel, { creatorId: sub.creator_user_id.slice(0, 8) })}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {interpolate(t.billing.statusLabel, { status: sub.status })}
                    {sub.current_period_end && (
                      <> · {interpolate(t.billing.renewsLabel, { date: new Date(sub.current_period_end).toLocaleDateString() })}</>
                    )}
                    {sub.cancel_at_period_end && (
                      <span className="ml-2 text-amber-600"> {t.billing.cancelsAtPeriodEnd}</span>
                    )}
                  </p>
                </div>
                {!sub.cancel_at_period_end && (
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={() => cancelSubscription(sub.subscription_id)}
                    disabled={cancellingId === sub.subscription_id}
                  >
                    <Icon name="cancel" className="mr-1.5 icon-sm" />{cancellingId === sub.subscription_id ? t.billing.cancellingButton : t.billing.cancelButton}
                  </Button>
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {subscriptions.filter((s) => s.status !== "active" && s.status !== "trialing").length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>{t.billing.pastSubscriptionsTitle}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {subscriptions
              .filter((s) => s.status !== "active" && s.status !== "trialing")
              .map((sub) => (
                <div
                  key={sub.subscription_id}
                  className="flex items-center justify-between rounded-lg border border-border p-3 opacity-60"
                >
                  <div>
                    <p className="text-sm text-muted-foreground">
                      {interpolate(t.billing.creatorLabel, { creatorId: sub.creator_user_id.slice(0, 8) })}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {interpolate(t.billing.statusLabel, { status: sub.status })}
                    </p>
                  </div>
                </div>
              ))}
          </CardContent>
        </Card>
      )}

      <Button variant="ghost" size="sm" asChild>
        <Link href="/feed"><Icon name="arrow_back" className="mr-1.5 icon-sm" />{t.billing.backToFeed}</Link>
      </Button>
    </Page>
  );
}
