"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ApiError } from "@zinovia/contracts";
import {
  CreatorsService,
  type CreatorProfileUpdate,
} from "@/features/creators/api";
import { BillingService, type CreatorPlanOut } from "@/features/billing/api";
import { CreatorAvatarAsset } from "@/features/creators/components/CreatorAvatarAsset";
import { ImageUploadField } from "@/features/media/ImageUploadField";
import { Page } from "@/components/brand/Page";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/components/ui/toast";
import { Skeleton } from "@/components/ui/skeleton";
import { getApiErrorMessage } from "@/lib/errors";
import { useRequireRole } from "@/lib/hooks/useRequireRole";
import { MediaService } from "@/features/media/api";
import "@/lib/api";

/** Renders a single banner asset by signed URL (used for profile banner preview). */
function BannerPreview({ assetId }: { assetId: string }) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    MediaService.mediaDownloadUrl(assetId)
      .then((res) => {
        if (!cancelled && res.download_url) setUrl(res.download_url);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [assetId]);
  if (!url) return <div className="h-24 w-full animate-pulse bg-muted" aria-hidden />;
  return <img src={url} alt="" className="h-full w-full object-cover" />;
}

const PROFILE_ERROR_MESSAGES: Record<string, string> = {
  handle_taken: "That handle is already taken. Choose another.",
  handle_length_invalid: "Handle must be between 2 and 64 characters.",
  handle_format_invalid:
    "Handle can only use letters, numbers, hyphens and underscores (e.g. my-handle_1).",
  handle_reserved: "That handle is reserved.",
  profile_not_found: "Profile not found. Please try again.",
};

export default function SettingsProfilePage() {
  const { authorized } = useRequireRole(["creator", "admin"]);
  const router = useRouter();
  const { addToast } = useToast();
  const [handle, setHandle] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [bio, setBio] = useState("");
  const [discoverable, setDiscoverable] = useState(true);
  const [nsfw, setNsfw] = useState(false);
  const [avatarMediaId, setAvatarMediaId] = useState<string | null>(null);
  const [bannerMediaId, setBannerMediaId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [prefillStatus, setPrefillStatus] = useState<"loading" | "ok" | "error">("loading");

  // Subscription pricing state
  const [plan, setPlan] = useState<CreatorPlanOut | null>(null);
  const [subscriptionPrice, setSubscriptionPrice] = useState("");
  const [priceLoading, setPriceLoading] = useState(false);

  useEffect(() => {
    CreatorsService.creatorsGetMe()
      .then((profile) => {
        setHandle(profile.handle ?? "");
        setDisplayName(profile.display_name ?? "");
        setBio(profile.bio ?? "");
        setDiscoverable(profile.discoverable ?? true);
        setNsfw(profile.nsfw ?? false);
        setAvatarMediaId(profile.avatar_media_id ?? null);
        setBannerMediaId(profile.banner_media_id ?? null);
        setPrefillStatus("ok");
      })
      .catch((err) => {
        if (err instanceof ApiError && err.status === 401) {
          router.replace("/login?next=/settings/profile");
          return;
        }
        setPrefillStatus("error");
      });
    BillingService.billingGetPlan()
      .then((p) => {
        setPlan(p);
        setSubscriptionPrice(p.price);
      })
      .catch(() => {});
  }, [router]);

  const onPriceSave = async () => {
    setPriceLoading(true);
    try {
      const updated = await BillingService.billingUpdatePlan({ price: subscriptionPrice });
      setPlan(updated);
      setSubscriptionPrice(updated.price);
      addToast("Subscription price updated", "success");
    } catch (err) {
      const { message } = getApiErrorMessage(err);
      addToast(message, "error");
    } finally {
      setPriceLoading(false);
    }
  };

  const onSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setLoading(true);
    const payload: CreatorProfileUpdate = {
      handle: handle.trim() || undefined,
      display_name: displayName || undefined,
      bio: bio || undefined,
      discoverable,
      nsfw,
      avatar_media_id: avatarMediaId ?? undefined,
      banner_media_id: bannerMediaId ?? undefined,
    };
    try {
      await CreatorsService.creatorsUpdateMe(payload);
      addToast("Profile saved", "success");
    } catch (err) {
      if (err instanceof ApiError && err.status === 403) {
        addToast("Creator-only. Set up your account as a creator to edit profile.", "error");
        return;
      }
      const { message } = getApiErrorMessage(err);
      let detail = "";
      if (err instanceof ApiError && err.body && typeof err.body === "object" && "detail" in err.body) {
        const d = (err.body as { detail?: unknown }).detail;
        if (Array.isArray(d) && d.length > 0 && d[0] && typeof d[0] === "object" && "msg" in d[0]) {
          detail = String((d[0] as { msg?: string }).msg);
        } else {
          detail = String(d);
        }
      }
      const friendly =
        detail && PROFILE_ERROR_MESSAGES[detail] ? PROFILE_ERROR_MESSAGES[detail] : detail || message;
      addToast(friendly, "error");
    } finally {
      setLoading(false);
    }
  };

  if (!authorized) return null;

  if (prefillStatus === "loading") {
    return (
      <Page>
        <h1 className="font-display text-premium-h2 font-semibold text-foreground">Creator profile</h1>
        <Card className="mt-4">
          <CardHeader>
            <Skeleton className="h-6 w-32" />
            <Skeleton className="h-4 w-64" />
          </CardHeader>
          <CardContent className="space-y-4">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-20 w-full" />
          </CardContent>
        </Card>
      </Page>
    );
  }

  return (
    <Page className="space-y-4">
      <h1 className="font-display text-premium-h2 font-semibold text-foreground">Creator profile</h1>
      {prefillStatus === "error" && (
        <p className="mt-2 text-sm text-muted-foreground">
          Creator-only. Set up your account as a creator to edit profile.
        </p>
      )}
      <Card className="mt-4">
        <CardHeader>
          <CardTitle>Profile details</CardTitle>
          <CardDescription>Control your public presence and trust signals.</CardDescription>
        </CardHeader>
        <CardContent>
          <form className="space-y-6" onSubmit={onSubmit}>
            <div className="space-y-2 rounded-premium-lg border border-border bg-surface-alt p-4">
              <Label>Profile photo (avatar)</Label>
              <div className="flex flex-wrap items-center gap-4">
                {avatarMediaId && (
                  <CreatorAvatarAsset
                    assetId={avatarMediaId}
                    displayName={displayName}
                    size="lg"
                    withRing
                    className="shrink-0"
                  />
                )}
                <div className="flex flex-wrap items-center gap-2">
                  <ImageUploadField
                    onUploadComplete={(assetId) => setAvatarMediaId(assetId)}
                    disabled={loading}
                  />
                  <Button variant="secondary" size="sm" asChild>
                    <Link href="/ai/images/new?apply=creator.avatar">
                      Generate with AI
                    </Link>
                  </Button>
                </div>
              </div>
            </div>
            <div className="space-y-2 rounded-premium-lg border border-border bg-surface-alt p-4">
              <Label>Banner image</Label>
              <p className="text-xs text-muted-foreground">
                Shown at the top of your creator profile (e.g. 1500×500).
              </p>
              {bannerMediaId && (
                <div className="mt-2 max-h-32 w-full max-w-2xl overflow-hidden rounded-brand border border-border bg-muted">
                  <BannerPreview assetId={bannerMediaId} />
                </div>
              )}
              <div className="flex flex-wrap items-center gap-2">
                <ImageUploadField
                  onUploadComplete={(assetId) => setBannerMediaId(assetId)}
                  disabled={loading}
                />
                <Button variant="secondary" size="sm" asChild>
                  <Link href="/ai/images/new?apply=creator.banner">
                    Generate with AI
                  </Link>
                </Button>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="handle">Handle</Label>
              <Input
                id="handle"
                type="text"
                value={handle}
                onChange={(e) => setHandle(e.target.value)}
                placeholder="your-handle"
              />
              <p className="text-xs text-muted-foreground">
                Unique URL handle (e.g. /creators/your-handle).
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="displayName">Display name</Label>
              <Input
                id="displayName"
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="Display name"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="bio">Bio</Label>
              <Textarea
                id="bio"
                rows={3}
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                placeholder="Short bio"
              />
            </div>
            <div className="flex items-center justify-between rounded-brand border border-border bg-surface-alt p-4">
              <div>
                <Label htmlFor="discoverable" className="text-base">
                  Discoverable
                </Label>
                <p className="text-sm text-muted-foreground">
                  Show your profile in discovery and feed.
                </p>
                {!handle.trim() && (
                  <p className="mt-1 text-xs text-amber-600">
                    A handle is required to appear in discovery. Set one above.
                  </p>
                )}
              </div>
              <Switch
                id="discoverable"
                checked={discoverable}
                onCheckedChange={setDiscoverable}
                disabled={!handle.trim()}
              />
            </div>
            <div className="flex items-center justify-between rounded-brand border border-border bg-surface-alt p-4">
              <div>
                <Label htmlFor="nsfw" className="text-base">
                  NSFW
                </Label>
                <p className="text-sm text-muted-foreground">
                  Mark your profile as adult content.
                </p>
              </div>
              <Switch id="nsfw" checked={nsfw} onCheckedChange={setNsfw} />
            </div>
            <Button type="submit" disabled={loading}>
              {loading ? "Saving…" : "Save"}
            </Button>
          </form>
        </CardContent>
      </Card>
      {plan && (
        <Card>
          <CardHeader>
            <CardTitle>Subscription pricing</CardTitle>
            <CardDescription>
              Set your monthly subscription price. Platform fee: {plan.platform_fee_percent}%.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="subscriptionPrice">
                Monthly price ({plan.currency.toUpperCase()})
              </Label>
              <div className="flex items-center gap-3">
                <Input
                  id="subscriptionPrice"
                  type="number"
                  step="0.01"
                  min={(plan.min_price_cents / 100).toFixed(2)}
                  max={(plan.max_price_cents / 100).toFixed(2)}
                  value={subscriptionPrice}
                  onChange={(e) => setSubscriptionPrice(e.target.value)}
                  className="max-w-[160px]"
                />
                <Button
                  size="sm"
                  onClick={onPriceSave}
                  disabled={priceLoading || subscriptionPrice === plan.price}
                >
                  {priceLoading ? "Saving..." : "Update price"}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Min {(plan.min_price_cents / 100).toFixed(2)} {plan.currency.toUpperCase()} — Max{" "}
                {(plan.max_price_cents / 100).toFixed(2)} {plan.currency.toUpperCase()}.
                Existing subscribers keep their current rate until renewal.
              </p>
            </div>
          </CardContent>
        </Card>
      )}
      <div className="mt-4 flex gap-2">
        <Button variant="secondary" size="sm" asChild>
          <Link href="/settings/security">Change password</Link>
        </Button>
        <Button variant="ghost" size="sm" asChild>
          <Link href="/">Back to home</Link>
        </Button>
      </div>
    </Page>
  );
}
