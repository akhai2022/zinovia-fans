"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useRequireRole } from "@/lib/hooks/useRequireRole";
import { useTranslation, interpolate } from "@/lib/i18n";
import {
  CollectionsService,
  type CollectionOut,
  type CollectionPostOut,
  type CollectionUpdate,
} from "@zinovia/contracts";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/components/ui/toast";
import { ImageUploadField } from "@/features/media/ImageUploadField";
import "@/lib/api";

export default function EditCollectionPage() {
  const { authorized } = useRequireRole(["creator", "admin", "super_admin"]);
  const { t } = useTranslation();
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { addToast } = useToast();

  const VISIBILITY_OPTIONS = [
    { value: "PUBLIC", label: t.collections.visibilityPublic },
    { value: "FOLLOWERS", label: t.collections.visibilityFollowersOnly },
    { value: "SUBSCRIBERS", label: t.collections.visibilitySubscribersOnly },
  ];
  const collectionId = params.id;

  const [collection, setCollection] = useState<CollectionOut | null>(null);
  const [posts, setPosts] = useState<CollectionPostOut[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Form state
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [visibility, setVisibility] = useState("PUBLIC");
  const [coverAssetId, setCoverAssetId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Add post
  const [addPostId, setAddPostId] = useState("");
  const [addingPost, setAddingPost] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [col, colPosts] = await Promise.all([
        CollectionsService.collectionsGet(collectionId),
        CollectionsService.collectionsListPosts(collectionId),
      ]);
      setCollection(col);
      setPosts(colPosts);
      setTitle(col.title);
      setDescription(col.description ?? "");
      setVisibility(col.visibility);
      setCoverAssetId(col.cover_asset_id);
    } catch (err) {
      setError(err instanceof Error ? err.message : t.collections.errorLoadCollection);
    } finally {
      setLoading(false);
    }
  }, [collectionId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    setSaving(true);
    try {
      const body: CollectionUpdate = {
        title: title.trim(),
        description: description.trim() || null,
        visibility,
        cover_asset_id: coverAssetId,
      };
      const updated = await CollectionsService.collectionsUpdate(
        collectionId,
        body,
      );
      setCollection(updated);
      addToast(t.collections.toastCollectionSaved, "success");
    } catch (err: unknown) {
      addToast(
        err instanceof Error ? err.message : t.collections.errorSaveCollection,
        "error",
      );
    } finally {
      setSaving(false);
    }
  };

  const handleAddPost = async () => {
    if (!addPostId.trim()) return;
    setAddingPost(true);
    try {
      const added = await CollectionsService.collectionsAddPost(collectionId, {
        post_id: addPostId.trim(),
      });
      setPosts((prev) => [...prev, added]);
      setAddPostId("");
      addToast(t.collections.toastPostAdded, "success");
    } catch (err: unknown) {
      addToast(
        err instanceof Error ? err.message : t.collections.errorAddPost,
        "error",
      );
    } finally {
      setAddingPost(false);
    }
  };

  const handleRemovePost = async (postId: string) => {
    try {
      await CollectionsService.collectionsRemovePost(collectionId, postId);
      setPosts((prev) => prev.filter((p) => p.post_id !== postId));
      addToast(t.collections.toastPostRemoved, "success");
    } catch (err: unknown) {
      addToast(
        err instanceof Error ? err.message : t.collections.errorRemovePost,
        "error",
      );
    }
  };

  if (!authorized) return null;

  if (loading) {
    return (
      <div className="mx-auto max-w-2xl space-y-6 px-4 py-8 sm:px-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64 w-full rounded-lg" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="mx-auto max-w-2xl space-y-6 px-4 py-8 sm:px-6">
        <Card className="py-10 text-center" role="alert">
          <p className="font-semibold text-foreground">{t.collections.failedToLoadCollection}</p>
          <p className="mt-1 text-sm text-muted-foreground">{error}</p>
          <Button variant="secondary" size="sm" className="mt-4" onClick={loadData}>
            {t.collections.retryButton}
          </Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6 px-4 py-8 sm:px-6">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-premium-h2 font-semibold text-foreground">
          {t.collections.editCollectionTitle}
        </h1>
        <Button variant="secondary" size="sm" asChild>
          <a href="/creator/collections">{t.collections.backToCollections}</a>
        </Button>
      </div>

      {/* Edit form */}
      <Card className="p-6">
        <form onSubmit={handleSave} className="space-y-5">
          <div className="space-y-2">
            <Label htmlFor="title">{t.collections.titleLabel}</Label>
            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
              maxLength={120}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">{t.collections.descriptionLabelEdit}</Label>
            <textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              maxLength={500}
              className="flex w-full rounded-brand border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="visibility">{t.collections.visibilityLabel}</Label>
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
          {coverAssetId && (
            <p className="text-xs text-muted-foreground">
              {interpolate(t.collections.coverImageSet, { id: coverAssetId.slice(0, 8) })}
            </p>
          )}

          <div className="flex justify-end">
            <Button
              type="submit"
              size="sm"
              disabled={!title.trim() || saving}
            >
              {saving ? t.collections.savingButton : t.collections.saveChangesButton}
            </Button>
          </div>
        </form>
      </Card>

      {/* Posts in collection */}
      <Card className="p-6">
        <h2 className="mb-4 font-display text-lg font-semibold text-foreground">
          {t.collections.postsInCollectionTitle}
        </h2>

        {/* Add post */}
        <div className="mb-4 flex gap-2">
          <Input
            value={addPostId}
            onChange={(e) => setAddPostId(e.target.value)}
            placeholder={t.collections.addPostPlaceholder}
            className="flex-1"
          />
          <Button
            size="sm"
            onClick={handleAddPost}
            disabled={!addPostId.trim() || addingPost}
          >
            {addingPost ? t.collections.addingPostButton : t.collections.addPostButton}
          </Button>
        </div>

        {posts.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            {t.collections.noPostsInCollection}
          </p>
        ) : (
          <ul className="space-y-2">
            {posts.map((p) => (
              <li
                key={p.id}
                className="flex items-center justify-between rounded-brand border border-border bg-surface-alt px-3 py-2"
              >
                <div className="text-sm">
                  <span className="font-medium text-foreground">
                    {interpolate(t.collections.postIdLabel, { id: p.post_id.slice(0, 8) })}
                  </span>
                  <span className="ml-2 text-xs text-muted-foreground">
                    {interpolate(t.collections.positionLabel, { position: String(p.position) })}
                  </span>
                </div>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => handleRemovePost(p.post_id)}
                >
                  {t.collections.removeButton}
                </Button>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
