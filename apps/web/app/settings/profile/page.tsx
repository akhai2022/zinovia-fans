"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { ApiError } from "@zinovia/contracts";
import {
  CreatorsService,
  type CreatorProfileUpdate,
} from "@/features/creators/api";
import { CreatorAvatarAsset } from "@/features/creators/components/CreatorAvatarAsset";
import { ImageUploadField } from "@/features/media/ImageUploadField";
import { Page } from "@/components/brand/Page";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/components/ui/toast";
import { Skeleton } from "@/components/ui/skeleton";
import { getApiErrorMessage } from "@/lib/errors";
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
      .catch(() => setPrefillStatus("error"));
  }, []);

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

  if (prefillStatus === "loading") {
    return (
      <Page>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          Creator profile
        </h1>
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
    <Page>
      <h1 className="text-2xl font-semibold tracking-tight text-foreground">
        Creator profile
      </h1>
      {prefillStatus === "error" && (
        <p className="mt-2 text-sm text-muted-foreground">
          Creator-only. Set up your account as a creator to edit profile.
        </p>
      )}
      <Card className="mt-4">
        <CardHeader>
          <CardTitle>Profile</CardTitle>
          <CardDescription>Update your public creator profile.</CardDescription>
        </CardHeader>
        <CardContent>
          <form className="space-y-6" onSubmit={onSubmit}>
            <div className="space-y-2">
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
                <ImageUploadField
                  onUploadComplete={(assetId) => setAvatarMediaId(assetId)}
                  disabled={loading}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Banner image</Label>
              <p className="text-xs text-muted-foreground">
                Shown at the top of your creator profile (e.g. 1500×500).
              </p>
              {bannerMediaId && (
                <div className="mt-2 max-h-32 w-full max-w-2xl overflow-hidden rounded-brand border border-border bg-muted">
                  <BannerPreview assetId={bannerMediaId} />
                </div>
              )}
              <ImageUploadField
                onUploadComplete={(assetId) => setBannerMediaId(assetId)}
                disabled={loading}
              />
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
              <textarea
                id="bio"
                className="flex min-h-[80px] w-full rounded-brand border border-input bg-transparent px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                rows={3}
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                placeholder="Short bio"
              />
            </div>
            <div className="flex items-center justify-between rounded-brand border border-border p-4">
              <div>
                <Label htmlFor="discoverable" className="text-base">
                  Discoverable
                </Label>
                <p className="text-sm text-muted-foreground">
                  Show your profile in discovery and feed.
                </p>
              </div>
              <Switch
                id="discoverable"
                checked={discoverable}
                onCheckedChange={setDiscoverable}
              />
            </div>
            <div className="flex items-center justify-between rounded-brand border border-border p-4">
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
      <Button variant="ghost" size="sm" className="mt-4" asChild>
        <Link href="/">Back to home</Link>
      </Button>
    </Page>
  );
}
