"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRequireRole } from "@/lib/hooks/useRequireRole";
import {
  ImagePlus,
  Video,
  FolderOpen,
  Globe,
  Users,
  Crown,
  Lock,
  Eye,
  Calendar,
  ShieldAlert,
  X,
  Loader2,
  FileText,
  ArrowLeft,
} from "lucide-react";
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
import "@/lib/api";

export interface UploadedImage {
  assetId: string;
  previewUrl: string | null;
}

const VISIBILITY_OPTIONS = [
  { value: "PUBLIC" as const, label: "Public", description: "Visible to everyone", icon: Globe },
  { value: "FOLLOWERS" as const, label: "Followers", description: "Only your followers", icon: Users },
  { value: "SUBSCRIBERS" as const, label: "Subscribers", description: "Paid subscribers only", icon: Crown },
  { value: "PPV" as const, label: "Pay-per-view", description: "Fans pay to unlock", icon: Lock },
];

export default function NewPostPage() {
  const { authorized } = useRequireRole("creator");
  const router = useRouter();
  const { addToast } = useToast();
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
      addToast("Post created successfully!", "success");
      router.push("/feed");
    } catch (err: unknown) {
      setStatus("error");
      setErrorDetail(err instanceof Error ? err.message : "Failed to create post");
      addToast("Failed to create post", "error");
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
            <ArrowLeft className="mr-1 h-4 w-4" />
            Back
          </Link>
        </Button>
        <div className="h-6 w-px bg-border" />
        <h1 className="font-display text-premium-h2 font-semibold text-foreground">
          Create post
        </h1>
      </div>

      <form onSubmit={onSubmit} className="space-y-5">
        {/* Caption */}
        <Card>
          <CardContent className="p-5">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label htmlFor="caption" className="text-base font-medium">
                  Caption
                </Label>
                {caption.length > 0 && (
                  <span className="text-xs text-muted-foreground">
                    {caption.length} characters
                  </span>
                )}
              </div>
              <Textarea
                id="caption"
                rows={4}
                value={caption}
                onChange={(e) => setCaption(e.target.value)}
                placeholder="What's on your mind? Share something with your fans..."
                className="resize-none"
              />
            </div>
          </CardContent>
        </Card>

        {/* Media */}
        <Card>
          <CardContent className="p-5">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <Label className="text-base font-medium">Media</Label>
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
                      <ImagePlus className="h-3.5 w-3.5" />
                      Images
                    </span>
                  </TabsTrigger>
                  <TabsTrigger value="video">
                    <span className="flex items-center gap-1.5">
                      <Video className="h-3.5 w-3.5" />
                      Video
                    </span>
                  </TabsTrigger>
                  <TabsTrigger value="vault">
                    <span className="flex items-center gap-1.5">
                      <FolderOpen className="h-3.5 w-3.5" />
                      Vault
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
                                <ImagePlus className="h-6 w-6 text-muted-foreground" />
                              </div>
                            )}
                            <button
                              type="button"
                              onClick={() => removeUploadedImage(index)}
                              className="absolute right-1 top-1 flex h-6 w-6 items-center justify-center rounded-full bg-black/70 text-white opacity-0 transition-opacity group-hover:opacity-100"
                              aria-label={`Remove image ${index + 1}`}
                            >
                              <X className="h-3.5 w-3.5" />
                            </button>
                            <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/40 to-transparent p-1 opacity-0 transition-opacity group-hover:opacity-100">
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
                        Maximum of 20 images reached.
                      </p>
                    )}
                    {uploadedImages.length === 0 && (
                      <p className="text-xs text-muted-foreground">
                        JPEG, PNG, WebP, GIF — up to 25 MB each, max 20 images per post.
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
                          <Video className="h-5 w-5 text-primary" />
                        </div>
                        <div className="flex-1">
                          <p className="text-sm font-medium text-foreground">
                            Video uploaded
                          </p>
                          <p className="text-xs text-muted-foreground">
                            Ready to publish
                          </p>
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={removeVideo}
                        >
                          <X className="mr-1 h-3.5 w-3.5" />
                          Remove
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
                        MP4 only — up to 200 MB. One video per post.
                      </p>
                    )}
                  </div>
                </TabsContent>

                {/* Vault tab */}
                <TabsContent value="vault">
                  <div className="space-y-3">
                    {vaultItems.length === 0 && (
                      <div className="flex flex-col items-center justify-center rounded-brand border border-dashed border-border py-8">
                        <FolderOpen className="h-8 w-8 text-muted-foreground mb-2" />
                        <p className="text-sm text-muted-foreground mb-3">
                          Browse your media vault to reuse existing uploads.
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
                              <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                              Loading...
                            </>
                          ) : (
                            "Load vault"
                          )}
                        </Button>
                      </div>
                    )}
                    {vaultItems.length > 0 && (
                      <>
                        <div className="flex items-center justify-between">
                          <p className="text-xs text-muted-foreground">
                            {vaultSelection.length > 0
                              ? `${vaultSelection.length} selected`
                              : "Tap to select"}
                          </p>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={loadVault}
                            disabled={vaultLoading}
                          >
                            {vaultLoading ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : (
                              "Refresh"
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
                                  <FileText className="h-5 w-5 text-muted-foreground mb-1" />
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
                  {showManualIds ? "Hide" : "Advanced:"} manual asset IDs
                </button>
                {showManualIds && (
                  <div className="mt-2 space-y-1.5">
                    <Input
                      id="assetIds"
                      type="text"
                      placeholder="Paste asset UUIDs separated by commas..."
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
              <Label className="text-base font-medium">Post settings</Label>

              {/* Visibility */}
              <div className="space-y-2">
                <Label className="text-sm text-muted-foreground">Visibility</Label>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  {VISIBILITY_OPTIONS.map((opt) => {
                    const active = visibility === opt.value;
                    const Icon = opt.icon;
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
                        <Icon className={`h-4.5 w-4.5 ${active ? "text-primary" : ""}`} />
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
                    Unlock price
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
                    <span className="text-sm font-medium text-muted-foreground">EUR</span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Fans will pay this amount to view the full post content.
                  </p>
                </div>
              )}

              {/* NSFW toggle */}
              <div className="flex items-center justify-between rounded-brand border border-border p-4">
                <div className="flex items-center gap-3">
                  <ShieldAlert className="h-4.5 w-4.5 text-muted-foreground" />
                  <div>
                    <Label htmlFor="nsfw" className="text-sm font-medium cursor-pointer">
                      NSFW content
                    </Label>
                    <p className="text-xs text-muted-foreground">
                      Mark if this post contains adult content
                    </p>
                  </div>
                </div>
                <Switch id="nsfw" checked={nsfw} onCheckedChange={setNsfw} />
              </div>

              {/* Schedule */}
              <div className="rounded-brand border border-border p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Calendar className="h-4.5 w-4.5 text-muted-foreground" />
                    <div>
                      <Label htmlFor="schedule" className="text-sm font-medium cursor-pointer">
                        Schedule post
                      </Label>
                      <p className="text-xs text-muted-foreground">
                        Publish at a future date and time
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
                <Eye className="mt-0.5 h-4 w-4 text-muted-foreground shrink-0" />
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-medium text-muted-foreground mb-1">
                    Post preview
                  </p>
                  <div className="flex flex-wrap items-center gap-1.5">
                    <Badge variant={detectedType === "VIDEO" ? "accent" : detectedType === "IMAGE" ? "primary" : "neutral"}>
                      {detectedType}
                    </Badge>
                    <Badge variant={visibility === "PPV" ? "subscriber" : visibility === "SUBSCRIBERS" ? "subscriber" : "neutral"}>
                      {visibility === "PPV" ? `PPV ${(priceCents / 100).toFixed(2)} EUR` : visibility}
                    </Badge>
                    {nsfw && <Badge variant="nsfw">NSFW</Badge>}
                    {scheduleEnabled && publishAt && (
                      <Badge variant="neutral">
                        Scheduled
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
                        ? "1 video"
                        : `${uploadedImages.length + vaultSelection.length} image${uploadedImages.length + vaultSelection.length !== 1 ? "s" : ""}`}
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
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Creating...
              </>
            ) : scheduleEnabled && publishAt ? (
              "Schedule post"
            ) : (
              "Publish post"
            )}
          </Button>
          <Button variant="outline" asChild>
            <Link href="/feed">Cancel</Link>
          </Button>
        </div>
      </form>
    </Page>
  );
}
