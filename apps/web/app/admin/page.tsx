"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Page } from "@/components/brand/Page";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { apiFetch } from "@/lib/api/client";
import { getApiErrorMessage } from "@/lib/errors";
import "@/lib/api";

type AdminCreator = {
  user_id: string;
  email: string;
  role: string;
  is_active: boolean;
  onboarding_state: string | null;
  handle: string | null;
  display_name: string;
  bio: string | null;
  discoverable: boolean;
  featured: boolean;
  created_at: string;
};

type AdminPost = {
  id: string;
  creator_user_id: string;
  creator_handle: string | null;
  type: string;
  caption: string | null;
  visibility: string;
  nsfw: boolean;
  status: string;
  created_at: string;
};

type CreatorsPage = { items: AdminCreator[]; total: number };
type PostsPage = { items: AdminPost[]; total: number };

export default function AdminPage() {
  const router = useRouter();
  const [tab, setTab] = useState<"creators" | "posts">("creators");
  const [creators, setCreators] = useState<AdminCreator[]>([]);
  const [posts, setPosts] = useState<AdminPost[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const fetchCreators = useCallback(async () => {
    try {
      const data = await apiFetch<CreatorsPage>("/admin/creators", {
        method: "GET",
        query: { page: 1, page_size: 50 },
      });
      setCreators(data.items);
      setError(null);
    } catch (err) {
      const { kind } = getApiErrorMessage(err);
      if (kind === "unauthorized") {
        router.replace("/login?next=/admin");
        return;
      }
      setError(getApiErrorMessage(err).message);
    }
  }, [router]);

  const fetchPosts = useCallback(async () => {
    try {
      const data = await apiFetch<PostsPage>("/admin/posts", {
        method: "GET",
        query: { page: 1, page_size: 50 },
      });
      setPosts(data.items);
      setError(null);
    } catch (err) {
      const { kind } = getApiErrorMessage(err);
      if (kind === "unauthorized") {
        router.replace("/login?next=/admin");
        return;
      }
      setError(getApiErrorMessage(err).message);
    }
  }, [router]);

  useEffect(() => {
    if (tab === "creators") fetchCreators();
    else fetchPosts();
  }, [tab, fetchCreators, fetchPosts]);

  const creatorAction = async (
    userId: string,
    action: string,
    reason?: string,
  ) => {
    setActionLoading(`${userId}-${action}`);
    try {
      await apiFetch(`/admin/creators/${userId}/action`, {
        method: "POST",
        body: { action, reason },
      });
      fetchCreators();
    } catch (err) {
      setError(getApiErrorMessage(err).message);
    } finally {
      setActionLoading(null);
    }
  };

  const postAction = async (postId: string, action: string) => {
    setActionLoading(`${postId}-${action}`);
    try {
      await apiFetch(`/admin/posts/${postId}/action`, {
        method: "POST",
        body: { action },
      });
      fetchPosts();
    } catch (err) {
      setError(getApiErrorMessage(err).message);
    } finally {
      setActionLoading(null);
    }
  };

  return (
    <Page className="max-w-6xl space-y-6">
      <h1 className="font-display text-premium-h2 font-semibold text-foreground">
        Admin Dashboard
      </h1>

      {error && (
        <Card className="border-destructive/20 bg-destructive/5 p-4">
          <p className="text-sm text-destructive">{error}</p>
        </Card>
      )}

      {/* Tab selector */}
      <div className="flex gap-2 rounded-xl border border-border bg-muted/50 p-1">
        <button
          type="button"
          onClick={() => setTab("creators")}
          className={`flex-1 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
            tab === "creators"
              ? "bg-background text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          Creators ({creators.length})
        </button>
        <button
          type="button"
          onClick={() => setTab("posts")}
          className={`flex-1 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
            tab === "posts"
              ? "bg-background text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          Posts ({posts.length})
        </button>
      </div>

      {/* Creators tab */}
      {tab === "creators" && (
        <div className="space-y-3">
          {creators.length === 0 && (
            <p className="py-8 text-center text-sm text-muted-foreground">
              No creators found.
            </p>
          )}
          {creators.map((c) => (
            <Card key={c.user_id} className="p-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-foreground">
                    {c.display_name || "No name"}{" "}
                    {c.handle && (
                      <span className="text-muted-foreground">
                        @{c.handle}
                      </span>
                    )}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {c.email} · {c.role} ·{" "}
                    {c.discoverable ? "Discoverable" : "Hidden"} ·{" "}
                    {c.is_active ? "Active" : "Suspended"} ·{" "}
                    {c.featured ? "Featured" : "Not featured"} ·{" "}
                    Onboarding: {c.onboarding_state || "N/A"}
                  </p>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {!c.discoverable && (
                    <Button
                      size="sm"
                      variant="secondary"
                      disabled={actionLoading === `${c.user_id}-approve`}
                      onClick={() => creatorAction(c.user_id, "approve")}
                    >
                      Approve
                    </Button>
                  )}
                  {c.discoverable && (
                    <Button
                      size="sm"
                      variant="secondary"
                      disabled={actionLoading === `${c.user_id}-reject`}
                      onClick={() => creatorAction(c.user_id, "reject")}
                    >
                      Hide
                    </Button>
                  )}
                  {!c.featured && (
                    <Button
                      size="sm"
                      variant="secondary"
                      disabled={actionLoading === `${c.user_id}-feature`}
                      onClick={() => creatorAction(c.user_id, "feature")}
                    >
                      Feature
                    </Button>
                  )}
                  {c.featured && (
                    <Button
                      size="sm"
                      variant="secondary"
                      disabled={
                        actionLoading === `${c.user_id}-unfeature`
                      }
                      onClick={() =>
                        creatorAction(c.user_id, "unfeature")
                      }
                    >
                      Unfeature
                    </Button>
                  )}
                  {c.is_active ? (
                    <Button
                      size="sm"
                      variant="destructive"
                      disabled={actionLoading === `${c.user_id}-suspend`}
                      onClick={() => creatorAction(c.user_id, "suspend")}
                    >
                      Suspend
                    </Button>
                  ) : (
                    <Button
                      size="sm"
                      variant="secondary"
                      disabled={
                        actionLoading === `${c.user_id}-activate`
                      }
                      onClick={() =>
                        creatorAction(c.user_id, "activate")
                      }
                    >
                      Activate
                    </Button>
                  )}
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Posts tab */}
      {tab === "posts" && (
        <div className="space-y-3">
          {posts.length === 0 && (
            <p className="py-8 text-center text-sm text-muted-foreground">
              No posts found.
            </p>
          )}
          {posts.map((p) => (
            <Card key={p.id} className="p-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-foreground">
                    {p.type} post by @{p.creator_handle || "unknown"}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {p.visibility} · {p.status} · NSFW: {p.nsfw ? "Yes" : "No"}{" "}
                    · {new Date(p.created_at).toLocaleDateString()}
                  </p>
                  {p.caption && (
                    <p className="mt-1 text-sm text-muted-foreground line-clamp-2">
                      {p.caption}
                    </p>
                  )}
                </div>
                <div className="flex gap-1.5">
                  {p.status !== "REMOVED" ? (
                    <Button
                      size="sm"
                      variant="destructive"
                      disabled={actionLoading === `${p.id}-remove`}
                      onClick={() => postAction(p.id, "remove")}
                    >
                      Remove
                    </Button>
                  ) : (
                    <Button
                      size="sm"
                      variant="secondary"
                      disabled={actionLoading === `${p.id}-restore`}
                      onClick={() => postAction(p.id, "restore")}
                    >
                      Restore
                    </Button>
                  )}
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </Page>
  );
}
