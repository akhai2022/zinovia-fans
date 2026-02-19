"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRequireRole } from "@/lib/hooks/useRequireRole";
import { CollectionsService, type CollectionOut } from "@zinovia/contracts";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Modal } from "@/components/ui/modal";
import { useToast } from "@/components/ui/toast";
import "@/lib/api";

const VISIBILITY_LABELS: Record<string, string> = {
  PUBLIC: "Public",
  FOLLOWERS: "Followers",
  SUBSCRIBERS: "Subscribers",
};

export default function CollectionsListPage() {
  const { authorized } = useRequireRole(["creator", "admin"]);
  const { addToast } = useToast();
  const [collections, setCollections] = useState<CollectionOut[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<CollectionOut | null>(null);
  const [deleting, setDeleting] = useState(false);

  const load = () => {
    setLoading(true);
    setError(null);
    CollectionsService.collectionsList()
      .then((page) => setCollections(page.items))
      .catch((err) =>
        setError(err instanceof Error ? err.message : "Failed to load"),
      )
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, []);

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await CollectionsService.collectionsDelete(deleteTarget.id);
      setCollections((prev) => prev.filter((c) => c.id !== deleteTarget.id));
      addToast("Collection deleted", "success");
      setDeleteTarget(null);
    } catch (err: unknown) {
      addToast(
        err instanceof Error ? err.message : "Failed to delete",
        "error",
      );
    } finally {
      setDeleting(false);
    }
  };

  if (!authorized) return null;

  return (
    <div className="mx-auto max-w-4xl space-y-6 px-4 py-8 sm:px-6">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-premium-h2 font-semibold text-foreground">
          Collections
        </h1>
        <Button size="sm" asChild>
          <Link href="/creator/collections/new">New collection</Link>
        </Button>
      </div>

      {/* Loading */}
      {loading && (
        <div className="grid gap-4 sm:grid-cols-2">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-32 w-full rounded-lg" />
          ))}
        </div>
      )}

      {/* Error */}
      {error && !loading && (
        <Card className="py-10 text-center" role="alert">
          <p className="font-semibold text-foreground">Something went wrong</p>
          <p className="mt-1 text-sm text-muted-foreground">{error}</p>
          <Button variant="secondary" size="sm" className="mt-4" onClick={load}>
            Retry
          </Button>
        </Card>
      )}

      {/* Empty */}
      {!loading && !error && collections.length === 0 && (
        <Card className="py-16 text-center">
          <p className="font-display text-premium-h3 font-semibold text-foreground">
            No collections yet
          </p>
          <p className="mt-2 text-premium-body text-muted-foreground">
            Create a collection to organize your posts into albums.
          </p>
          <Button size="sm" className="mt-6" asChild>
            <Link href="/creator/collections/new">Create your first collection</Link>
          </Button>
        </Card>
      )}

      {/* Collection cards */}
      {!loading && collections.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-2">
          {collections.map((col) => (
            <Card
              key={col.id}
              variant="elevated"
              className="flex flex-col justify-between p-4"
            >
              <div>
                <div className="flex items-start justify-between gap-2">
                  <Link
                    href={`/creator/collections/${col.id}`}
                    className="font-display text-lg font-semibold text-foreground hover:underline"
                  >
                    {col.title}
                  </Link>
                  <span className="shrink-0 rounded bg-surface-alt px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
                    {VISIBILITY_LABELS[col.visibility] ?? col.visibility}
                  </span>
                </div>
                {col.description && (
                  <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">
                    {col.description}
                  </p>
                )}
              </div>
              <div className="mt-3 flex items-center justify-between">
                <span className="text-xs text-muted-foreground">
                  {col.post_count ?? 0} post{(col.post_count ?? 0) !== 1 ? "s" : ""}
                </span>
                <div className="flex gap-2">
                  <Button variant="secondary" size="sm" asChild>
                    <Link href={`/creator/collections/${col.id}`}>Edit</Link>
                  </Button>
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => setDeleteTarget(col)}
                  >
                    Delete
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Delete confirmation */}
      <Modal
        open={!!deleteTarget}
        onClose={() => !deleting && setDeleteTarget(null)}
        title="Delete collection?"
      >
        <p className="text-sm text-muted-foreground">
          This will permanently delete &ldquo;{deleteTarget?.title}&rdquo; and
          remove all post associations. The posts themselves will not be deleted.
        </p>
        <div className="mt-4 flex justify-end gap-2">
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setDeleteTarget(null)}
            disabled={deleting}
          >
            Cancel
          </Button>
          <Button
            variant="destructive"
            size="sm"
            onClick={handleDelete}
            disabled={deleting}
          >
            {deleting ? "Deleting..." : "Delete"}
          </Button>
        </div>
      </Modal>
    </div>
  );
}
