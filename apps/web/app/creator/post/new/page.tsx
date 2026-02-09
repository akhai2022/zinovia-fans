"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { PostsService, type PostCreate } from "@/features/posts/api";
import { ImageUploadField } from "@/features/media/ImageUploadField";
import { VideoUploadField } from "@/features/media/VideoUploadField";
import { Page } from "@/components/brand/Page";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import "@/lib/api";

export interface UploadedImage {
  assetId: string;
  previewUrl: string | null;
}

export default function NewPostPage() {
  const router = useRouter();
  const [type, setType] = useState<"TEXT" | "IMAGE" | "VIDEO">("TEXT");
  const [caption, setCaption] = useState("");
  const [visibility, setVisibility] = useState<"PUBLIC" | "FOLLOWERS" | "SUBSCRIBERS">("PUBLIC");
  const [nsfw, setNsfw] = useState(false);
  const [uploadedImages, setUploadedImages] = useState<UploadedImage[]>([]);
  const [videoAssetId, setVideoAssetId] = useState<string | null>(null);
  const [assetIdsInput, setAssetIdsInput] = useState("");
  const [showManualIds, setShowManualIds] = useState(false);
  const [status, setStatus] = useState<"idle" | "loading" | "error" | "ok">("idle");
  const [errorDetail, setErrorDetail] = useState<string | null>(null);

  const handleImageUpload = (assetId: string, previewUrl?: string | null) => {
    setUploadedImages((prev) => [...prev, { assetId, previewUrl: previewUrl ?? null }]);
  };

  const removeUploadedImage = (index: number) => {
    setUploadedImages((prev) => prev.filter((_, i) => i !== index));
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
    const imageAssetIds = [...fromUpload, ...manualIds];
    const videoIds = videoAssetId ? [videoAssetId] : [];
    if (type === "IMAGE" && imageAssetIds.length === 0) {
      setErrorDetail("Image posts require at least one image (upload or paste asset IDs).");
      setStatus("error");
      return;
    }
    if (type === "VIDEO" && videoIds.length === 0) {
      setErrorDetail("Video posts require one MP4 video (upload first).");
      setStatus("error");
      return;
    }
    if (type === "TEXT" && imageAssetIds.length === 0 && videoIds.length === 0) {
      /* allow */
    } else if (type === "TEXT") {
      setErrorDetail("Text posts cannot have asset IDs.");
      setStatus("error");
      return;
    }
    const assetIds = type === "VIDEO" ? videoIds : imageAssetIds;
    const body: PostCreate = {
      type,
      caption: caption || null,
      visibility,
      nsfw,
      asset_ids: assetIds,
    };
    try {
      await PostsService.postsCreate(body);
      setStatus("ok");
      router.push("/feed");
    } catch (err: unknown) {
      setStatus("error");
      setErrorDetail(err instanceof Error ? err.message : "Failed to create post");
    }
  };

  return (
    <Page>
      <h1 className="text-2xl font-semibold tracking-tight text-foreground">New post</h1>
      <Card className="mt-4">
        <CardHeader>
          <CardTitle>Create post</CardTitle>
          <CardDescription>Creator profile (handle) required.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={onSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="post-type">Type</Label>
              <select
                id="post-type"
                className="flex h-9 w-full rounded-brand border border-input bg-transparent px-3 py-1 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                value={type}
                onChange={(e) => setType(e.target.value as "TEXT" | "IMAGE" | "VIDEO")}
              >
                <option value="TEXT">Text</option>
                <option value="IMAGE">Image</option>
                <option value="VIDEO">Video</option>
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="caption">Caption</Label>
              <textarea
                id="caption"
                className="flex min-h-[80px] w-full rounded-brand border border-input bg-transparent px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                rows={3}
                value={caption}
                onChange={(e) => setCaption(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Visibility</Label>
              <select
                className="flex h-9 w-full rounded-brand border border-input bg-transparent px-3 py-1 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                value={visibility}
                onChange={(e) => setVisibility(e.target.value as "PUBLIC" | "FOLLOWERS" | "SUBSCRIBERS")}
              >
                <option value="PUBLIC">Public</option>
                <option value="FOLLOWERS">Followers only</option>
                <option value="SUBSCRIBERS">Subscribers only</option>
              </select>
            </div>
            <div className="flex items-center justify-between rounded-brand border border-border p-4">
              <Label htmlFor="nsfw" className="text-base">NSFW</Label>
              <Switch id="nsfw" checked={nsfw} onCheckedChange={setNsfw} />
            </div>
            {type === "IMAGE" && (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Images</Label>
                  {uploadedImages.length > 0 && (
                    <ul className="flex flex-wrap gap-2" aria-label="Uploaded images">
                      {uploadedImages.map((img, index) => (
                        <li key={img.assetId} className="relative">
                          <div className="rounded-lg border border-border overflow-hidden bg-muted">
                            {img.previewUrl ? (
                              <img
                                src={img.previewUrl}
                                alt=""
                                className="h-20 w-20 object-cover"
                              />
                            ) : (
                              <div className="h-20 w-20 flex items-center justify-center text-xs text-muted-foreground">
                                {img.assetId.slice(0, 8)}
                              </div>
                            )}
                            <button
                              type="button"
                              onClick={() => removeUploadedImage(index)}
                              className="absolute top-0 right-0 rounded-bl bg-destructive/90 px-1.5 py-0.5 text-xs text-destructive-foreground hover:bg-destructive"
                              aria-label={`Remove image ${index + 1}`}
                            >
                              Remove
                            </button>
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                  {uploadedImages.length < 3 && (
                    <ImageUploadField
                      onUploadComplete={handleImageUpload}
                      allowMultiple
                      disabled={status === "loading"}
                    />
                  )}
                  {uploadedImages.length >= 3 && (
                    <p className="text-sm text-muted-foreground">Max 3 images. Remove one to add another.</p>
                  )}
                </div>
                <div className="space-y-2">
                  <button
                    type="button"
                    onClick={() => setShowManualIds((v) => !v)}
                    className="text-sm text-muted-foreground hover:text-foreground underline"
                  >
                    {showManualIds ? "Hide" : "Add"} manual asset IDs
                  </button>
                  {showManualIds && (
                    <>
                      <Label htmlFor="assetIds">Asset IDs (comma- or space-separated)</Label>
                      <Input
                        id="assetIds"
                        type="text"
                        placeholder="uuid1, uuid2"
                        value={assetIdsInput}
                        onChange={(e) => setAssetIdsInput(e.target.value)}
                      />
                    </>
                  )}
                </div>
              </div>
            )}
            {type === "VIDEO" && (
              <div className="space-y-2">
                <Label>Video</Label>
                {videoAssetId ? (
                  <p className="text-sm text-muted-foreground">
                    Video uploaded. Remove and re-upload to change, or create post.
                  </p>
                ) : (
                  <VideoUploadField
                    onUploadComplete={(id) => setVideoAssetId(id)}
                    disabled={status === "loading"}
                  />
                )}
                {videoAssetId && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setVideoAssetId(null)}
                  >
                    Remove video
                  </Button>
                )}
              </div>
            )}
            {status === "error" && errorDetail && (
              <p className="text-sm text-destructive">{errorDetail}</p>
            )}
            <div className="flex gap-3">
              <Button type="submit" disabled={status === "loading"}>
                {status === "loading" ? "Creating…" : "Create post"}
              </Button>
              <Button variant="outline" asChild>
                <Link href="/">Cancel</Link>
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </Page>
  );
}
