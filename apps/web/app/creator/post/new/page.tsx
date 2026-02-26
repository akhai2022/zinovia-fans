"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRequireRole } from "@/lib/hooks/useRequireRole";
import { Icon } from "@/components/ui/icon";
import { Spinner } from "@/components/ui/spinner";
import { PostsService, type PostCreate } from "@/features/posts/api";
import { ImageUploadField } from "@/features/media/ImageUploadField";
import { VideoUploadField } from "@/features/media/VideoUploadField";
import { Page } from "@/components/brand/Page";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { useToast } from "@/components/ui/toast";
import { listVaultMedia, type MediaMineItem } from "@/features/engagement/api";
import { CaptionSuggestions } from "@/features/posts/components/CaptionSuggestions";
import { AiToolSuggestions } from "@/features/ai-tools/AiToolSuggestions";
import { PromoSuggestions } from "@/features/posts/components/PromoSuggestions";
import { TranslatePanel } from "@/features/posts/components/TranslatePanel";
import { useTranslation, interpolate } from "@/lib/i18n";
import "@/lib/api";

export interface UploadedImage {
  assetId: string;
  previewUrl: string | null;
}

const VISIBILITY_ICONS = {
  PUBLIC: "public",
  FOLLOWERS: "group",
  SUBSCRIBERS: "workspace_premium",
  PPV: "lock",
} as const;

export default function NewPostPage() {
  const { authorized } = useRequireRole(["creator", "admin", "super_admin"]);
  const router = useRouter();
  const { addToast } = useToast();
  const { t } = useTranslation();

  const VISIBILITY_OPTIONS = [
    { value: "PUBLIC" as const, label: t.newPost.visibilityPublicLabel, description: t.newPost.visibilityPublicDescription, icon: VISIBILITY_ICONS.PUBLIC },
    { value: "FOLLOWERS" as const, label: t.newPost.visibilityFollowersLabel, description: t.newPost.visibilityFollowersDescription, icon: VISIBILITY_ICONS.FOLLOWERS },
    { value: "SUBSCRIBERS" as const, label: t.newPost.visibilitySubscribersLabel, description: t.newPost.visibilitySubscribersDescription, icon: VISIBILITY_ICONS.SUBSCRIBERS },
    { value: "PPV" as const, label: t.newPost.visibilityPpvLabel, description: t.newPost.visibilityPpvDescription, icon: VISIBILITY_ICONS.PPV },
  ];

  const [caption, setCaption] = useState("");
  const [visibility, setVisibility] = useState<"PUBLIC" | "FOLLOWERS" | "SUBSCRIBERS" | "PPV">("PUBLIC");
  const [priceCents, setPriceCents] = useState<number>(500);
  const [nsfw, setNsfw] = useState(false);
  const [uploadedImages, setUploadedImages] = useState<UploadedImage[]>([]);
  const [videoAssetId, setVideoAssetId] = useState<string | null>(null);
  const [assetIdsInput, setAssetIdsInput] = useState("");
  const [showManualIds, setShowManualIds] = useState(false);
  const [status, setStatus] = useState<"idle" | "loading" | "error" | "ok">("idle");
  const [errorDetail, setErrorDetail] = useState<string | null>(null);
  const [scheduleEnabled, setScheduleEnabled] = useState(false);
  const [publishAt, setPublishAt] = useState("");
  const [vaultItems, setVaultItems] = useState<MediaMineItem[]>([]);
  const [vaultLoading, setVaultLoading] = useState(false);
  const [vaultSelection, setVaultSelection] = useState<string[]>([]);
  const [mediaTab, setMediaTab] = useState("images");

  // Scroll to hash anchor (e.g. #promo, #translate) on mount
  useEffect(() => {
    const hash = window.location.hash.slice(1);
    if (hash) {
      setTimeout(() => {
        document.getElementById(hash)?.scrollIntoView({ behavior: "smooth", block: "center" });
      }, 300);
    }
  }, []);

  const hasMedia = uploadedImages.length > 0 || videoAssetId || vaultSelection.length > 0;

  const detectedType = videoAssetId
    ? "VIDEO"
    : uploadedImages.length > 0 || vaultSelection.length > 0
      ? "IMAGE"
      : "TEXT";

  const handleImageUpload = (assetId: string, previewUrl?: string | null) => {
    setUploadedImages((prev) => [...prev, { assetId, previewUrl: previewUrl ?? null }]);
  };

  const removeUploadedImage = (index: number) => {
    setUploadedImages((prev) => prev.filter((_, i) => i !== index));
  };

  const removeVideo = () => {
    setVideoAssetId(null);
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus("loading");
    setErrorDetail(null);
    const manualIds = assetIdsInput
      .split(/[\s,]+/)
      .map((s) => s.trim())
      .filter(Boolean);
    const fromUpload = uploadedImages.map((u) => u.assetId);
    const imageAssetIds = [...fromUpload, ...manualIds, ...vaultSelection];
    const videoIds = videoAssetId ? [videoAssetId] : [];
    let finalType: "TEXT" | "IMAGE" | "VIDEO" = "TEXT";
    if (videoIds.length > 0) {
      finalType = "VIDEO";
    } else if (imageAssetIds.length > 0) {
      finalType = "IMAGE";
    }
    const assetIds = finalType === "VIDEO" ? videoIds : imageAssetIds;
    const body: PostCreate & { publish_at?: string | null } = {
      type: finalType,
      caption: caption || null,
      visibility,
      nsfw,
      asset_ids: assetIds,
      publish_at: scheduleEnabled && publishAt ? new Date(publishAt).toISOString() : null,
      ...(visibility === "PPV" ? { price_cents: priceCents } : {}),
    };
    try {
      await PostsService.postsCreate(body);
      setStatus("ok");
      addToast(t.newPost.toastPostCreatedSuccess, "success");
      router.push("/feed");
    } catch (err: unknown) {
      setStatus("error");
      setErrorDetail(err instanceof Error ? err.message : t.newPost.errorFallback);
      addToast(t.newPost.toastPostCreatedError, "error");
    }
  };

  const loadVault = async () => {
    setVaultLoading(true);
    try {
      const res = await listVaultMedia(undefined, "image");
      setVaultItems(res.items);
    } finally {
      setVaultLoading(false);
    }
  };

  const toggleVaultItem = (itemId: string) => {
    setVaultSelection((prev) =>
      prev.includes(itemId)
        ? prev.filter((id) => id !== itemId)
        : [...prev, itemId]
    );
  };

  if (!authorized) return null;

  return (
    <Page>
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/feed">
            <Icon name="arrow_back" className="mr-1 icon-base" />
            {t.newPost.back}
          </Link>
        </Button>
        <div className="h-6 w-px bg-border" />
        <h1 className="font-display text-premium-h2 font-semibold text-foreground">
          {t.newPost.title}
        </h1>
      </div>

      <form onSubmit={onSubmit} className="space-y-5">
        {/* Caption */}
        <Card>
          <CardContent className="p-5">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label htmlFor="caption" className="text-base font-medium">
                  {t.newPost.captionLabel}
                </Label>
                {caption.length > 0 && (
                  <span className="text-xs text-muted-foreground">
                    {interpolate(t.newPost.captionCharacterCount, { count: caption.length })}
                  </span>
                )}
              </div>
              <Textarea
                id="caption"
                rows={4}
                value={caption}
                onChange={(e) => setCaption(e.target.value)}
                placeholder={t.newPost.captionPlaceholder}
                className="resize-none"
              />
              {uploadedImages.length > 0 && (
                <>
                  <CaptionSuggestions
                    mediaAssetId={uploadedImages[0]?.assetId ?? null}
                    onSelect={(text) => setCaption(text)}
                  />
                  <AiToolSuggestions
                    mediaAssetId={uploadedImages[0]?.assetId ?? null}
                  />
                </>
              )}
            </div>
          </CardContent>
        </Card>

        {/* AI Promo Suggestions */}
        <div id="promo">
          <PromoSuggestions
            postId={null}
            caption={caption}
            onInsertCaption={(text) => setCaption(text)}
          />
        </div>

        {/* AI Translation */}
        <div id="translate">
          <TranslatePanel postId={null} caption={caption} />
        </div>

        {/* Media */}
        <Card>
          <CardContent className="p-5">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <Label className="text-base font-medium">{t.newPost.mediaLabel}</Label>
                {hasMedia && (
                  <Badge variant={detectedType === "VIDEO" ? "accent" : detectedType === "IMAGE" ? "primary" : "neutral"}>
                    {detectedType}
                  </Badge>
                )}
              </div>

              <Tabs value={mediaTab} onValueChange={setMediaTab}>
                <TabsList className="w-full justify-start gap-1">
                  <TabsTrigger value="images">
                    <span className="flex items-center gap-1.5">
                      <Icon name="add_photo_alternate" className="icon-sm" />
                      {t.newPost.tabImages}
                    </span>
                  </TabsTrigger>
                  <TabsTrigger value="video">
                    <span className="flex items-center gap-1.5">
                      <Icon name="videocam" className="icon-sm" />
                      {t.newPost.tabVideo}
                    </span>
                  </TabsTrigger>
                  <TabsTrigger value="vault">
                    <span className="flex items-center gap-1.5">
                      <Icon name="folder_open" className="icon-sm" />
                      {t.newPost.tabVault}
                    </span>
                  </TabsTrigger>
                </TabsList>

                {/* Images tab */}
                <TabsContent value="images">
                  <div className="space-y-3">
                    {uploadedImages.length > 0 && (
                      <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-5">
                        {uploadedImages.map((img, index) => (
                          <div
                            key={img.assetId}
                            className="group relative aspect-square overflow-hidden rounded-lg border border-border bg-surface-alt"
                          >
                            {img.previewUrl ? (
                              <img
                                src={img.previewUrl}
                                alt=""
                                className="h-full w-full object-cover"
                              />
                            ) : (
                              <div className="flex h-full w-full items-center justify-center">
                                <Icon name="add_photo_alternate" className="icon-lg text-muted-foreground" />
                              </div>
                            )}
                            <button
                              type="button"
                              onClick={() => removeUploadedImage(index)}
                              className="absolute right-1 top-1 flex h-6 w-6 items-center justify-center rounded-full bg-black/70 text-white sm:opacity-0 transition-opacity sm:group-hover:opacity-100"
                              aria-label={interpolate(t.newPost.removeImageAriaLabel, { index: index + 1 })}
                            >
                              <Icon name="close" className="icon-sm" />
                            </button>
                            <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/40 to-transparent p-1 sm:opacity-0 transition-opacity sm:group-hover:opacity-100">
                              <span className="text-[10px] text-white font-medium">
                                {index + 1} / {uploadedImages.length}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                    {uploadedImages.length < 20 ? (
                      <ImageUploadField
                        onUploadComplete={handleImageUpload}
                        allowMultiple
                        disabled={status === "loading"}
                      />
                    ) : (
                      <p className="text-sm text-muted-foreground">
                        {t.newPost.maxImagesReached}
                      </p>
                    )}
                    {uploadedImages.length === 0 && (
                      <p className="text-xs text-muted-foreground">
                        {t.newPost.imageFormatHint}
                      </p>
                    )}
                  </div>
                </TabsContent>

                {/* Video tab */}
                <TabsContent value="video">
                  <div className="space-y-3">
                    {videoAssetId ? (
                      <div className="flex items-center gap-3 rounded-brand border border-border bg-surface-alt p-4">
                        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
                          <Icon name="videocam" className="icon-md text-primary" />
                        </div>
                        <div className="flex-1">
                          <p className="text-sm font-medium text-foreground">
                            {t.newPost.videoUploaded}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {t.newPost.videoReady}
                          </p>
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={removeVideo}
                        >
                          <Icon name="close" className="mr-1 icon-sm" />
                          {t.newPost.removeButton}
                        </Button>
                      </div>
                    ) : (
                      <VideoUploadField
                        onUploadComplete={(id) => setVideoAssetId(id)}
                        disabled={status === "loading"}
                      />
                    )}
                    {!videoAssetId && (
                      <p className="text-xs text-muted-foreground">
                        {t.newPost.videoFormatHint}
                      </p>
                    )}
                  </div>
                </TabsContent>

                {/* Vault tab */}
                <TabsContent value="vault">
                  <div className="space-y-3">
                    {vaultItems.length === 0 && (
                      <div className="flex flex-col items-center justify-center rounded-brand border border-dashed border-border py-8">
                        <Icon name="folder_open" className="icon-xl text-muted-foreground mb-2" />
                        <p className="text-sm text-muted-foreground mb-3">
                          {t.newPost.vaultEmptyPrompt}
                        </p>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={loadVault}
                          disabled={vaultLoading}
                        >
                          {vaultLoading ? (
                            <>
                              <Spinner className="mr-1.5 icon-sm" />
                              {t.newPost.vaultLoading}
                            </>
                          ) : (
                            <><Icon name="folder_open" className="mr-1.5 icon-sm" />{t.newPost.vaultLoadButton}</>
                          )}
                        </Button>
                      </div>
                    )}
                    {vaultItems.length > 0 && (
                      <>
                        <div className="flex items-center justify-between">
                          <p className="text-xs text-muted-foreground">
                            {vaultSelection.length > 0
                              ? interpolate(t.newPost.vaultSelectedCount, { count: vaultSelection.length })
                              : t.newPost.vaultTapToSelect}
                          </p>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={loadVault}
                            disabled={vaultLoading}
                          >
                            {vaultLoading ? (
                              <Spinner className="icon-sm" />
                            ) : (
                              t.newPost.vaultRefreshButton
                            )}
                          </Button>
                        </div>
                        <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                          {vaultItems.map((item) => {
                            const selected = vaultSelection.includes(item.id);
                            return (
                              <button
                                key={item.id}
                                type="button"
                                onClick={() => toggleVaultItem(item.id)}
                                className={`relative aspect-square overflow-hidden rounded-lg border-2 transition-all ${
                                  selected
                                    ? "border-primary ring-2 ring-primary/20"
                                    : "border-border hover:border-muted-foreground"
                                }`}
                              >
                                <div className="flex h-full w-full flex-col items-center justify-center bg-surface-alt p-2">
                                  <Icon name="description" className="icon-md text-muted-foreground mb-1" />
                                  <span className="text-[10px] text-muted-foreground truncate w-full text-center">
                                    {item.id.slice(0, 8)}
                                  </span>
                                  <span className="text-[10px] text-muted-foreground">
                                    {new Date(item.created_at).toLocaleDateString()}
                                  </span>
                                </div>
                                {selected && (
                                  <div className="absolute inset-0 flex items-center justify-center bg-primary/10">
                                    <div className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-white text-xs font-bold">
                                      {vaultSelection.indexOf(item.id) + 1}
                                    </div>
                                  </div>
                                )}
                              </button>
                            );
                          })}
                        </div>
                      </>
                    )}
                  </div>
                </TabsContent>
              </Tabs>

              {/* Manual asset IDs (advanced) */}
              <div className="pt-2 border-t border-border">
                <button
                  type="button"
                  onClick={() => setShowManualIds((v) => !v)}
                  className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                >
                  {showManualIds ? t.newPost.manualAssetIdsHideLabel : t.newPost.manualAssetIdsShowLabel}
                </button>
                {showManualIds && (
                  <div className="mt-2 space-y-1.5">
                    <Input
                      id="assetIds"
                      type="text"
                      placeholder={t.newPost.manualAssetIdsPlaceholder}
                      value={assetIdsInput}
                      onChange={(e) => setAssetIdsInput(e.target.value)}
                    />
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Post settings */}
        <Card>
          <CardContent className="p-5">
            <div className="space-y-5">
              <Label className="text-base font-medium">{t.newPost.postSettingsLabel}</Label>

              {/* Visibility */}
              <div className="space-y-2">
                <Label className="text-sm text-muted-foreground">{t.newPost.visibilityLabel}</Label>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  {VISIBILITY_OPTIONS.map((opt) => {
                    const active = visibility === opt.value;
                    return (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => setVisibility(opt.value)}
                        className={`flex flex-col items-center gap-1.5 rounded-brand border-2 px-3 py-3 text-center transition-all ${
                          active
                            ? "border-primary bg-primary/5 text-foreground"
                            : "border-border bg-surface-alt text-muted-foreground hover:border-muted-foreground hover:text-foreground"
                        }`}
                      >
                        <Icon name={opt.icon} className={`icon-md ${active ? "text-primary" : ""}`} />
                        <span className="text-xs font-medium">{opt.label}</span>
                      </button>
                    );
                  })}
                </div>
                <p className="text-xs text-muted-foreground">
                  {VISIBILITY_OPTIONS.find((o) => o.value === visibility)?.description}
                </p>
              </div>

              {/* PPV pricing */}
              {visibility === "PPV" && (
                <div className="rounded-brand border border-border bg-surface-alt p-4 space-y-2">
                  <Label htmlFor="ppv-price" className="text-sm font-medium">
                    {t.newPost.unlockPriceLabel}
                  </Label>
                  <div className="flex items-center gap-2">
                    <Input
                      id="ppv-price"
                      type="number"
                      min={1}
                      max={200}
                      step={0.5}
                      value={(priceCents / 100).toFixed(2)}
                      onChange={(e) => setPriceCents(Math.round(parseFloat(e.target.value || "0") * 100))}
                      className="w-28"
                    />
                    <span className="text-sm font-medium text-muted-foreground">{t.newPost.unlockPriceCurrency}</span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {t.newPost.unlockPriceDescription}
                  </p>
                </div>
              )}

              {/* NSFW toggle */}
              <div className="flex items-center justify-between rounded-brand border border-border p-4">
                <div className="flex items-center gap-3">
                  <Icon name="gpp_maybe" className="icon-md text-muted-foreground" />
                  <div>
                    <Label htmlFor="nsfw" className="text-sm font-medium cursor-pointer">
                      {t.newPost.nsfwLabel}
                    </Label>
                    <p className="text-xs text-muted-foreground">
                      {t.newPost.nsfwDescription}
                    </p>
                  </div>
                </div>
                <Switch id="nsfw" checked={nsfw} onCheckedChange={setNsfw} />
              </div>

              {/* Schedule */}
              <div className="rounded-brand border border-border p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Icon name="calendar_today" className="icon-md text-muted-foreground" />
                    <div>
                      <Label htmlFor="schedule" className="text-sm font-medium cursor-pointer">
                        {t.newPost.scheduleLabel}
                      </Label>
                      <p className="text-xs text-muted-foreground">
                        {t.newPost.scheduleDescription}
                      </p>
                    </div>
                  </div>
                  <Switch id="schedule" checked={scheduleEnabled} onCheckedChange={setScheduleEnabled} />
                </div>
                {scheduleEnabled && (
                  <Input
                    type="datetime-local"
                    value={publishAt}
                    onChange={(e) => setPublishAt(e.target.value)}
                    className="mt-2"
                  />
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Preview summary */}
        {(caption || hasMedia) && (
          <Card variant="glass">
            <CardContent className="p-4">
              <div className="flex items-start gap-3">
                <Icon name="visibility" className="mt-0.5 icon-base text-muted-foreground shrink-0" />
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-medium text-muted-foreground mb-1">
                    {t.newPost.postPreviewLabel}
                  </p>
                  <div className="flex flex-wrap items-center gap-1.5">
                    <Badge variant={detectedType === "VIDEO" ? "accent" : detectedType === "IMAGE" ? "primary" : "neutral"}>
                      {detectedType}
                    </Badge>
                    <Badge variant={visibility === "PPV" ? "subscriber" : visibility === "SUBSCRIBERS" ? "subscriber" : "neutral"}>
                      {visibility === "PPV" ? interpolate(t.newPost.previewPpvPrice, { price: (priceCents / 100).toFixed(2) }) : visibility}
                    </Badge>
                    {nsfw && <Badge variant="nsfw">{t.newPost.previewNsfwBadge}</Badge>}
                    {scheduleEnabled && publishAt && (
                      <Badge variant="neutral">
                        {t.newPost.previewScheduledBadge}
                      </Badge>
                    )}
                  </div>
                  {caption && (
                    <p className="mt-2 text-sm text-foreground line-clamp-2 break-words">
                      {caption}
                    </p>
                  )}
                  {hasMedia && (
                    <p className="mt-1 text-xs text-muted-foreground">
                      {detectedType === "VIDEO"
                        ? t.newPost.previewVideoCount
                        : interpolate(
                            uploadedImages.length + vaultSelection.length !== 1
                              ? t.newPost.previewImageCountPlural
                              : t.newPost.previewImageCount,
                            { count: uploadedImages.length + vaultSelection.length }
                          )}
                    </p>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Error */}
        {status === "error" && errorDetail && (
          <div className="rounded-brand border border-destructive/30 bg-destructive/5 px-4 py-3">
            <p className="text-sm text-destructive">{errorDetail}</p>
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center gap-3 pt-1">
          <Button type="submit" disabled={status === "loading"} className="min-w-[140px]">
            {status === "loading" ? (
              <>
                <Spinner className="mr-2 icon-base" />
                {t.newPost.creatingButton}
              </>
            ) : scheduleEnabled && publishAt ? (
              <><Icon name="schedule_send" className="mr-1.5 icon-sm" />{t.newPost.schedulePostButton}</>
            ) : (
              <><Icon name="send" className="mr-1.5 icon-sm" />{t.newPost.publishPostButton}</>
            )}
          </Button>
          <Button variant="outline" asChild>
            <Link href="/feed"><Icon name="close" className="mr-1.5 icon-sm" />{t.newPost.cancelButton}</Link>
          </Button>
        </div>
      </form>
    </Page>
  );
}
