"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Page } from "@/components/brand/Page";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Pagination } from "@/components/ui/pagination";
import { Skeleton } from "@/components/ui/skeleton";
import { apiFetch } from "@/lib/api/client";
import { getApiErrorMessage } from "@/lib/errors";
import { useRequireRole } from "@/lib/hooks/useRequireRole";
import "@/lib/api";

/* ------------------------------------------------------------------ */
/* Types                                                               */
/* ------------------------------------------------------------------ */

type AdminUser = {
  user_id: string;
  email: string;
  role: string;
  is_active: boolean;
  onboarding_state: string | null;
  handle: string | null;
  display_name: string;
  bio: string | null;
  phone: string | null;
  country: string | null;
  discoverable: boolean;
  featured: boolean;
  verified: boolean;
  signup_ip: string | null;
  last_login_ip: string | null;
  last_login_at: string | null;
  last_activity_at: string | null;
  created_at: string;
};

type AdminUserDetail = AdminUser & {
  subscriber_count: number;
  post_count: number;
  total_earned_cents: number;
};

type AdminUserPost = {
  id: string;
  type: string;
  caption: string | null;
  visibility: string;
  nsfw: boolean;
  status: string;
  price_cents: number | null;
  currency: string | null;
  created_at: string;
};

type AdminUserSubscriber = {
  fan_user_id: string;
  fan_email: string;
  fan_display_name: string;
  status: string;
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

type AdminTransaction = {
  id: string;
  type: string;
  creator_user_id: string;
  creator_handle: string | null;
  creator_display_name: string | null;
  gross_cents: number;
  fee_cents: number;
  net_cents: number;
  currency: string;
  reference_type: string | null;
  reference_id: string | null;
  created_at: string;
};

type InboundEmail = {
  id: string;
  resend_email_id: string;
  from_address: string;
  to_addresses: string[];
  cc_addresses: string[];
  subject: string;
  category: string;
  snippet: string;
  attachment_count: number;
  attachments_meta: { id: string; filename: string; content_type: string; size: number }[];
  is_read: boolean;
  forwarded_to: string | null;
  forwarded_at: string | null;
  received_at: string;
  created_at: string;
};

type InboundEmailDetail = InboundEmail & {
  html_body: string | null;
  text_body: string | null;
  reply_to_addresses: string[];
  message_id_header: string | null;
  headers: Record<string, string> | null;
  raw_download_url: string | null;
  raw_download_expires_at: string | null;
  spf_result: string | null;
  dkim_result: string | null;
  spam_score: string | null;
};

type InboundCategoryCount = { category: string; total: number; unread: number };
type InboundStats = { categories: InboundCategoryCount[]; total: number; total_unread: number };

type PagedResult<T> = { items: T[]; total: number };

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

function formatCents(cents: number, currency: string): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currency.toUpperCase(),
    minimumFractionDigits: 2,
  }).format(cents / 100);
}

function txTypeLabel(t: string): string {
  switch (t) {
    case "SUBSCRIPTION": return "Subscription";
    case "TIP": return "Tip";
    case "PPV_UNLOCK": return "PPV Message";
    case "PPV_POST_UNLOCK": return "PPV Post";
    default: return t.replace(/_/g, " ");
  }
}

const ROLE_COLORS: Record<string, string> = {
  creator: "bg-purple-500/15 text-purple-400",
  fan: "bg-blue-500/15 text-blue-400",
  admin: "bg-amber-500/15 text-amber-400",
  deleted: "bg-red-500/15 text-red-400",
};

const STATUS_COLORS: Record<string, string> = {
  active: "text-emerald-400",
  suspended: "text-red-400",
  deleted: "text-red-400",
};

const CATEGORY_LABELS: Record<string, string> = {
  support: "Support",
  privacy: "Privacy",
  creators: "Creators",
  safety: "Safety",
  legal: "Legal",
  unknown: "Other",
};

const CATEGORY_COLORS: Record<string, string> = {
  support: "bg-blue-500/15 text-blue-400",
  privacy: "bg-purple-500/15 text-purple-400",
  creators: "bg-emerald-500/15 text-emerald-400",
  safety: "bg-red-500/15 text-red-400",
  legal: "bg-amber-500/15 text-amber-400",
  unknown: "bg-muted text-muted-foreground",
};

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function userStatusLabel(u: AdminUser): string {
  if (u.role === "deleted") return "Deleted";
  return u.is_active ? "Active" : "Suspended";
}

/* ------------------------------------------------------------------ */
/* Component                                                           */
/* ------------------------------------------------------------------ */

const PAGE_SIZE = 25;
const ROLE_FILTERS = [
  { value: null, label: "All" },
  { value: "fan", label: "Fan" },
  { value: "creator", label: "Creator" },
  { value: "admin", label: "Admin" },
  { value: "deleted", label: "Deleted" },
] as const;

export default function AdminPage() {
  const router = useRouter();
  const { authorized } = useRequireRole("admin");
  const [tab, setTab] = useState<"users" | "posts" | "transactions" | "inbox">("users");
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  /* ---- Users state ---- */
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [usersTotal, setUsersTotal] = useState(0);
  const [usersPage, setUsersPage] = useState(1);
  const [usersSearch, setUsersSearch] = useState("");
  const [usersRole, setUsersRole] = useState<string | null>(null);
  const searchTimer = useRef<ReturnType<typeof setTimeout>>();
  const [debouncedSearch, setDebouncedSearch] = useState("");

  // User detail
  const [selectedUser, setSelectedUser] = useState<AdminUserDetail | null>(null);
  const [userDetailLoading, setUserDetailLoading] = useState(false);
  const [userDetailTab, setUserDetailTab] = useState<"posts" | "subscribers">("posts");
  const [userPosts, setUserPosts] = useState<AdminUserPost[]>([]);
  const [userPostsTotal, setUserPostsTotal] = useState(0);
  const [userPostsPage, setUserPostsPage] = useState(1);
  const [userSubs, setUserSubs] = useState<AdminUserSubscriber[]>([]);
  const [userSubsTotal, setUserSubsTotal] = useState(0);
  const [userSubsPage, setUserSubsPage] = useState(1);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  /* ---- Posts state ---- */
  const [posts, setPosts] = useState<AdminPost[]>([]);
  const [postsTotal, setPostsTotal] = useState(0);
  const [postsPage, setPostsPage] = useState(1);

  /* ---- Transactions state ---- */
  const [transactions, setTransactions] = useState<AdminTransaction[]>([]);
  const [txTotal, setTxTotal] = useState(0);
  const [txPage, setTxPage] = useState(1);

  /* ---- Inbox state ---- */
  const [inboxEmails, setInboxEmails] = useState<InboundEmail[]>([]);
  const [inboxTotal, setInboxTotal] = useState(0);
  const [inboxPage, setInboxPage] = useState(1);
  const [inboxStats, setInboxStats] = useState<InboundStats | null>(null);
  const [inboxCategory, setInboxCategory] = useState<string | null>(null);
  const [selectedEmail, setSelectedEmail] = useState<InboundEmailDetail | null>(null);
  const [emailLoading, setEmailLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);

  /* ---- Debounced search ---- */
  useEffect(() => {
    clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => setDebouncedSearch(usersSearch), 300);
    return () => clearTimeout(searchTimer.current);
  }, [usersSearch]);

  /* ---- API helpers (shared error handling) ---- */
  const handleApiError = useCallback(
    (err: unknown) => {
      const { kind, message } = getApiErrorMessage(err);
      if (kind === "unauthorized") {
        router.replace("/login?next=/admin");
        return;
      }
      setError(message);
    },
    [router],
  );

  /* ---- Fetch: users ---- */
  const fetchUsers = useCallback(
    async (pg = 1) => {
      try {
        const query: Record<string, string | number> = { page: pg, page_size: PAGE_SIZE };
        if (debouncedSearch) query.search = debouncedSearch;
        if (usersRole) query.role = usersRole;
        const data = await apiFetch<PagedResult<AdminUser>>("/admin/users", { method: "GET", query });
        setUsers(data.items);
        setUsersTotal(data.total);
        setUsersPage(pg);
        setError(null);
      } catch (err) {
        handleApiError(err);
      }
    },
    [debouncedSearch, usersRole, handleApiError],
  );

  /* ---- Fetch: user detail ---- */
  const openUserDetail = async (userId: string) => {
    setUserDetailLoading(true);
    setSelectedUser(null);
    setUserDetailTab("posts");
    try {
      const data = await apiFetch<AdminUserDetail>(`/admin/users/${userId}`, { method: "GET" });
      setSelectedUser(data);
      // Pre-fetch posts
      const postData = await apiFetch<PagedResult<AdminUserPost>>(`/admin/users/${userId}/posts`, {
        method: "GET",
        query: { page: 1, page_size: PAGE_SIZE },
      });
      setUserPosts(postData.items);
      setUserPostsTotal(postData.total);
      setUserPostsPage(1);
    } catch (err) {
      handleApiError(err);
    } finally {
      setUserDetailLoading(false);
    }
  };

  const fetchUserPosts = async (userId: string, pg = 1) => {
    try {
      const data = await apiFetch<PagedResult<AdminUserPost>>(`/admin/users/${userId}/posts`, {
        method: "GET",
        query: { page: pg, page_size: PAGE_SIZE },
      });
      setUserPosts(data.items);
      setUserPostsTotal(data.total);
      setUserPostsPage(pg);
    } catch (err) {
      handleApiError(err);
    }
  };

  const fetchUserSubscribers = async (userId: string, pg = 1) => {
    try {
      const data = await apiFetch<PagedResult<AdminUserSubscriber>>(`/admin/users/${userId}/subscribers`, {
        method: "GET",
        query: { page: pg, page_size: PAGE_SIZE },
      });
      setUserSubs(data.items);
      setUserSubsTotal(data.total);
      setUserSubsPage(pg);
    } catch (err) {
      handleApiError(err);
    }
  };

  /* ---- Fetch: posts ---- */
  const fetchPosts = useCallback(
    async (pg = 1) => {
      try {
        const data = await apiFetch<PagedResult<AdminPost>>("/admin/posts", {
          method: "GET",
          query: { page: pg, page_size: PAGE_SIZE },
        });
        setPosts(data.items);
        setPostsTotal(data.total);
        setPostsPage(pg);
        setError(null);
      } catch (err) {
        handleApiError(err);
      }
    },
    [handleApiError],
  );

  /* ---- Fetch: transactions ---- */
  const fetchTransactions = useCallback(
    async (pg = 1) => {
      try {
        const data = await apiFetch<PagedResult<AdminTransaction>>("/admin/transactions", {
          method: "GET",
          query: { page: pg, page_size: PAGE_SIZE },
        });
        setTransactions(data.items);
        setTxTotal(data.total);
        setTxPage(pg);
        setError(null);
      } catch (err) {
        handleApiError(err);
      }
    },
    [handleApiError],
  );

  /* ---- Fetch: inbox ---- */
  const fetchInbox = useCallback(
    async (pg = 1) => {
      try {
        const query: Record<string, string | number> = { page: pg, page_size: PAGE_SIZE };
        if (inboxCategory) query.category = inboxCategory;
        const data = await apiFetch<PagedResult<InboundEmail>>("/admin/inbound/emails", { method: "GET", query });
        setInboxEmails(data.items);
        setInboxTotal(data.total);
        setInboxPage(pg);
        setError(null);
      } catch (err) {
        handleApiError(err);
      }
    },
    [inboxCategory, handleApiError],
  );

  const fetchInboxStats = useCallback(async () => {
    try {
      const data = await apiFetch<InboundStats>("/admin/inbound/emails/stats", { method: "GET" });
      setInboxStats(data);
    } catch {
      // stats are non-critical
    }
  }, []);

  const openEmail = async (emailId: string) => {
    setEmailLoading(true);
    try {
      const data = await apiFetch<InboundEmailDetail>(`/admin/inbound/emails/${emailId}`, { method: "GET" });
      setSelectedEmail(data);
      setInboxEmails((prev) => prev.map((e) => (e.id === emailId ? { ...e, is_read: true } : e)));
    } catch (err) {
      handleApiError(err);
    } finally {
      setEmailLoading(false);
    }
  };

  const syncInbox = async () => {
    setSyncing(true);
    try {
      await apiFetch("/admin/inbound/sync", { method: "POST" });
      fetchInbox();
      fetchInboxStats();
    } catch (err) {
      handleApiError(err);
    } finally {
      setSyncing(false);
    }
  };

  /* ---- Tab switch data loading ---- */
  useEffect(() => {
    if (tab === "users") fetchUsers();
    else if (tab === "posts") fetchPosts();
    else if (tab === "transactions") fetchTransactions();
    else {
      fetchInbox();
      fetchInboxStats();
    }
  }, [tab, fetchUsers, fetchPosts, fetchTransactions, fetchInbox, fetchInboxStats]);

  // Reload users when search/role changes
  useEffect(() => {
    if (tab === "users") fetchUsers(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedSearch, usersRole]);

  /* ---- User actions ---- */
  const userAction = async (userId: string, action: string, reason?: string) => {
    setActionLoading(`${userId}-${action}`);
    try {
      await apiFetch(`/admin/users/${userId}/action`, {
        method: "POST",
        body: { action, reason },
      });
      fetchUsers(usersPage);
      // If viewing this user's detail, refresh it
      if (selectedUser?.user_id === userId) {
        const data = await apiFetch<AdminUserDetail>(`/admin/users/${userId}`, { method: "GET" });
        setSelectedUser(data);
      }
      setDeleteConfirm(null);
    } catch (err) {
      handleApiError(err);
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
      fetchPosts(postsPage);
    } catch (err) {
      handleApiError(err);
    } finally {
      setActionLoading(null);
    }
  };

  /* ---- Loading guard ---- */
  if (!authorized) {
    return (
      <Page className="max-w-6xl space-y-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-64 w-full" />
      </Page>
    );
  }

  /* ================================================================ */
  /* Render                                                            */
  /* ================================================================ */
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
        {(["users", "posts", "transactions", "inbox"] as const).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => {
              setTab(t);
              setSelectedUser(null);
              setSelectedEmail(null);
            }}
            className={`flex-1 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
              tab === t
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {t === "users" && `Users (${usersTotal})`}
            {t === "posts" && `Posts (${postsTotal})`}
            {t === "transactions" && `Transactions (${txTotal})`}
            {t === "inbox" && (
              <>
                Inbox
                {inboxStats && inboxStats.total_unread > 0 && (
                  <span className="ml-1.5 inline-flex h-5 min-w-[20px] items-center justify-center rounded-full bg-primary px-1 text-[10px] font-bold text-white">
                    {inboxStats.total_unread}
                  </span>
                )}
              </>
            )}
          </button>
        ))}
      </div>

      {/* ============================================================ */}
      {/* USERS TAB                                                     */}
      {/* ============================================================ */}
      {tab === "users" && !selectedUser && (
        <Card>
          <CardContent className="space-y-4 pt-6">
            {/* Search + role filter */}
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <Input
                placeholder="Search by email, handle, or name..."
                value={usersSearch}
                onChange={(e) => setUsersSearch(e.target.value)}
                className="sm:max-w-xs"
              />
              <div className="flex gap-1.5">
                {ROLE_FILTERS.map((rf) => (
                  <button
                    key={rf.label}
                    type="button"
                    onClick={() => setUsersRole(rf.value)}
                    className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                      usersRole === rf.value
                        ? "bg-foreground text-background"
                        : "bg-muted text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {rf.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Table */}
            {users.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">
                No users found.
              </p>
            ) : (
              <div className="overflow-x-auto rounded-lg border border-border">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border bg-muted/50 text-left text-xs uppercase tracking-wider text-muted-foreground">
                      <th className="px-4 py-3 font-semibold">User</th>
                      <th className="px-4 py-3 font-semibold">Email</th>
                      <th className="px-4 py-3 font-semibold">Role</th>
                      <th className="px-4 py-3 font-semibold">Status</th>
                      <th className="px-4 py-3 font-semibold">Joined</th>
                      <th className="px-4 py-3 font-semibold text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {users.map((u) => (
                      <tr
                        key={u.user_id}
                        className="cursor-pointer text-foreground transition-colors hover:bg-white/[0.03]"
                        onClick={() => openUserDetail(u.user_id)}
                      >
                        <td className="px-4 py-3 whitespace-nowrap">
                          <span className="font-medium">{u.display_name}</span>
                          {u.handle && (
                            <span className="ml-1 text-muted-foreground">@{u.handle}</span>
                          )}
                          {u.verified && (
                            <span className="ml-1 text-[10px] text-blue-500">Verified</span>
                          )}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-muted-foreground">
                          {u.email}
                        </td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${ROLE_COLORS[u.role] || "bg-muted text-muted-foreground"}`}>
                            {u.role}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`text-xs font-medium ${STATUS_COLORS[u.role === "deleted" ? "deleted" : u.is_active ? "active" : "suspended"]}`}>
                            {userStatusLabel(u)}
                          </span>
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-xs text-muted-foreground">
                          {new Date(u.created_at).toLocaleDateString("en-US", {
                            month: "short",
                            day: "numeric",
                            year: "numeric",
                          })}
                        </td>
                        <td className="px-4 py-3 text-right" onClick={(e) => e.stopPropagation()}>
                          <div className="flex justify-end gap-1.5">
                            {u.role !== "deleted" && u.is_active && (
                              <Button
                                size="sm"
                                variant="secondary"
                                disabled={actionLoading === `${u.user_id}-suspend`}
                                onClick={() => userAction(u.user_id, "suspend")}
                              >
                                Suspend
                              </Button>
                            )}
                            {u.role !== "deleted" && !u.is_active && (
                              <Button
                                size="sm"
                                variant="secondary"
                                disabled={actionLoading === `${u.user_id}-activate`}
                                onClick={() => userAction(u.user_id, "activate")}
                              >
                                Activate
                              </Button>
                            )}
                            {u.role !== "deleted" && u.role !== "admin" && (
                              <>
                                {deleteConfirm === u.user_id ? (
                                  <div className="flex gap-1">
                                    <Button
                                      size="sm"
                                      variant="destructive"
                                      disabled={actionLoading === `${u.user_id}-delete`}
                                      onClick={() => userAction(u.user_id, "delete")}
                                    >
                                      Confirm
                                    </Button>
                                    <Button
                                      size="sm"
                                      variant="secondary"
                                      onClick={() => setDeleteConfirm(null)}
                                    >
                                      Cancel
                                    </Button>
                                  </div>
                                ) : (
                                  <Button
                                    size="sm"
                                    variant="destructive"
                                    onClick={() => setDeleteConfirm(u.user_id)}
                                  >
                                    Delete
                                  </Button>
                                )}
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <Pagination
              page={usersPage}
              pageSize={PAGE_SIZE}
              total={usersTotal}
              onPageChange={(pg) => fetchUsers(pg)}
            />
          </CardContent>
        </Card>
      )}

      {/* ============================================================ */}
      {/* USER DETAIL PANEL                                             */}
      {/* ============================================================ */}
      {tab === "users" && selectedUser && (
        <Card>
          <CardContent className="space-y-6 pt-6">
            {/* Back button */}
            <button
              type="button"
              onClick={() => setSelectedUser(null)}
              className="text-xs text-primary hover:underline"
            >
              &larr; Back to users
            </button>

            {userDetailLoading ? (
              <Skeleton className="h-40 w-full" />
            ) : (
              <>
                {/* Header */}
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <h2 className="text-lg font-semibold text-foreground">
                      {selectedUser.display_name}
                      {selectedUser.handle && (
                        <span className="ml-2 text-muted-foreground font-normal">
                          @{selectedUser.handle}
                        </span>
                      )}
                      {selectedUser.verified && (
                        <span className="ml-2 text-xs text-blue-500">Verified</span>
                      )}
                    </h2>
                    <p className="text-sm text-muted-foreground">{selectedUser.email}</p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${ROLE_COLORS[selectedUser.role] || "bg-muted text-muted-foreground"}`}>
                        {selectedUser.role}
                      </span>
                      <span className={`text-xs font-medium ${STATUS_COLORS[selectedUser.role === "deleted" ? "deleted" : selectedUser.is_active ? "active" : "suspended"]}`}>
                        {userStatusLabel(selectedUser)}
                      </span>
                      {selectedUser.discoverable && (
                        <span className="text-xs text-muted-foreground">Discoverable</span>
                      )}
                      {selectedUser.featured && (
                        <span className="text-xs text-amber-400">Featured</span>
                      )}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex flex-wrap gap-1.5">
                    {selectedUser.role === "creator" && !selectedUser.discoverable && (
                      <Button
                        size="sm"
                        variant="secondary"
                        disabled={actionLoading === `${selectedUser.user_id}-approve`}
                        onClick={() => userAction(selectedUser.user_id, "approve")}
                      >
                        Approve
                      </Button>
                    )}
                    {selectedUser.role === "creator" && selectedUser.discoverable && (
                      <Button
                        size="sm"
                        variant="secondary"
                        disabled={actionLoading === `${selectedUser.user_id}-reject`}
                        onClick={() => userAction(selectedUser.user_id, "reject")}
                      >
                        Hide
                      </Button>
                    )}
                    {selectedUser.role === "creator" && !selectedUser.featured && (
                      <Button
                        size="sm"
                        variant="secondary"
                        disabled={actionLoading === `${selectedUser.user_id}-feature`}
                        onClick={() => userAction(selectedUser.user_id, "feature")}
                      >
                        Feature
                      </Button>
                    )}
                    {selectedUser.role === "creator" && selectedUser.featured && (
                      <Button
                        size="sm"
                        variant="secondary"
                        disabled={actionLoading === `${selectedUser.user_id}-unfeature`}
                        onClick={() => userAction(selectedUser.user_id, "unfeature")}
                      >
                        Unfeature
                      </Button>
                    )}
                    {selectedUser.role !== "deleted" && selectedUser.is_active && (
                      <Button
                        size="sm"
                        variant="secondary"
                        disabled={actionLoading === `${selectedUser.user_id}-suspend`}
                        onClick={() => userAction(selectedUser.user_id, "suspend")}
                      >
                        Suspend
                      </Button>
                    )}
                    {selectedUser.role !== "deleted" && !selectedUser.is_active && (
                      <Button
                        size="sm"
                        variant="secondary"
                        disabled={actionLoading === `${selectedUser.user_id}-activate`}
                        onClick={() => userAction(selectedUser.user_id, "activate")}
                      >
                        Activate
                      </Button>
                    )}
                    {selectedUser.role !== "deleted" && selectedUser.role !== "admin" && (
                      <Button
                        size="sm"
                        variant="destructive"
                        disabled={actionLoading === `${selectedUser.user_id}-delete`}
                        onClick={() => {
                          if (confirm("Are you sure you want to delete this user? This action is irreversible.")) {
                            userAction(selectedUser.user_id, "delete");
                          }
                        }}
                      >
                        Delete
                      </Button>
                    )}
                  </div>
                </div>

                {/* Stats grid */}
                <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                  <div className="rounded-lg border border-border p-3">
                    <p className="text-xs text-muted-foreground">Posts</p>
                    <p className="text-xl font-semibold text-foreground">{selectedUser.post_count}</p>
                  </div>
                  <div className="rounded-lg border border-border p-3">
                    <p className="text-xs text-muted-foreground">Subscribers</p>
                    <p className="text-xl font-semibold text-foreground">{selectedUser.subscriber_count}</p>
                  </div>
                  <div className="rounded-lg border border-border p-3">
                    <p className="text-xs text-muted-foreground">Total Earned</p>
                    <p className="text-xl font-semibold text-emerald-400">
                      {formatCents(selectedUser.total_earned_cents, "USD")}
                    </p>
                  </div>
                  <div className="rounded-lg border border-border p-3">
                    <p className="text-xs text-muted-foreground">Last Active</p>
                    <p className="text-sm font-medium text-foreground">
                      {selectedUser.last_activity_at
                        ? new Date(selectedUser.last_activity_at).toLocaleDateString("en-US", {
                            month: "short",
                            day: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                          })
                        : "Never"}
                    </p>
                  </div>
                </div>

                {/* Info grid */}
                <div className="grid grid-cols-2 gap-x-8 gap-y-2 text-sm">
                  <div>
                    <span className="text-muted-foreground">Phone:</span>{" "}
                    <span className="text-foreground">{selectedUser.phone || "\u2014"}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Country:</span>{" "}
                    <span className="text-foreground">{selectedUser.country || "\u2014"}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Signup IP:</span>{" "}
                    <span className="text-foreground">{selectedUser.signup_ip || "\u2014"}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Last Login IP:</span>{" "}
                    <span className="text-foreground">{selectedUser.last_login_ip || "\u2014"}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Onboarding:</span>{" "}
                    <span className="text-foreground">{selectedUser.onboarding_state || "N/A"}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Joined:</span>{" "}
                    <span className="text-foreground">
                      {new Date(selectedUser.created_at).toLocaleDateString()}
                    </span>
                  </div>
                </div>

                {/* Sub-tabs: Posts | Subscribers */}
                {selectedUser.role === "creator" && (
                  <>
                    <div className="flex gap-2 border-b border-border">
                      {(["posts", "subscribers"] as const).map((st) => (
                        <button
                          key={st}
                          type="button"
                          onClick={() => {
                            setUserDetailTab(st);
                            if (st === "subscribers" && userSubs.length === 0) {
                              fetchUserSubscribers(selectedUser.user_id);
                            }
                          }}
                          className={`border-b-2 px-4 py-2 text-sm font-medium transition-colors ${
                            userDetailTab === st
                              ? "border-primary text-foreground"
                              : "border-transparent text-muted-foreground hover:text-foreground"
                          }`}
                        >
                          {st === "posts"
                            ? `Posts (${selectedUser.post_count})`
                            : `Subscribers (${selectedUser.subscriber_count})`}
                        </button>
                      ))}
                    </div>

                    {/* Posts sub-tab */}
                    {userDetailTab === "posts" && (
                      <div className="space-y-3">
                        {userPosts.length === 0 ? (
                          <p className="py-4 text-center text-sm text-muted-foreground">No posts.</p>
                        ) : (
                          <div className="overflow-x-auto rounded-lg border border-border">
                            <table className="w-full text-sm">
                              <thead>
                                <tr className="border-b border-border bg-muted/50 text-left text-xs uppercase tracking-wider text-muted-foreground">
                                  <th className="px-4 py-3 font-semibold">Type</th>
                                  <th className="px-4 py-3 font-semibold">Caption</th>
                                  <th className="px-4 py-3 font-semibold">Visibility</th>
                                  <th className="px-4 py-3 font-semibold">Status</th>
                                  <th className="px-4 py-3 font-semibold">Price</th>
                                  <th className="px-4 py-3 font-semibold">Date</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-border">
                                {userPosts.map((p) => (
                                  <tr key={p.id} className="text-foreground transition-colors hover:bg-white/[0.03]">
                                    <td className="px-4 py-3 whitespace-nowrap">
                                      <span className="inline-flex items-center rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                                        {p.type}
                                      </span>
                                    </td>
                                    <td className="px-4 py-3 max-w-[200px] truncate text-muted-foreground">
                                      {p.caption || "\u2014"}
                                    </td>
                                    <td className="px-4 py-3 whitespace-nowrap text-xs">{p.visibility}</td>
                                    <td className="px-4 py-3 whitespace-nowrap text-xs">
                                      <span className={p.status === "REMOVED" ? "text-red-400" : ""}>
                                        {p.status}
                                      </span>
                                    </td>
                                    <td className="px-4 py-3 whitespace-nowrap text-xs font-mono">
                                      {p.price_cents ? formatCents(p.price_cents, p.currency || "USD") : "\u2014"}
                                    </td>
                                    <td className="px-4 py-3 whitespace-nowrap text-xs text-muted-foreground">
                                      {new Date(p.created_at).toLocaleDateString("en-US", {
                                        month: "short",
                                        day: "numeric",
                                        year: "numeric",
                                      })}
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        )}
                        <Pagination
                          page={userPostsPage}
                          pageSize={PAGE_SIZE}
                          total={userPostsTotal}
                          onPageChange={(pg) => fetchUserPosts(selectedUser.user_id, pg)}
                        />
                      </div>
                    )}

                    {/* Subscribers sub-tab */}
                    {userDetailTab === "subscribers" && (
                      <div className="space-y-3">
                        {userSubs.length === 0 ? (
                          <p className="py-4 text-center text-sm text-muted-foreground">No subscribers.</p>
                        ) : (
                          <div className="overflow-x-auto rounded-lg border border-border">
                            <table className="w-full text-sm">
                              <thead>
                                <tr className="border-b border-border bg-muted/50 text-left text-xs uppercase tracking-wider text-muted-foreground">
                                  <th className="px-4 py-3 font-semibold">Fan</th>
                                  <th className="px-4 py-3 font-semibold">Email</th>
                                  <th className="px-4 py-3 font-semibold">Status</th>
                                  <th className="px-4 py-3 font-semibold">Since</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-border">
                                {userSubs.map((s) => (
                                  <tr key={s.fan_user_id} className="text-foreground transition-colors hover:bg-white/[0.03]">
                                    <td className="px-4 py-3 whitespace-nowrap font-medium">
                                      {s.fan_display_name}
                                    </td>
                                    <td className="px-4 py-3 whitespace-nowrap text-muted-foreground">
                                      {s.fan_email}
                                    </td>
                                    <td className="px-4 py-3 whitespace-nowrap">
                                      <span className={`text-xs font-medium ${s.status === "active" ? "text-emerald-400" : "text-muted-foreground"}`}>
                                        {s.status}
                                      </span>
                                    </td>
                                    <td className="px-4 py-3 whitespace-nowrap text-xs text-muted-foreground">
                                      {new Date(s.created_at).toLocaleDateString("en-US", {
                                        month: "short",
                                        day: "numeric",
                                        year: "numeric",
                                      })}
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        )}
                        <Pagination
                          page={userSubsPage}
                          pageSize={PAGE_SIZE}
                          total={userSubsTotal}
                          onPageChange={(pg) => fetchUserSubscribers(selectedUser.user_id, pg)}
                        />
                      </div>
                    )}
                  </>
                )}
              </>
            )}
          </CardContent>
        </Card>
      )}

      {/* ============================================================ */}
      {/* POSTS TAB                                                     */}
      {/* ============================================================ */}
      {tab === "posts" && (
        <div className="space-y-3">
          {posts.length === 0 && (
            <p className="py-8 text-center text-sm text-muted-foreground">
              No posts found.
            </p>
          )}
          {posts.map((p) => (
            <Card key={p.id} className="p-4 transition-colors hover:bg-white/[0.02]">
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
          <Pagination page={postsPage} pageSize={PAGE_SIZE} total={postsTotal} onPageChange={(pg) => fetchPosts(pg)} />
        </div>
      )}

      {/* ============================================================ */}
      {/* TRANSACTIONS TAB                                              */}
      {/* ============================================================ */}
      {tab === "transactions" && (
        <Card>
          <CardHeader>
            <CardTitle>Transaction Log</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {transactions.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">
                No transactions recorded yet.
              </p>
            ) : (
              <div className="overflow-x-auto rounded-lg border border-border">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border bg-muted/50 text-left text-xs uppercase tracking-wider text-muted-foreground">
                      <th className="px-4 py-3 font-semibold">Date</th>
                      <th className="px-4 py-3 font-semibold">Type</th>
                      <th className="px-4 py-3 font-semibold">Creator</th>
                      <th className="px-4 py-3 font-semibold text-right">Gross</th>
                      <th className="px-4 py-3 font-semibold text-right">Fee</th>
                      <th className="px-4 py-3 font-semibold text-right">Net</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {transactions.map((tx) => (
                      <tr key={tx.id} className="text-foreground transition-colors hover:bg-white/[0.03]">
                        <td className="px-4 py-3 whitespace-nowrap text-xs text-muted-foreground">
                          {new Date(tx.created_at).toLocaleDateString("en-US", {
                            month: "short",
                            day: "numeric",
                            year: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </td>
                        <td className="px-4 py-3">
                          <span className="inline-flex items-center rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                            {txTypeLabel(tx.type)}
                          </span>
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          {tx.creator_display_name || "\u2014"}
                          {tx.creator_handle && (
                            <span className="ml-1 text-muted-foreground">
                              @{tx.creator_handle}
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right font-mono">
                          {formatCents(tx.gross_cents, tx.currency)}
                        </td>
                        <td className="px-4 py-3 text-right font-mono text-muted-foreground">
                          {formatCents(tx.fee_cents, tx.currency)}
                        </td>
                        <td className="px-4 py-3 text-right font-mono text-emerald-400">
                          {formatCents(tx.net_cents, tx.currency)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <Pagination page={txPage} pageSize={PAGE_SIZE} total={txTotal} onPageChange={(pg) => fetchTransactions(pg)} />
          </CardContent>
        </Card>
      )}

      {/* ============================================================ */}
      {/* INBOX TAB                                                     */}
      {/* ============================================================ */}
      {tab === "inbox" && (
        <div className="space-y-4">
          {/* Category filter bar + sync button */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => { setInboxCategory(null); setSelectedEmail(null); }}
              className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                !inboxCategory
                  ? "bg-foreground text-background"
                  : "bg-muted text-muted-foreground hover:text-foreground"
              }`}
            >
              All ({inboxStats?.total ?? 0})
            </button>
            {inboxStats?.categories.map((cat) => (
              <button
                key={cat.category}
                type="button"
                onClick={() => { setInboxCategory(cat.category); setSelectedEmail(null); }}
                className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                  inboxCategory === cat.category
                    ? "bg-foreground text-background"
                    : "bg-muted text-muted-foreground hover:text-foreground"
                }`}
              >
                {CATEGORY_LABELS[cat.category] || cat.category} ({cat.total})
                {cat.unread > 0 && (
                  <span className="ml-1 inline-flex h-4 min-w-[16px] items-center justify-center rounded-full bg-primary px-1 text-[9px] font-bold text-white">
                    {cat.unread}
                  </span>
                )}
              </button>
            ))}
            <Button
              size="sm"
              variant="secondary"
              onClick={syncInbox}
              disabled={syncing}
              className="ml-auto"
            >
              {syncing ? "Syncing..." : "Sync from Resend"}
            </Button>
          </div>

          {selectedEmail ? (
            /* Email detail view */
            <Card className="overflow-hidden">
              <div className="border-b border-border px-4 py-3">
                <button
                  type="button"
                  onClick={() => setSelectedEmail(null)}
                  className="mb-2 text-xs text-primary hover:underline"
                >
                  &larr; Back to inbox
                </button>
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <h2 className="text-lg font-semibold text-foreground">
                      {selectedEmail.subject || "(no subject)"}
                    </h2>
                    <p className="mt-1 text-sm text-muted-foreground">
                      From: <span className="text-foreground">{selectedEmail.from_address}</span>
                    </p>
                    <p className="text-xs text-muted-foreground">
                      To: {selectedEmail.to_addresses.join(", ")}
                      {selectedEmail.cc_addresses.length > 0 && (
                        <> · CC: {selectedEmail.cc_addresses.join(", ")}</>
                      )}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(selectedEmail.received_at).toLocaleString()}
                    </p>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1">
                    <span className={`rounded px-2 py-0.5 text-[10px] font-semibold uppercase ${CATEGORY_COLORS[selectedEmail.category] || CATEGORY_COLORS.unknown}`}>
                      {CATEGORY_LABELS[selectedEmail.category] || selectedEmail.category}
                    </span>
                    {selectedEmail.spf_result && (
                      <span className={`text-[10px] ${selectedEmail.spf_result === "pass" ? "text-emerald-400" : "text-red-400"}`}>
                        SPF: {selectedEmail.spf_result}
                      </span>
                    )}
                    {selectedEmail.dkim_result && (
                      <span className={`text-[10px] ${selectedEmail.dkim_result === "pass" ? "text-emerald-400" : "text-red-400"}`}>
                        DKIM: {selectedEmail.dkim_result}
                      </span>
                    )}
                    {selectedEmail.forwarded_to && (
                      <span className="text-[10px] text-muted-foreground">
                        Fwd: {selectedEmail.forwarded_to}
                      </span>
                    )}
                  </div>
                </div>
              </div>
              {/* Attachments */}
              {selectedEmail.attachment_count > 0 && (
                <div className="border-b border-border bg-muted/30 px-4 py-2">
                  <p className="text-xs font-medium text-muted-foreground">
                    {selectedEmail.attachment_count} attachment{selectedEmail.attachment_count > 1 ? "s" : ""}
                  </p>
                  <div className="mt-1 flex flex-wrap gap-2">
                    {selectedEmail.attachments_meta.map((a) => (
                      <span
                        key={a.id}
                        className="inline-flex items-center gap-1 rounded border border-border bg-background px-2 py-1 text-xs"
                      >
                        {a.filename} ({formatBytes(a.size)})
                      </span>
                    ))}
                  </div>
                </div>
              )}
              {/* Body */}
              <CardContent className="p-4">
                {emailLoading ? (
                  <Skeleton className="h-40 w-full" />
                ) : selectedEmail.html_body ? (
                  <div
                    className="prose prose-invert max-w-none text-sm [&_a]:text-primary"
                    dangerouslySetInnerHTML={{ __html: selectedEmail.html_body }}
                  />
                ) : (
                  <pre className="whitespace-pre-wrap text-sm text-foreground">
                    {selectedEmail.text_body || "(empty)"}
                  </pre>
                )}
              </CardContent>
            </Card>
          ) : (
            /* Email list view */
            <div className="space-y-2">
              {inboxEmails.length === 0 && (
                <p className="py-8 text-center text-sm text-muted-foreground">
                  No emails received yet.{" "}
                  <button
                    type="button"
                    onClick={syncInbox}
                    className="text-primary underline"
                  >
                    Sync now
                  </button>
                </p>
              )}
              {inboxEmails.map((e) => (
                <button
                  key={e.id}
                  type="button"
                  onClick={() => openEmail(e.id)}
                  className={`w-full rounded-lg border px-4 py-3 text-left transition-colors hover:bg-white/5 ${
                    e.is_read
                      ? "border-border bg-card"
                      : "border-primary/20 bg-primary/5"
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        {!e.is_read && (
                          <span className="h-2 w-2 shrink-0 rounded-full bg-primary" />
                        )}
                        <span className={`text-sm truncate ${e.is_read ? "text-foreground" : "font-semibold text-foreground"}`}>
                          {e.from_address}
                        </span>
                        <span className={`shrink-0 rounded px-1.5 py-0.5 text-[9px] font-semibold uppercase leading-none ${CATEGORY_COLORS[e.category] || CATEGORY_COLORS.unknown}`}>
                          {CATEGORY_LABELS[e.category] || e.category}
                        </span>
                      </div>
                      <p className={`mt-0.5 text-sm truncate ${e.is_read ? "text-foreground/80" : "font-medium text-foreground"}`}>
                        {e.subject || "(no subject)"}
                      </p>
                      <p className="mt-0.5 text-xs text-muted-foreground truncate">
                        {e.snippet || "\u2014"}
                      </p>
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-1">
                      <span className="text-xs text-muted-foreground whitespace-nowrap">
                        {new Date(e.received_at).toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                      {e.attachment_count > 0 && (
                        <span className="text-[10px] text-muted-foreground">
                          {e.attachment_count} file{e.attachment_count > 1 ? "s" : ""}
                        </span>
                      )}
                      {e.forwarded_to && (
                        <span className="text-[10px] text-emerald-400">Forwarded</span>
                      )}
                    </div>
                  </div>
                </button>
              ))}
              <Pagination page={inboxPage} pageSize={PAGE_SIZE} total={inboxTotal} onPageChange={(pg) => fetchInbox(pg)} />
            </div>
          )}
        </div>
      )}
    </Page>
  );
}
