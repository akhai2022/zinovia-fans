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
import { getApiErrorCode, getApiErrorMessage } from "@/lib/errors";
import { useRequireRole } from "@/lib/hooks/useRequireRole";
import { MediaService } from "@/features/media/api";
import { useTranslation, interpolate, getCountryName } from "@/lib/i18n";
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

const COUNTRY_CODES = [
  "FR", "US", "GB", "DE", "ES", "IT", "PT", "NL", "BE", "CH", "AT", "CA",
  "AU", "JP", "BR", "MX", "IN", "SE", "NO", "DK", "FI", "PL", "IE", "RO",
  "CZ", "GR", "HU", "HR", "BG", "SK", "SI", "LT", "LV", "EE", "CY", "LU",
  "MT", "NZ", "SG", "KR", "AE", "ZA", "AR", "CL", "CO", "TH", "MY", "PH",
  "IL", "TR", "MA", "TN", "DZ",
];

export default function SettingsProfilePage() {
  const { authorized } = useRequireRole(["creator", "admin", "super_admin"]);
  const { t, locale } = useTranslation();
  const router = useRouter();
  const { addToast } = useToast();

  const PROFILE_ERROR_MESSAGES: Record<string, string> = {
    handle_taken: t.profile.errorHandleTaken,
    handle_length_invalid: t.profile.errorHandleLengthInvalid,
    handle_format_invalid: t.profile.errorHandleFormatInvalid,
    handle_reserved: t.profile.errorHandleReserved,
    profile_not_found: t.profile.errorProfileNotFound,
    profile_incomplete: t.profile.errorProfileIncomplete,
    kyc_required: t.profile.errorKycRequired,
  };
  const [handle, setHandle] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [bio, setBio] = useState("");
  const [phone, setPhone] = useState("");
  const [country, setCountry] = useState("");
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
        setPhone(profile.phone ?? "");
        setCountry(profile.country ?? "");
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
      addToast(t.profile.toastSubscriptionPriceUpdated, "success");
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
    if (!avatarMediaId) {
      addToast(t.profile.avatarRequiredToast, "error");
      setLoading(false);
      return;
    }
    const payload: CreatorProfileUpdate = {
      handle: handle.trim() || undefined,
      display_name: displayName || undefined,
      bio: bio || undefined,
      phone: phone.trim() || undefined,
      country: country.trim().toUpperCase() || undefined,
      discoverable,
      nsfw,
      avatar_media_id: avatarMediaId ?? undefined,
      banner_media_id: bannerMediaId ?? undefined,
    };
    try {
      await CreatorsService.creatorsUpdateMe(payload);
      addToast(t.profile.toastProfileSaved, "success");
    } catch (err) {
      const code = getApiErrorCode(err);
      if (err instanceof ApiError && err.status === 403) {
        const friendly = PROFILE_ERROR_MESSAGES[code] || t.profile.errorCreatorOnly;
        addToast(friendly, "error");
        return;
      }
      const { message } = getApiErrorMessage(err);
      const friendly = PROFILE_ERROR_MESSAGES[code] || message;
      addToast(friendly, "error");
    } finally {
      setLoading(false);
    }
  };

  if (!authorized) return null;

  if (prefillStatus === "loading") {
    return (
      <Page>
        <h1 className="font-display text-premium-h2 font-semibold text-foreground">{t.profile.title}</h1>
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
      <h1 className="font-display text-premium-h2 font-semibold text-foreground">{t.profile.title}</h1>
      {prefillStatus === "error" && (
        <p className="mt-2 text-sm text-muted-foreground">
          {t.profile.errorCreatorOnly}
        </p>
      )}
      <Card className="mt-4">
        <CardHeader>
          <CardTitle>{t.profile.profileDetailsTitle}</CardTitle>
          <CardDescription>{t.profile.profileDetailsDescription}</CardDescription>
        </CardHeader>
        <CardContent>
          <form className="space-y-6" onSubmit={onSubmit}>
            <div className="space-y-2 rounded-premium-lg border border-border bg-surface-alt p-4">
              <Label>{t.profile.avatarLabel} <span className="text-destructive">*</span></Label>
              {!avatarMediaId && (
                <p className="text-xs text-destructive">
                  {t.profile.avatarRequired}
                </p>
              )}
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
                      {t.profile.generateWithAi}
                    </Link>
                  </Button>
                </div>
              </div>
            </div>
            <div className="space-y-2 rounded-premium-lg border border-border bg-surface-alt p-4">
              <Label>{t.profile.bannerLabel}</Label>
              <p className="text-xs text-muted-foreground">
                {t.profile.bannerDescription}
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
                    {t.profile.generateWithAi}
                  </Link>
                </Button>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="handle">{t.profile.handleLabel}</Label>
              <Input
                id="handle"
                type="text"
                value={handle}
                onChange={(e) => setHandle(e.target.value)}
                placeholder={t.profile.handlePlaceholder}
              />
              <p className="text-xs text-muted-foreground">
                {t.profile.handleDescription}
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="displayName">{t.profile.displayNameLabel}</Label>
              <Input
                id="displayName"
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder={t.profile.displayNamePlaceholder}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="bio">{t.profile.bioLabel}</Label>
              <Textarea
                id="bio"
                rows={3}
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                placeholder={t.profile.bioPlaceholder}
              />
            </div>
            <div className="grid gap-6 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="phone">{t.profile.phoneLabel} <span className="text-destructive">*</span></Label>
                <Input
                  id="phone"
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder={t.profile.phonePlaceholder}
                />
                <p className="text-xs text-muted-foreground">
                  {t.profile.phoneDescription}
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="country">{t.profile.countryLabel} <span className="text-destructive">*</span></Label>
                <select
                  id="country"
                  value={country}
                  onChange={(e) => setCountry(e.target.value)}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                >
                  <option value="">{t.profile.countryPlaceholder}</option>
                  {COUNTRY_CODES.map((code) => (
                    <option key={code} value={code}>
                      {getCountryName(code, locale)}
                    </option>
                  ))}
                </select>
                <p className="text-xs text-muted-foreground">
                  {t.profile.countryDescription}
                </p>
              </div>
            </div>
            <div className="flex items-center justify-between rounded-brand border border-border bg-surface-alt p-4">
              <div>
                <Label htmlFor="discoverable" className="text-base">
                  {t.profile.discoverableLabel}
                </Label>
                <p className="text-sm text-muted-foreground">
                  {t.profile.discoverableDescription}
                </p>
                {!handle.trim() && (
                  <p className="mt-1 text-xs text-amber-600">
                    {t.profile.discoverableHandleWarning}
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
                  {t.profile.nsfwLabel}
                </Label>
                <p className="text-sm text-muted-foreground">
                  {t.profile.nsfwDescription}
                </p>
              </div>
              <Switch id="nsfw" checked={nsfw} onCheckedChange={setNsfw} />
            </div>
            <Button type="submit" disabled={loading}>
              {loading ? t.profile.savingButton : t.profile.saveButton}
            </Button>
          </form>
        </CardContent>
      </Card>
      {plan && (
        <Card>
          <CardHeader>
            <CardTitle>{t.profile.subscriptionPricingTitle}</CardTitle>
            <CardDescription>
              {interpolate(t.profile.subscriptionPricingDescription, { percent: String(plan.platform_fee_percent) })}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="subscriptionPrice">
                {interpolate(t.profile.monthlyPriceLabel, { currency: plan.currency.toUpperCase() })}
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
                  {priceLoading ? t.profile.updatePriceSavingButton : t.profile.updatePriceButton}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                {interpolate(t.profile.priceRangeHint, {
                  min: (plan.min_price_cents / 100).toFixed(2),
                  max: (plan.max_price_cents / 100).toFixed(2),
                  currency: plan.currency.toUpperCase(),
                })}
              </p>
            </div>
          </CardContent>
        </Card>
      )}
      <div className="mt-4 flex gap-2">
        <Button variant="secondary" size="sm" asChild>
          <Link href="/settings/security">{t.profile.changePasswordLink}</Link>
        </Button>
        <Button variant="ghost" size="sm" asChild>
          <Link href="/">{t.profile.backToHomeLink}</Link>
        </Button>
      </div>
    </Page>
  );
}
