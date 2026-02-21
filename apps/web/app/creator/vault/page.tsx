"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRequireRole } from "@/lib/hooks/useRequireRole";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Modal } from "@/components/ui/modal";
import { useToast } from "@/components/ui/toast";
import { ImageUploadField } from "@/features/media/ImageUploadField";
import { listVaultMedia, type MediaMineItem } from "@/features/engagement/api";
import { MediaService } from "@/features/media/api";
import { apiFetch } from "@/lib/apiFetch";
import { SemanticSearch } from "@/features/search/SemanticSearch";
import { useTranslation } from "@/lib/i18n";

type FilterType = "all" | "image" | "video";

export default function VaultPage() {
  const { authorized } = useRequireRole(["creator", "admin", "super_admin"]);
  const { t } = useTranslation();
  const { addToast } = useToast();
  const [items, setItems] = useState<MediaMineItem[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<FilterType>("all");
  const [previewItem, setPreviewItem] = useState<MediaMineItem | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<MediaMineItem | null>(null);
  const [deleting, setDeleting] = useState(false);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const loadingRef = useRef(false);

  const fetchMedia = useCallback(
    async (cursor?: string) => {
      const typeParam = filter === "all" ? undefined : filter;
      const data = await listVaultMedia(cursor, typeParam);
      return data;
    },
    [filter],
  );

  // Initial load + filter change
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetchMedia()
      .then((data) => {
        if (cancelled) return;
        setItems(data.items);
        setNextCursor(data.next_cursor);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : t.vault.errorLoadMedia);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [fetchMedia]);

  // Load more (infinite scroll)
  const loadMore = useCallback(async () => {
    if (!nextCursor || loadingRef.current) return;
    loadingRef.current = true;
    setLoadingMore(true);
    try {
      const data = await fetchMedia(nextCursor);
      setItems((prev) => {
        const ids = new Set(prev.map((m) => m.id));
        return [...prev, ...data.items.filter((m) => !ids.has(m.id))];
      });
      setNextCursor(data.next_cursor);
    } catch (err) {
      setError(err instanceof Error ? err.message : t.vault.errorLoadMore);
    } finally {
      setLoadingMore(false);
      loadingRef.current = false;
    }
  }, [nextCursor, fetchMedia]);

  useEffect(() => {
    const el = sentinelRef.current;
    if (!el || !nextCursor) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) loadMore();
      },
      { rootMargin: "400px" },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [nextCursor, loadMore]);

  // Preview modal: fetch full download URL
  const openPreview = async (item: MediaMineItem) => {
    setPreviewItem(item);
    setPreviewUrl(null);
    try {
      const { download_url } = await MediaService.mediaDownloadUrl(item.id);
      setPreviewUrl(download_url ?? null);
    } catch {
      setPreviewUrl(null);
    }
  };

  // Delete media
  const handleDelete = async () => {
    if (!deleteConfirm) return;
    setDeleting(true);
    try {
      await apiFetch(`/media/${deleteConfirm.id}`, { method: "DELETE" });
      setItems((prev) => prev.filter((m) => m.id !== deleteConfirm.id));
      addToast(t.vault.toastMediaDeleted, "success");
      setDeleteConfirm(null);
      // Close preview if it was the deleted item
      if (previewItem?.id === deleteConfirm.id) {
        setPreviewItem(null);
        setPreviewUrl(null);
      }
    } catch (err: unknown) {
      const msg =
        err instanceof Error ? err.message : t.vault.errorDeleteMedia;
      addToast(msg, "error");
    } finally {
      setDeleting(false);
    }
  };

  const handleUploadComplete = (assetId: string) => {
    // Reload from start to show the new item at the top
    setLoading(true);
    fetchMedia()
      .then((data) => {
        setItems(data.items);
        setNextCursor(data.next_cursor);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
    addToast(t.vault.toastUploadedSuccessfully, "success");
  };

  const FILTERS: { key: FilterType; label: string }[] = [
    { key: "all", label: t.vault.filterAll },
    { key: "image", label: t.vault.filterImages },
    { key: "video", label: t.vault.filterVideos },
  ];

  if (!authorized) return null;

  return (
    <div className="mx-auto max-w-5xl space-y-6 px-4 py-8 sm:px-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="font-display text-premium-h2 font-semibold text-foreground">
          {t.vault.title}
        </h1>
        <ImageUploadField
          onUploadComplete={handleUploadComplete}
          allowMultiple
        />
      </div>

      {/* Filter tabs */}
      <div className="flex gap-2">
        {FILTERS.map(({ key, label }) => (
          <Button
            key={key}
            variant={filter === key ? "default" : "secondary"}
            size="sm"
            onClick={() => setFilter(key)}
          >
            {label}
          </Button>
        ))}
      </div>

      {/* AI semantic search */}
      <SemanticSearch
        onSelect={(mediaAssetId) => {
          const item = items.find((m) => m.id === mediaAssetId);
          if (item) openPreview(item);
        }}
      />

      {/* Error */}
      {error && items.length === 0 && (
        <Card className="py-10 text-center" role="alert">
          <p className="font-display text-premium-h3 font-semibold text-foreground">
            {t.vault.errorTitle}
          </p>
          <p className="mt-2 text-premium-body text-muted-foreground">
            {error}
          </p>
        </Card>
      )}

      {/* Loading skeleton */}
      {loading && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="aspect-square w-full rounded-lg" />
          ))}
        </div>
      )}

      {/* Empty state */}
      {!loading && items.length === 0 && !error && (
        <Card className="py-16 text-center">
          <p className="font-display text-premium-h3 font-semibold text-foreground">
            {t.vault.emptyTitle}
          </p>
          <p className="mt-2 text-premium-body text-muted-foreground">
            {t.vault.emptyDescription}
          </p>
        </Card>
      )}

      {/* Media grid */}
      {!loading && items.length > 0 && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
          {items.map((item) => (
            <VaultCell
              key={item.id}
              item={item}
              onPreview={() => openPreview(item)}
              onDelete={() => setDeleteConfirm(item)}
            />
          ))}
        </div>
      )}

      {/* Loading more */}
      {loadingMore && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="aspect-square w-full rounded-lg" />
          ))}
        </div>
      )}

      {/* Sentinel */}
      {nextCursor && !loadingMore && (
        <div ref={sentinelRef} className="h-1" aria-hidden />
      )}

      {/* End indicator */}
      {!loading && items.length > 0 && !nextCursor && !loadingMore && (
        <p className="py-4 text-center text-sm text-muted-foreground">
          {t.vault.allMediaLoaded}
        </p>
      )}

      {/* Preview modal */}
      <Modal
        open={!!previewItem}
        onClose={() => {
          setPreviewItem(null);
          setPreviewUrl(null);
        }}
        title={t.vault.previewModalTitle}
        className="max-w-2xl"
      >
        {previewItem && (
          <div className="space-y-4">
            {previewUrl ? (
              previewItem.content_type.startsWith("video/") ? (
                <video
                  src={previewUrl}
                  controls
                  className="max-h-[60vh] w-full rounded-lg object-contain"
                />
              ) : (
                <img
                  src={previewUrl}
                  alt={t.vault.previewAlt}
                  className="max-h-[60vh] w-full rounded-lg object-contain"
                />
              )
            ) : (
              <Skeleton className="aspect-video w-full rounded-lg" />
            )}
            <div className="flex items-center justify-between text-sm text-muted-foreground">
              <span>{previewItem.content_type}</span>
              <span>
                {new Date(previewItem.created_at).toLocaleDateString()}
              </span>
            </div>
            <Button
              variant="destructive"
              size="sm"
              onClick={() => {
                setDeleteConfirm(previewItem);
              }}
            >
              {t.vault.deleteButton}
            </Button>
          </div>
        )}
      </Modal>

      {/* Delete confirmation modal */}
      <Modal
        open={!!deleteConfirm}
        onClose={() => !deleting && setDeleteConfirm(null)}
        title={t.vault.deleteModalTitle}
      >
        <p className="text-sm text-muted-foreground">
          {t.vault.deleteModalDescription}
        </p>
        <div className="mt-4 flex justify-end gap-2">
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setDeleteConfirm(null)}
            disabled={deleting}
          >
            {t.vault.cancelButton}
          </Button>
          <Button
            variant="destructive"
            size="sm"
            onClick={handleDelete}
            disabled={deleting}
          >
            {deleting ? t.vault.deletingButton : t.vault.deleteButton}
          </Button>
        </div>
      </Modal>
    </div>
  );
}

function VaultCell({
  item,
  onPreview,
  onDelete,
}: {
  item: MediaMineItem;
  onPreview: () => void;
  onDelete: () => void;
}) {
  const { t } = useTranslation();
  const [thumbUrl, setThumbUrl] = useState<string | null>(null);
  const isVideo = item.content_type.startsWith("video/");

  useEffect(() => {
    let cancelled = false;
    const variant = isVideo ? "poster" : "grid";
    MediaService.mediaDownloadUrl(item.id, variant)
      .then(({ download_url }) => {
        if (!cancelled) setThumbUrl(download_url ?? null);
      })
      .catch(() => {
        // Fallback to original if no variant
        if (!cancelled) {
          MediaService.mediaDownloadUrl(item.id)
            .then(({ download_url }) => {
              if (!cancelled) setThumbUrl(download_url ?? null);
            })
            .catch(() => {});
        }
      });
    return () => {
      cancelled = true;
    };
  }, [item.id, isVideo]);

  return (
    <div className="group relative aspect-square overflow-hidden rounded-lg border border-border bg-surface-alt">
      {thumbUrl ? (
        <img
          src={thumbUrl}
          alt=""
          className="h-full w-full object-cover"
          loading="lazy"
        />
      ) : (
        <div className="flex h-full w-full items-center justify-center">
          <span className="text-xs text-muted-foreground">
            {isVideo ? t.vault.cellVideo : t.vault.cellImage}
          </span>
        </div>
      )}
      {isVideo && (
        <div className="absolute left-2 top-2 rounded bg-black/60 px-1.5 py-0.5 text-[10px] font-medium text-white">
          {t.vault.badgeVideo}
        </div>
      )}
      {/* Derived asset status badge */}
      {!isVideo && (
        <div className="absolute right-2 top-2">
          {thumbUrl ? (
            <div className="rounded bg-emerald-600/80 px-1.5 py-0.5 text-[9px] font-medium text-white">
              {t.vault.badgePreviewReady}
            </div>
          ) : (
            <div className="rounded bg-amber-600/80 px-1.5 py-0.5 text-[9px] font-medium text-white animate-pulse">
              {t.vault.badgeProcessing}
            </div>
          )}
        </div>
      )}
      <div className="absolute inset-0 flex items-center justify-center gap-2 bg-black/50 opacity-0 transition-opacity group-hover:opacity-100">
        <Button variant="secondary" size="sm" onClick={onPreview}>
          {t.vault.previewButton}
        </Button>
        <Button variant="destructive" size="sm" onClick={onDelete}>
          {t.vault.deleteButton}
        </Button>
      </div>
    </div>
  );
}
