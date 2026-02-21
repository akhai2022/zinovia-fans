"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useRequireRole } from "@/lib/hooks/useRequireRole";
import { CollectionsService, type CollectionCreate } from "@zinovia/contracts";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/ui/toast";
import { ImageUploadField } from "@/features/media/ImageUploadField";
import "@/lib/api";

const VISIBILITY_OPTIONS = [
  { value: "PUBLIC", label: "Public" },
  { value: "FOLLOWERS", label: "Followers only" },
  { value: "SUBSCRIBERS", label: "Subscribers only" },
];

export default function NewCollectionPage() {
  const { authorized } = useRequireRole(["creator", "admin", "super_admin"]);
  const router = useRouter();
  const { addToast } = useToast();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [visibility, setVisibility] = useState("PUBLIC");
  const [coverAssetId, setCoverAssetId] = useState<string | null>(null);
  const [status, setStatus] = useState<"idle" | "loading" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    setStatus("loading");
    setErrorMsg(null);

    const body: CollectionCreate = {
      title: title.trim(),
      description: description.trim() || undefined,
      visibility,
      cover_asset_id: coverAssetId,
    };

    try {
      const created = await CollectionsService.collectionsCreate(body);
      addToast("Collection created", "success");
      router.push(`/creator/collections/${created.id}`);
    } catch (err: unknown) {
      setStatus("error");
      setErrorMsg(
        err instanceof Error ? err.message : "Failed to create collection",
      );
    }
  };

  if (!authorized) return null;

  return (
    <div className="mx-auto max-w-2xl space-y-6 px-4 py-8 sm:px-6">
      <h1 className="font-display text-premium-h2 font-semibold text-foreground">
        New Collection
      </h1>

      <Card className="p-6">
        <form onSubmit={onSubmit} className="space-y-5">
          <div className="space-y-2">
            <Label htmlFor="title">Title</Label>
            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Behind the Scenes"
              required
              maxLength={120}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description (optional)</Label>
            <textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What is this collection about?"
              rows={3}
              maxLength={500}
              className="flex w-full rounded-brand border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="visibility">Visibility</Label>
            <select
              id="visibility"
              value={visibility}
              onChange={(e) => setVisibility(e.target.value)}
              className="flex h-10 w-full rounded-brand border border-border bg-background px-3 py-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {VISIBILITY_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          <ImageUploadField
            onUploadComplete={(assetId) => setCoverAssetId(assetId)}
          />

          {errorMsg && (
            <p className="text-sm text-destructive" role="alert">
              {errorMsg}
            </p>
          )}

          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => router.push("/creator/collections")}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              size="sm"
              disabled={!title.trim() || status === "loading"}
            >
              {status === "loading" ? "Creating..." : "Create Collection"}
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
