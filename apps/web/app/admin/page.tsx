"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Page } from "@/components/brand/Page";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { Spinner } from "@/components/ui/spinner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Pagination } from "@/components/ui/pagination";
import { Skeleton } from "@/components/ui/skeleton";
import { apiFetch } from "@/lib/api/client";
import { getApiErrorMessage } from "@/lib/errors";
import { useRequireRole } from "@/lib/hooks/useRequireRole";
import { useTranslation, interpolate, type Dictionary } from "@/lib/i18n";
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
  // Device info
  user_agent: string | null;
  device_type: string | null;
  os_name: string | null;
  browser_name: string | null;
  screen_width: number | null;
  screen_height: number | null;
  timezone: string | null;
  language: string | null;
  camera_available: boolean | null;
  microphone_available: boolean | null;
  connection_type: string | null;
  latitude: number | null;
  longitude: number | null;
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

type SupportMessage = {
  id: string;
  email: string;
  category: string;
  subject: string;
  message: string;
  ip_address: string | null;
  is_read: boolean;
  resolved: boolean;
  admin_notes: string | null;
  created_at: string;
};

type AdminMediaItem = {
  id: string;
  object_key: string;
  content_type: string;
  size_bytes: number;
  created_at: string;
};

type AdminKycSession = {
  id: string;
  status: string;
  date_of_birth: string | null;
  id_document_url: string | null;
  selfie_url: string | null;
  admin_notes: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  redirect_url?: string | null;
  created_at: string;
  updated_at?: string | null;
  creator?: {
    user_id: string;
    email: string;
    display_name: string;
    handle: string | null;
    avatar_url: string | null;
  };
};

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

function txTypeLabel(type: string, adminT: Dictionary["admin"]): string {
  switch (type) {
    case "SUBSCRIPTION": return adminT.txTypeSubscription;
    case "TIP": return adminT.txTypeTip;
    case "PPV_UNLOCK": return adminT.txTypePpvUnlock;
    case "PPV_POST_UNLOCK": return adminT.txTypePpvPostUnlock;
    default: return type.replace(/_/g, " ");
  }
}

const ROLE_COLORS: Record<string, string> = {
  creator: "bg-purple-500/15 text-purple-400",
  fan: "bg-blue-500/15 text-blue-400",
  admin: "bg-amber-500/15 text-amber-400",
  super_admin: "bg-rose-500/15 text-rose-400",
  deleted: "bg-red-500/15 text-red-400",
};

const STATUS_COLORS: Record<string, string> = {
  active: "text-emerald-400",
  suspended: "text-red-400",
  deleted: "text-red-400",
};

function getCategoryLabels(adminT: Dictionary["admin"]): Record<string, string> {
  return {
    support: adminT.categorySupport,
    privacy: adminT.categoryPrivacy,
    creators: adminT.categoryCreators,
    safety: adminT.categorySafety,
    legal: adminT.categoryLegal,
    unknown: adminT.categoryUnknown,
  };
}

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

function userStatusLabel(u: AdminUser, adminT: Dictionary["admin"]): string {
  if (u.role === "deleted") return adminT.userStatusDeleted;
  return u.is_active ? adminT.userStatusActive : adminT.userStatusSuspended;
}

/* ------------------------------------------------------------------ */
/* Component                                                           */
/* ------------------------------------------------------------------ */

const PAGE_SIZE = 25;
function getRoleFilters(adminT: Dictionary["admin"]) {
  return [
    { value: null, label: adminT.roleFilterAll },
    { value: "fan", label: adminT.roleFilterFan },
    { value: "creator", label: adminT.roleFilterCreator },
    { value: "admin", label: adminT.roleFilterAdmin },
    { value: "deleted", label: adminT.roleFilterDeleted },
  ] as const;
}

export default function AdminPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { t } = useTranslation();
  const { authorized, user: adminUser } = useRequireRole(["admin", "super_admin"]);
  const isSuperAdmin = adminUser?.role === "super_admin";
  const ROLE_FILTERS = getRoleFilters(t.admin);
  const CATEGORY_LABELS = getCategoryLabels(t.admin);
  type AdminTab = "users" | "posts" | "transactions" | "inbox" | "moderation" | "kyc";
  const VALID_TABS: AdminTab[] = ["users", "posts", "transactions", "inbox", "moderation", ...(isSuperAdmin ? ["kyc" as const] : [])];
  const initialTab = (VALID_TABS.includes(searchParams.get("tab") as AdminTab) ? searchParams.get("tab") : "users") as AdminTab;
  const [tab, setTab] = useState<AdminTab>(initialTab);
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
  const [userDetailTab, setUserDetailTab] = useState<"posts" | "subscribers" | "media" | "kyc">("posts");
  const [userPosts, setUserPosts] = useState<AdminUserPost[]>([]);
  const [userPostsTotal, setUserPostsTotal] = useState(0);
  const [userPostsPage, setUserPostsPage] = useState(1);
  const [userSubs, setUserSubs] = useState<AdminUserSubscriber[]>([]);
  const [userSubsTotal, setUserSubsTotal] = useState(0);
  const [userSubsPage, setUserSubsPage] = useState(1);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [hardDeleteConfirm, setHardDeleteConfirm] = useState<string | null>(null);
  const [showCreateUser, setShowCreateUser] = useState(false);
  const [newEmail, setNewEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newDisplayName, setNewDisplayName] = useState("");
  const [newRole, setNewRole] = useState<"admin" | "fan" | "creator">("admin");
  const [createLoading, setCreateLoading] = useState(false);

  // Notification form
  const [showNotifyForm, setShowNotifyForm] = useState<"broadcast" | "user" | null>(null);
  const [notifyTitle, setNotifyTitle] = useState("");
  const [notifyMessage, setNotifyMessage] = useState("");
  const [notifyRole, setNotifyRole] = useState<"fan" | "creator" | "all">("all");
  const [notifySendEmail, setNotifySendEmail] = useState(false);
  const [notifyLoading, setNotifyLoading] = useState(false);

  /* ---- Posts state ---- */
  const [posts, setPosts] = useState<AdminPost[]>([]);
  const [postsTotal, setPostsTotal] = useState(0);
  const [postsPage, setPostsPage] = useState(1);

  /* ---- Transactions state ---- */
  const [transactions, setTransactions] = useState<AdminTransaction[]>([]);
  const [txTotal, setTxTotal] = useState(0);
  const [txPage, setTxPage] = useState(1);

  /* ---- Support Messages state ---- */
  const [supportMessages, setSupportMessages] = useState<SupportMessage[]>([]);
  const [supportTotal, setSupportTotal] = useState(0);
  const [supportPage, setSupportPage] = useState(1);
  const [supportUnread, setSupportUnread] = useState(0);
  const [supportCategory, setSupportCategory] = useState<string | null>(null);
  const [supportResolved, setSupportResolved] = useState<boolean | null>(false);
  const [selectedMessage, setSelectedMessage] = useState<SupportMessage | null>(null);

  /* ---- User media & KYC state ---- */
  const [userMedia, setUserMedia] = useState<AdminMediaItem[]>([]);
  const [userMediaTotal, setUserMediaTotal] = useState(0);
  const [userMediaPage, setUserMediaPage] = useState(1);
  const [userKyc, setUserKyc] = useState<AdminKycSession[]>([]);
  const [kycReviewNotes, setKycReviewNotes] = useState<Record<string, string>>({});
  const [kycReviewing, setKycReviewing] = useState<string | null>(null);
  const [deleteMediaConfirm, setDeleteMediaConfirm] = useState<string | null>(null);

  /* ---- Global KYC tab state ---- */
  const [globalKyc, setGlobalKyc] = useState<AdminKycSession[]>([]);
  const [globalKycTotal, setGlobalKycTotal] = useState(0);
  const [globalKycPage, setGlobalKycPage] = useState(1);
  const [globalKycFilter, setGlobalKycFilter] = useState<string>("SUBMITTED");
  const [globalKycLoading, setGlobalKycLoading] = useState(false);

  /* ---- Moderation state ---- */
  type ModerationItem = {
    scan_id: string;
    media_asset_id: string;
    nsfw_score: number;
    nsfw_label: string;
    age_range_prediction: string;
    underage_likelihood_proxy: number;
    risk_level: string;
    decision: string;
    created_at: string;
    owner_user_id: string | null;
  };
  const [modItems, setModItems] = useState<ModerationItem[]>([]);
  const [modTotal, setModTotal] = useState(0);
  const [modPage, setModPage] = useState(1);
  const [modLoading, setModLoading] = useState(false);

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

  /* ---- Fetch: support messages ---- */
  const fetchInbox = useCallback(
    async (pg = 1) => {
      try {
        const query: Record<string, string | number | boolean> = { page: pg, page_size: PAGE_SIZE };
        if (supportCategory) query.category = supportCategory;
        if (supportResolved !== null) query.resolved = supportResolved;
        const data = await apiFetch<{ items: SupportMessage[]; total: number; unread_count: number }>("/admin/support-messages", { method: "GET", query });
        setSupportMessages(data.items);
        setSupportTotal(data.total);
        setSupportUnread(data.unread_count);
        setSupportPage(pg);
        setError(null);
      } catch (err) {
        handleApiError(err);
      }
    },
    [supportCategory, supportResolved, handleApiError],
  );

  const fetchModeration = useCallback(async (page = modPage) => {
    setModLoading(true);
    try {
      const data = await apiFetch<{ items: ModerationItem[]; total: number }>(
        `/ai-safety/admin/pending-reviews?page=${page}&page_size=20`,
        { method: "GET" },
      );
      setModItems(data.items);
      setModTotal(data.total);
      setModPage(page);
    } catch (err) {
      // AI safety may not be enabled — silently ignore
    } finally {
      setModLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [modPage]);

  const handleModReview = async (scanId: string, decision: "APPROVED" | "REJECTED") => {
    setActionLoading(scanId);
    try {
      await apiFetch(`/ai-safety/admin/review/${scanId}`, {
        method: "POST",
        body: JSON.stringify({ decision }),
      });
      fetchModeration(modPage);
    } catch (err) {
      handleApiError(err);
    } finally {
      setActionLoading(null);
    }
  };

  const fetchInboxStats = useCallback(async () => {
    // Stats are fetched inline with support-messages endpoint
  }, []);

  const openSupportMessage = async (msg: SupportMessage) => {
    setSelectedMessage(msg);
    if (!msg.is_read) {
      try {
        await apiFetch(`/admin/support-messages/${msg.id}/read`, { method: "POST" });
        setSupportMessages((prev) => prev.map((m) => (m.id === msg.id ? { ...m, is_read: true } : m)));
        setSupportUnread((c) => Math.max(0, c - 1));
      } catch { /* non-critical */ }
    }
  };

  const resolveSupportMessage = async (msgId: string) => {
    setActionLoading(msgId);
    try {
      await apiFetch(`/admin/support-messages/${msgId}/resolve`, { method: "POST" });
      setSupportMessages((prev) => prev.map((m) => (m.id === msgId ? { ...m, resolved: true, is_read: true } : m)));
      setSelectedMessage(null);
    } catch (err) {
      handleApiError(err);
    } finally {
      setActionLoading(null);
    }
  };

  const fetchUserMedia = async (userId: string, pg = 1) => {
    try {
      const data = await apiFetch<{ items: AdminMediaItem[]; total: number }>(`/admin/users/${userId}/media`, {
        method: "GET",
        query: { page: pg, page_size: PAGE_SIZE },
      });
      setUserMedia(data.items);
      setUserMediaTotal(data.total);
      setUserMediaPage(pg);
    } catch (err) {
      handleApiError(err);
    }
  };

  const deleteMedia = async (mediaId: string) => {
    setActionLoading(mediaId);
    try {
      await apiFetch(`/admin/media/${mediaId}`, { method: "DELETE" });
      setUserMedia((prev) => prev.filter((m) => m.id !== mediaId));
      setUserMediaTotal((t) => t - 1);
      setDeleteMediaConfirm(null);
    } catch (err) {
      handleApiError(err);
    } finally {
      setActionLoading(null);
    }
  };

  const fetchUserKyc = async (userId: string) => {
    try {
      const data = await apiFetch<{ items: AdminKycSession[]; total: number }>(`/admin/users/${userId}/kyc`, { method: "GET" });
      setUserKyc(data.items);
    } catch (err) {
      handleApiError(err);
    }
  };

  const fetchGlobalKyc = useCallback(
    async (pg = 1, statusFilter = globalKycFilter) => {
      setGlobalKycLoading(true);
      try {
        const query: Record<string, string | number> = { page: pg, page_size: PAGE_SIZE };
        if (statusFilter) query.status = statusFilter;
        const data = await apiFetch<PagedResult<AdminKycSession>>("/admin/kyc/sessions", {
          method: "GET",
          query,
        });
        setGlobalKyc(data.items);
        setGlobalKycTotal(data.total);
        setGlobalKycPage(pg);
        setError(null);
      } catch (err) {
        handleApiError(err);
      } finally {
        setGlobalKycLoading(false);
      }
    },
    [globalKycFilter, handleApiError],
  );

  const reviewKyc = async (sessionId: string, action: "approve" | "reject") => {
    try {
      setKycReviewing(sessionId);
      await apiFetch(`/admin/kyc/${sessionId}/review`, {
        method: "POST",
        body: { action, notes: kycReviewNotes[sessionId] || null },
      });
      setKycReviewNotes((prev) => { const next = { ...prev }; delete next[sessionId]; return next; });
      if (selectedUser) fetchUserKyc(selectedUser.user_id);
      if (tab === "kyc") fetchGlobalKyc(globalKycPage, globalKycFilter);
    } catch (err) {
      handleApiError(err);
    } finally {
      setKycReviewing(null);
    }
  };

  /* ---- Tab switch data loading ---- */
  useEffect(() => {
    if (tab === "users") fetchUsers();
    else if (tab === "posts") fetchPosts();
    else if (tab === "transactions") fetchTransactions();
    else if (tab === "moderation") fetchModeration();
    else if (tab === "kyc") fetchGlobalKyc();
    else {
      fetchInbox();
      fetchInboxStats();
    }
  }, [tab, fetchUsers, fetchPosts, fetchTransactions, fetchInbox, fetchInboxStats, fetchModeration, fetchGlobalKyc]);

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
        ...(action === "hard_delete" ? { timeoutMs: 60_000 } : {}),
      });
      if (action === "hard_delete") {
        // User is gone — close detail and refresh list
        setSelectedUser(null);
      } else if (selectedUser?.user_id === userId) {
        const data = await apiFetch<AdminUserDetail>(`/admin/users/${userId}`, { method: "GET" });
        setSelectedUser(data);
      }
      fetchUsers(usersPage);
      setDeleteConfirm(null);
      setHardDeleteConfirm(null);
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

  /* ---- Send notification handler ---- */
  const handleSendNotification = async (targetUserId?: string) => {
    if (!notifyTitle || !notifyMessage) return;
    setNotifyLoading(true);
    setError(null);
    try {
      const body: Record<string, unknown> = {
        title: notifyTitle,
        message: notifyMessage,
        send_email: notifySendEmail,
      };
      if (targetUserId) {
        body.target_user_id = targetUserId;
      } else {
        body.target_role = notifyRole;
      }
      const result = await apiFetch<{ sent_count: number; email_count: number }>(
        "/admin/notifications/send",
        { method: "POST", body },
      );
      alert(`Sent ${result.sent_count} notification(s)${result.email_count > 0 ? ` + ${result.email_count} email(s)` : ""}.`);
      setShowNotifyForm(null);
      setNotifyTitle("");
      setNotifyMessage("");
      setNotifySendEmail(false);
    } catch (err) {
      handleApiError(err);
    } finally {
      setNotifyLoading(false);
    }
  };

  /* ---- Create user handler ---- */
  const handleCreateUser = async () => {
    setCreateLoading(true);
    setError(null);
    try {
      await apiFetch("/admin/create-user", {
        method: "POST",
        body: {
          email: newEmail,
          password: newPassword,
          display_name: newDisplayName,
          role: newRole,
        },
      });
      setShowCreateUser(false);
      setNewEmail("");
      setNewPassword("");
      setNewDisplayName("");
      setNewRole("admin");
      fetchUsers(1);
    } catch (err) {
      handleApiError(err);
    } finally {
      setCreateLoading(false);
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
      <div>
        <h1 className="font-display text-premium-h2 font-semibold text-foreground">
          Admin Dashboard
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Manage users, content, transactions, and support inbox.
        </p>
      </div>

      {error && (
        <Card className="border-destructive/20 bg-destructive/5 p-4">
          <p className="text-sm text-destructive">{error}</p>
        </Card>
      )}

      {/* Tab selector */}
      <div className="flex gap-2 rounded-xl border border-border bg-muted/50 p-1">
        {([...["users", "posts", "transactions", "inbox", "moderation"] as const, ...(isSuperAdmin ? ["kyc" as const] : [])]).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => {
              setTab(t);
              setSelectedUser(null);
              setSelectedMessage(null);
            }}
            className={`flex-1 inline-flex items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
              tab === t
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {t === "users" && <><Icon name="group" className="icon-base" /> Users ({usersTotal})</>}
            {t === "posts" && <><Icon name="article" className="icon-base" /> Posts ({postsTotal})</>}
            {t === "transactions" && <><Icon name="payments" className="icon-base" /> Transactions ({txTotal})</>}
            {t === "inbox" && (
              <>
                <Icon name="inbox" className="icon-base" /> Support
                {supportUnread > 0 && (
                  <span className="ml-1.5 inline-flex h-5 min-w-[20px] items-center justify-center rounded-full bg-primary px-1 text-[10px] font-bold text-white">
                    {supportUnread}
                  </span>
                )}
              </>
            )}
            {t === "moderation" && (
              <>
                <Icon name="shield" className="icon-base" /> Moderation
                {modTotal > 0 && (
                  <span className="ml-1.5 inline-flex h-5 min-w-[20px] items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-bold text-white">
                    {modTotal}
                  </span>
                )}
              </>
            )}
            {t === "kyc" && (
              <>
                <Icon name="verified_user" className="icon-base" /> KYC
                {globalKycTotal > 0 && (
                  <span className="ml-1.5 inline-flex h-5 min-w-[20px] items-center justify-center rounded-full bg-amber-500 px-1 text-[10px] font-bold text-white">
                    {globalKycTotal}
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
              {isSuperAdmin && (
                <div className="ml-auto flex gap-2">
                  <Button
                    size="sm"
                    variant="secondary"
                    className="border-amber-500/30 text-amber-400 hover:bg-amber-500/10"
                    onClick={() => setShowNotifyForm((v) => v === "broadcast" ? null : "broadcast")}
                  >
                    {showNotifyForm === "broadcast" ? <><Icon name="close" className="icon-sm" /> Cancel</> : <><Icon name="campaign" className="icon-sm" /> Broadcast</>}
                  </Button>
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => setShowCreateUser((v) => !v)}
                  >
                    {showCreateUser ? <><Icon name="close" className="icon-sm" /> Cancel</> : <><Icon name="person_add" className="icon-sm" /> Create User</>}
                  </Button>
                  <Button
                    size="sm"
                    variant="destructive"
                    className="bg-red-700 hover:bg-red-800"
                    disabled={actionLoading === "bulk-delete"}
                    onClick={async () => {
                      const keepInput = prompt(
                        "This will PERMANENTLY DELETE all users except the emails listed below and your super_admin account.\n\nEnter emails to keep (comma-separated):",
                        "strella@zinovia.ai"
                      );
                      if (keepInput === null) return;
                      if (!confirm(`CONFIRM: Delete ALL users except super_admin and [${keepInput}]?\n\nThis cannot be undone!`)) return;
                      setActionLoading("bulk-delete");
                      try {
                        const keep = keepInput.split(",").map((e) => e.trim()).filter(Boolean);
                        const result = await apiFetch<{ deleted_count: number }>("/admin/bulk-delete-users", {
                          method: "POST",
                          body: { keep_emails: keep },
                        });
                        alert(`Deleted ${result.deleted_count} users.`);
                        fetchUsers(1);
                      } catch (err) {
                        handleApiError(err);
                      } finally {
                        setActionLoading(null);
                      }
                    }}
                  >
                    {actionLoading === "bulk-delete" ? <><Spinner className="icon-sm" /> Deleting...</> : <><Icon name="delete_sweep" className="icon-sm" /> Cleanup All Users</>}
                  </Button>
                </div>
              )}
            </div>

            {/* Create User form (super_admin only) */}
            {showCreateUser && (
              <div className="rounded-xl border border-border bg-muted/20 p-4 space-y-3">
                <h3 className="text-sm font-semibold text-foreground">Create New User</h3>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <Input
                    placeholder="Email"
                    type="email"
                    value={newEmail}
                    onChange={(e) => setNewEmail(e.target.value)}
                  />
                  <Input
                    placeholder="Password (min 10 chars)"
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                  />
                  <Input
                    placeholder="Display Name"
                    value={newDisplayName}
                    onChange={(e) => setNewDisplayName(e.target.value)}
                  />
                  <select
                    value={newRole}
                    onChange={(e) => setNewRole(e.target.value as "admin" | "fan" | "creator")}
                    className="rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground"
                  >
                    <option value="admin">Admin</option>
                    <option value="fan">Fan</option>
                    <option value="creator">Creator</option>
                  </select>
                </div>
                <Button
                  size="sm"
                  disabled={createLoading || !newEmail || !newPassword || !newDisplayName || newPassword.length < 10}
                  onClick={handleCreateUser}
                >
                  {createLoading ? "Creating..." : "Create User"}
                </Button>
              </div>
            )}

            {/* Broadcast Notification form */}
            {showNotifyForm === "broadcast" && (
              <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-4 space-y-3">
                <h3 className="text-sm font-semibold text-foreground">Broadcast Notification</h3>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <Input
                    placeholder="Title"
                    value={notifyTitle}
                    onChange={(e) => setNotifyTitle(e.target.value)}
                  />
                  <select
                    value={notifyRole}
                    onChange={(e) => setNotifyRole(e.target.value as "fan" | "creator" | "all")}
                    className="rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground"
                  >
                    <option value="all">All Users</option>
                    <option value="fan">Fans Only</option>
                    <option value="creator">Creators Only</option>
                  </select>
                </div>
                <textarea
                  placeholder="Message body..."
                  value={notifyMessage}
                  onChange={(e) => setNotifyMessage(e.target.value)}
                  rows={3}
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground resize-none"
                />
                <div className="flex items-center gap-4">
                  <label className="flex items-center gap-2 text-sm text-muted-foreground">
                    <input
                      type="checkbox"
                      checked={notifySendEmail}
                      onChange={(e) => setNotifySendEmail(e.target.checked)}
                      className="rounded"
                    />
                    Also send email
                  </label>
                  <div className="ml-auto flex gap-2">
                    <Button size="sm" variant="secondary" onClick={() => setShowNotifyForm(null)}>
                      Cancel
                    </Button>
                    <Button
                      size="sm"
                      disabled={notifyLoading || !notifyTitle || !notifyMessage}
                      onClick={() => handleSendNotification()}
                    >
                      {notifyLoading ? "Sending..." : "Send Broadcast"}
                    </Button>
                  </div>
                </div>
              </div>
            )}

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
                            {userStatusLabel(u, t.admin)}
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
                          {/* Never show actions for own account or super_admin users */}
                          {u.user_id !== adminUser?.id && u.role !== "super_admin" && (
                          <div className="flex justify-end gap-1.5">
                            {u.role !== "deleted" && u.is_active && u.role !== "admin" && (
                              <Button
                                size="sm"
                                variant="secondary"
                                disabled={actionLoading === `${u.user_id}-suspend`}
                                onClick={() => userAction(u.user_id, "suspend")}
                              >
                                <Icon name="pause_circle" className="icon-sm" /> Suspend
                              </Button>
                            )}
                            {u.role !== "deleted" && !u.is_active && (
                              <Button
                                size="sm"
                                variant="secondary"
                                disabled={actionLoading === `${u.user_id}-activate`}
                                onClick={() => userAction(u.user_id, "activate")}
                              >
                                <Icon name="play_circle" className="icon-sm" /> Activate
                              </Button>
                            )}
                            {u.role !== "deleted" && u.role !== "admin" && u.role !== "super_admin" && (
                              <>
                                {deleteConfirm === u.user_id ? (
                                  <div className="flex gap-1">
                                    <Button
                                      size="sm"
                                      variant="destructive"
                                      disabled={actionLoading === `${u.user_id}-delete`}
                                      onClick={() => userAction(u.user_id, "delete")}
                                    >
                                      <Icon name="delete_forever" className="icon-sm" /> Confirm
                                    </Button>
                                    <Button
                                      size="sm"
                                      variant="secondary"
                                      onClick={() => setDeleteConfirm(null)}
                                    >
                                      <Icon name="close" className="icon-sm" /> Cancel
                                    </Button>
                                  </div>
                                ) : (
                                  <Button
                                    size="sm"
                                    variant="destructive"
                                    onClick={() => setDeleteConfirm(u.user_id)}
                                  >
                                    <Icon name="delete" className="icon-sm" /> Delete
                                  </Button>
                                )}
                              </>
                            )}
                            {u.role !== "admin" && u.role !== "super_admin" && (
                              <>
                                {hardDeleteConfirm === u.user_id ? (
                                  <div className="flex gap-1">
                                    <Button
                                      size="sm"
                                      variant="destructive"
                                      className="bg-red-700 hover:bg-red-800"
                                      disabled={actionLoading === `${u.user_id}-hard_delete`}
                                      onClick={() => userAction(u.user_id, "hard_delete", "Admin hard delete")}
                                    >
                                      <Icon name="delete_forever" className="icon-sm" /> Permanently delete?
                                    </Button>
                                    <Button
                                      size="sm"
                                      variant="secondary"
                                      onClick={() => setHardDeleteConfirm(null)}
                                    >
                                      <Icon name="close" className="icon-sm" /> Cancel
                                    </Button>
                                  </div>
                                ) : (
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    className="text-red-400 hover:text-red-300 hover:bg-red-500/10"
                                    onClick={() => setHardDeleteConfirm(u.user_id)}
                                  >
                                    <Icon name="delete_sweep" className="icon-sm" /> Hard Delete
                                  </Button>
                                )}
                              </>
                            )}
                          </div>
                          )}
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
              className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
            >
              <Icon name="arrow_back" className="icon-xs" /> Back to users
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
                        {userStatusLabel(selectedUser, t.admin)}
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
                        <Icon name="check_circle" className="icon-sm" /> Approve
                      </Button>
                    )}
                    {selectedUser.role === "creator" && selectedUser.discoverable && (
                      <Button
                        size="sm"
                        variant="secondary"
                        disabled={actionLoading === `${selectedUser.user_id}-reject`}
                        onClick={() => userAction(selectedUser.user_id, "reject")}
                      >
                        <Icon name="visibility_off" className="icon-sm" /> Hide
                      </Button>
                    )}
                    {selectedUser.role === "creator" && !selectedUser.featured && (
                      <Button
                        size="sm"
                        variant="secondary"
                        disabled={actionLoading === `${selectedUser.user_id}-feature`}
                        onClick={() => userAction(selectedUser.user_id, "feature")}
                      >
                        <Icon name="star" className="icon-sm" /> Feature
                      </Button>
                    )}
                    {selectedUser.role === "creator" && selectedUser.featured && (
                      <Button
                        size="sm"
                        variant="secondary"
                        disabled={actionLoading === `${selectedUser.user_id}-unfeature`}
                        onClick={() => userAction(selectedUser.user_id, "unfeature")}
                      >
                        <Icon name="star" filled className="icon-sm" /> Unfeature
                      </Button>
                    )}
                    {selectedUser.user_id !== adminUser?.id && selectedUser.role !== "super_admin" && selectedUser.role !== "deleted" && selectedUser.is_active && (
                      <Button
                        size="sm"
                        variant="secondary"
                        disabled={actionLoading === `${selectedUser.user_id}-suspend`}
                        onClick={() => userAction(selectedUser.user_id, "suspend")}
                      >
                        <Icon name="pause_circle" className="icon-sm" /> Suspend
                      </Button>
                    )}
                    {selectedUser.user_id !== adminUser?.id && selectedUser.role !== "deleted" && !selectedUser.is_active && (
                      <Button
                        size="sm"
                        variant="secondary"
                        disabled={actionLoading === `${selectedUser.user_id}-activate`}
                        onClick={() => userAction(selectedUser.user_id, "activate")}
                      >
                        <Icon name="play_circle" className="icon-sm" /> Activate
                      </Button>
                    )}
                    {/* Promote/Demote — super_admin only */}
                    {isSuperAdmin && selectedUser.role !== "admin" && selectedUser.role !== "super_admin" && selectedUser.role !== "deleted" && (
                      <Button
                        size="sm"
                        variant="secondary"
                        className="border-amber-500/30 text-amber-400 hover:bg-amber-500/10"
                        disabled={actionLoading === `${selectedUser.user_id}-promote_admin`}
                        onClick={() => {
                          if (confirm(`Promote ${selectedUser.display_name} to admin?`)) {
                            userAction(selectedUser.user_id, "promote_admin");
                          }
                        }}
                      >
                        <Icon name="admin_panel_settings" className="icon-sm" /> Promote to Admin
                      </Button>
                    )}
                    {isSuperAdmin && selectedUser.role === "admin" && (
                      <Button
                        size="sm"
                        variant="secondary"
                        disabled={actionLoading === `${selectedUser.user_id}-demote_admin`}
                        onClick={() => {
                          if (confirm(`Demote ${selectedUser.display_name} from admin to fan?`)) {
                            userAction(selectedUser.user_id, "demote_admin");
                          }
                        }}
                      >
                        <Icon name="person_remove" className="icon-sm" /> Demote Admin
                      </Button>
                    )}
                    {selectedUser.user_id !== adminUser?.id && selectedUser.role !== "deleted" && selectedUser.role !== "admin" && selectedUser.role !== "super_admin" && (
                      <Button
                        size="sm"
                        variant="destructive"
                        disabled={actionLoading === `${selectedUser.user_id}-delete`}
                        onClick={() => {
                          if (confirm("Are you sure you want to soft-delete this user?")) {
                            userAction(selectedUser.user_id, "delete");
                          }
                        }}
                      >
                        <Icon name="delete" className="icon-sm" /> Delete
                      </Button>
                    )}
                    {selectedUser.user_id !== adminUser?.id && selectedUser.role !== "super_admin" && (isSuperAdmin || selectedUser.role !== "admin") && (
                      <Button
                        size="sm"
                        variant="destructive"
                        className="bg-red-700 hover:bg-red-800"
                        disabled={actionLoading === `${selectedUser.user_id}-hard_delete`}
                        onClick={() => {
                          if (
                            confirm(
                              `PERMANENT DELETE: This will remove "${selectedUser.display_name}" (${selectedUser.email}) and ALL their data (posts, messages, media, subscriptions). This cannot be undone.\n\nAre you absolutely sure?`
                            )
                          ) {
                            userAction(selectedUser.user_id, "hard_delete", "Admin permanent delete");
                          }
                        }}
                      >
                        <Icon name="delete_sweep" className="icon-sm" /> Hard Delete
                      </Button>
                    )}
                    {/* Notify user */}
                    <Button
                      size="sm"
                      variant="secondary"
                      className="border-amber-500/30 text-amber-400 hover:bg-amber-500/10"
                      onClick={() => setShowNotifyForm((v) => v === "user" ? null : "user")}
                    >
                      {showNotifyForm === "user" ? <><Icon name="close" className="icon-sm" /> Cancel</> : <><Icon name="notifications" className="icon-sm" /> Notify</>}
                    </Button>
                  </div>
                </div>

                {/* Notify single user form */}
                {showNotifyForm === "user" && (
                  <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-4 space-y-3">
                    <h3 className="text-sm font-semibold text-foreground">
                      Send Notification to {selectedUser.display_name}
                    </h3>
                    <Input
                      placeholder="Title"
                      value={notifyTitle}
                      onChange={(e) => setNotifyTitle(e.target.value)}
                    />
                    <textarea
                      placeholder="Message body..."
                      value={notifyMessage}
                      onChange={(e) => setNotifyMessage(e.target.value)}
                      rows={3}
                      className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground resize-none"
                    />
                    <div className="flex items-center gap-4">
                      <label className="flex items-center gap-2 text-sm text-muted-foreground">
                        <input
                          type="checkbox"
                          checked={notifySendEmail}
                          onChange={(e) => setNotifySendEmail(e.target.checked)}
                          className="rounded"
                        />
                        Also send email
                      </label>
                      <Button
                        size="sm"
                        className="ml-auto"
                        disabled={notifyLoading || !notifyTitle || !notifyMessage}
                        onClick={() => handleSendNotification(selectedUser.user_id)}
                      >
                        {notifyLoading ? "Sending..." : "Send"}
                      </Button>
                    </div>
                  </div>
                )}

                {/* Stats grid */}
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  <div className="rounded-xl border border-border bg-muted/30 p-4">
                    <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Posts</p>
                    <p className="mt-1 text-2xl font-bold text-foreground">{selectedUser.post_count}</p>
                  </div>
                  <div className="rounded-xl border border-border bg-muted/30 p-4">
                    <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Subscribers</p>
                    <p className="mt-1 text-2xl font-bold text-foreground">{selectedUser.subscriber_count}</p>
                  </div>
                  <div className="rounded-xl border border-border bg-muted/30 p-4">
                    <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Total Earned</p>
                    <p className="mt-1 text-2xl font-bold text-emerald-400">
                      {formatCents(selectedUser.total_earned_cents, "USD")}
                    </p>
                  </div>
                  <div className="rounded-xl border border-border bg-muted/30 p-4">
                    <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Last Active</p>
                    <p className="mt-1 text-sm font-semibold text-foreground">
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
                <div className="rounded-xl border border-border bg-muted/20 p-4">
                <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">User Details</h3>
                <div className="grid grid-cols-2 gap-x-8 gap-y-3 text-sm">
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
                </div>

                {/* Device info grid */}
                {(selectedUser.device_type || selectedUser.browser_name || selectedUser.timezone) && (
                  <div className="rounded-xl border border-border bg-muted/20 p-4">
                    <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Device Info</h3>
                    <div className="grid grid-cols-2 gap-x-8 gap-y-3 text-sm">
                      <div>
                        <span className="text-muted-foreground">Device:</span>{" "}
                        <span className="text-foreground">{selectedUser.device_type || "\u2014"}</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">OS:</span>{" "}
                        <span className="text-foreground">{selectedUser.os_name || "\u2014"}</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Browser:</span>{" "}
                        <span className="text-foreground">{selectedUser.browser_name || "\u2014"}</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Screen:</span>{" "}
                        <span className="text-foreground">
                          {selectedUser.screen_width && selectedUser.screen_height
                            ? `${selectedUser.screen_width}×${selectedUser.screen_height}`
                            : "\u2014"}
                        </span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Timezone:</span>{" "}
                        <span className="text-foreground">{selectedUser.timezone || "\u2014"}</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Language:</span>{" "}
                        <span className="text-foreground">{selectedUser.language || "\u2014"}</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Connection:</span>{" "}
                        <span className="text-foreground">{selectedUser.connection_type || "\u2014"}</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Camera:</span>{" "}
                        <span className="text-foreground">
                          {selectedUser.camera_available === null ? "\u2014" : selectedUser.camera_available ? "Yes" : "No"}
                        </span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Microphone:</span>{" "}
                        <span className="text-foreground">
                          {selectedUser.microphone_available === null ? "\u2014" : selectedUser.microphone_available ? "Yes" : "No"}
                        </span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">GPS:</span>{" "}
                        <span className="text-foreground">
                          {selectedUser.latitude != null && selectedUser.longitude != null
                            ? `${selectedUser.latitude.toFixed(4)}, ${selectedUser.longitude.toFixed(4)}`
                            : "\u2014"}
                        </span>
                      </div>
                    </div>
                    {selectedUser.user_agent && (
                      <p className="mt-3 text-[11px] text-muted-foreground break-all">{selectedUser.user_agent}</p>
                    )}
                  </div>
                )}

                {/* Sub-tabs: Posts | Subscribers | Media | KYC */}
                {selectedUser.role === "creator" && (
                  <>
                    <div className="flex gap-2 border-b border-border overflow-x-auto">
                      {(
                        [
                          { key: "posts" as const, label: `Posts (${selectedUser.post_count})` },
                          { key: "subscribers" as const, label: `Subscribers (${selectedUser.subscriber_count})` },
                          { key: "media" as const, label: `Media (${userMediaTotal})` },
                          ...(isSuperAdmin ? [{ key: "kyc" as const, label: `KYC (${userKyc.length})` }] : []),
                        ]
                      ).map(({ key, label }) => (
                        <button
                          key={key}
                          type="button"
                          onClick={() => {
                            setUserDetailTab(key);
                            if (key === "subscribers" && userSubs.length === 0) {
                              fetchUserSubscribers(selectedUser.user_id);
                            }
                            if (key === "media" && userMedia.length === 0) {
                              fetchUserMedia(selectedUser.user_id);
                            }
                            if (key === "kyc" && userKyc.length === 0) {
                              fetchUserKyc(selectedUser.user_id);
                            }
                          }}
                          className={`border-b-2 px-4 py-2 text-sm font-medium transition-colors whitespace-nowrap ${
                            userDetailTab === key
                              ? "border-primary text-foreground"
                              : "border-transparent text-muted-foreground hover:text-foreground"
                          }`}
                        >
                          {label}
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

                    {/* Media sub-tab */}
                    {userDetailTab === "media" && (
                      <div className="space-y-3">
                        {userMedia.length === 0 ? (
                          <p className="py-4 text-center text-sm text-muted-foreground">No media files.</p>
                        ) : (
                          <div className="overflow-x-auto rounded-lg border border-border">
                            <table className="w-full text-sm">
                              <thead>
                                <tr className="border-b border-border bg-muted/50 text-left text-xs uppercase tracking-wider text-muted-foreground">
                                  <th className="px-4 py-3 font-semibold">File</th>
                                  <th className="px-4 py-3 font-semibold">Type</th>
                                  <th className="px-4 py-3 font-semibold">Size</th>
                                  <th className="px-4 py-3 font-semibold">Date</th>
                                  <th className="px-4 py-3 font-semibold">Actions</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-border">
                                {userMedia.map((m) => (
                                  <tr key={m.id} className="text-foreground transition-colors hover:bg-white/[0.03]">
                                    <td className="px-4 py-3 max-w-[250px] truncate text-xs font-mono text-muted-foreground" title={m.object_key}>
                                      {m.object_key.split("/").pop() || m.object_key}
                                    </td>
                                    <td className="px-4 py-3 whitespace-nowrap">
                                      <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                                        m.content_type.startsWith("video") ? "bg-purple-500/15 text-purple-400" : "bg-blue-500/15 text-blue-400"
                                      }`}>
                                        {m.content_type.startsWith("video") ? "Video" : m.content_type.startsWith("image") ? "Image" : m.content_type}
                                      </span>
                                    </td>
                                    <td className="px-4 py-3 whitespace-nowrap text-xs text-muted-foreground">
                                      {formatBytes(m.size_bytes)}
                                    </td>
                                    <td className="px-4 py-3 whitespace-nowrap text-xs text-muted-foreground">
                                      {new Date(m.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                                    </td>
                                    <td className="px-4 py-3 whitespace-nowrap">
                                      {deleteMediaConfirm === m.id ? (
                                        <div className="flex items-center gap-1">
                                          <Button
                                            size="sm"
                                            variant="destructive"
                                            disabled={actionLoading === m.id}
                                            onClick={() => deleteMedia(m.id)}
                                          >
                                            {actionLoading === m.id ? <Spinner className="h-4 w-4" /> : "Confirm"}
                                          </Button>
                                          <Button size="sm" variant="ghost" onClick={() => setDeleteMediaConfirm(null)}>
                                            Cancel
                                          </Button>
                                        </div>
                                      ) : (
                                        <Button size="sm" variant="destructive" onClick={() => setDeleteMediaConfirm(m.id)}>
                                          <Icon name="delete" className="icon-sm" /> Delete
                                        </Button>
                                      )}
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        )}
                        <Pagination
                          page={userMediaPage}
                          pageSize={PAGE_SIZE}
                          total={userMediaTotal}
                          onPageChange={(pg) => fetchUserMedia(selectedUser.user_id, pg)}
                        />
                      </div>
                    )}

                    {/* KYC sub-tab (super_admin only) */}
                    {userDetailTab === "kyc" && isSuperAdmin && (
                      <div className="space-y-3">
                        {userKyc.length === 0 ? (
                          <div className="flex flex-col items-center justify-center py-10 text-center">
                            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted/50 mb-3">
                              <Icon name="verified_user" className="text-2xl text-muted-foreground" />
                            </div>
                            <p className="text-sm text-muted-foreground">No KYC sessions found for this user.</p>
                          </div>
                        ) : (
                          <div className="space-y-4">
                            {userKyc.map((k) => (
                              <div
                                key={k.id}
                                className={`rounded-xl border p-4 space-y-3 ${
                                  k.status === "SUBMITTED" ? "border-amber-500/30 bg-amber-500/[0.03]"
                                  : k.status === "APPROVED" ? "border-emerald-500/20 bg-emerald-500/[0.02]"
                                  : k.status === "REJECTED" ? "border-red-500/20 bg-red-500/[0.02]"
                                  : "border-border"
                                }`}
                              >
                                {/* Status badge and date */}
                                <div className="flex items-center justify-between">
                                  <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold ${
                                    k.status === "APPROVED" ? "bg-emerald-500/15 text-emerald-400"
                                    : k.status === "REJECTED" ? "bg-red-500/15 text-red-400"
                                    : k.status === "SUBMITTED" ? "bg-amber-500/15 text-amber-400"
                                    : "bg-muted text-muted-foreground"
                                  }`}>
                                    <Icon name={
                                      k.status === "APPROVED" ? "check_circle"
                                      : k.status === "REJECTED" ? "cancel"
                                      : k.status === "SUBMITTED" ? "schedule"
                                      : "draft"
                                    } className="text-[12px]" />
                                    {k.status === "SUBMITTED" ? "Pending Review" : k.status.charAt(0) + k.status.slice(1).toLowerCase()}
                                  </span>
                                  <span className="text-[11px] text-muted-foreground">
                                    {k.created_at ? new Date(k.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "\u2014"}
                                  </span>
                                </div>

                                {/* Date of birth */}
                                {k.date_of_birth && (
                                  <div className="rounded-lg bg-muted/40 px-3 py-2 inline-block">
                                    <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Date of Birth</p>
                                    <p className="mt-0.5 text-sm font-semibold text-foreground">
                                      {new Date(k.date_of_birth + "T00:00:00").toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}
                                    </p>
                                  </div>
                                )}

                                {/* Document images */}
                                {(k.id_document_url || k.selfie_url) ? (
                                  <div className="grid grid-cols-2 gap-3">
                                    {k.id_document_url && (
                                      <div className="space-y-1.5">
                                        <div className="flex items-center gap-1">
                                          <Icon name="badge" className="text-xs text-muted-foreground" />
                                          <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">ID Document</p>
                                        </div>
                                        <a href={k.id_document_url} target="_blank" rel="noopener noreferrer" className="group relative block overflow-hidden rounded-lg border border-border bg-black/20">
                                          {/* eslint-disable-next-line @next/next/no-img-element */}
                                          <img
                                            src={k.id_document_url}
                                            alt="ID Document"
                                            className="w-full h-44 object-contain transition-transform duration-200 group-hover:scale-[1.02]"
                                            loading="lazy"
                                          />
                                          <div className="absolute inset-0 flex items-center justify-center bg-black/0 group-hover:bg-black/30 transition-colors">
                                            <span className="rounded-full bg-black/60 p-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                                              <Icon name="open_in_new" className="text-white text-sm" />
                                            </span>
                                          </div>
                                        </a>
                                      </div>
                                    )}
                                    {k.selfie_url && (
                                      <div className="space-y-1.5">
                                        <div className="flex items-center gap-1">
                                          <Icon name="face" className="text-xs text-muted-foreground" />
                                          <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Selfie</p>
                                        </div>
                                        <a href={k.selfie_url} target="_blank" rel="noopener noreferrer" className="group relative block overflow-hidden rounded-lg border border-border bg-black/20">
                                          {/* eslint-disable-next-line @next/next/no-img-element */}
                                          <img
                                            src={k.selfie_url}
                                            alt="Selfie"
                                            className="w-full h-44 object-contain transition-transform duration-200 group-hover:scale-[1.02]"
                                            loading="lazy"
                                          />
                                          <div className="absolute inset-0 flex items-center justify-center bg-black/0 group-hover:bg-black/30 transition-colors">
                                            <span className="rounded-full bg-black/60 p-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                                              <Icon name="open_in_new" className="text-white text-sm" />
                                            </span>
                                          </div>
                                        </a>
                                      </div>
                                    )}
                                  </div>
                                ) : (
                                  <div className="flex items-center gap-2 rounded-lg border border-dashed border-border py-4 justify-center">
                                    <Icon name="image_not_supported" className="text-sm text-muted-foreground" />
                                    <p className="text-xs text-muted-foreground">No documents uploaded</p>
                                  </div>
                                )}

                                {/* Admin notes */}
                                {k.admin_notes && (
                                  <div className="flex items-start gap-2 rounded-lg bg-muted/30 border border-border/50 px-3 py-2">
                                    <Icon name="note" className="text-xs text-muted-foreground mt-0.5 shrink-0" />
                                    <div>
                                      <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground mb-0.5">Admin Notes</p>
                                      <p className="text-xs text-foreground">{k.admin_notes}</p>
                                    </div>
                                  </div>
                                )}

                                {/* Review controls (SUBMITTED sessions only) */}
                                {k.status === "SUBMITTED" && (
                                  <div className="space-y-2.5 border-t border-border pt-3">
                                    <p className="text-xs font-semibold text-foreground">Review Decision</p>
                                    <textarea
                                      placeholder="Add notes about this review (optional)..."
                                      value={kycReviewNotes[k.id] || ""}
                                      onChange={(e) => setKycReviewNotes((prev) => ({ ...prev, [k.id]: e.target.value }))}
                                      className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/40 transition-all"
                                      rows={2}
                                    />
                                    <div className="flex gap-2">
                                      <Button
                                        size="sm"
                                        onClick={() => reviewKyc(k.id, "approve")}
                                        disabled={kycReviewing === k.id}
                                        className="bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm"
                                      >
                                        {kycReviewing === k.id ? (
                                          <Spinner className="mr-1.5 h-3.5 w-3.5" />
                                        ) : (
                                          <Icon name="check_circle" className="mr-1.5 icon-sm" />
                                        )}
                                        Approve
                                      </Button>
                                      <Button
                                        size="sm"
                                        variant="destructive"
                                        onClick={() => reviewKyc(k.id, "reject")}
                                        disabled={kycReviewing === k.id}
                                        className="shadow-sm"
                                      >
                                        {kycReviewing === k.id ? (
                                          <Spinner className="mr-1.5 h-3.5 w-3.5" />
                                        ) : (
                                          <Icon name="cancel" className="mr-1.5 icon-sm" />
                                        )}
                                        Reject
                                      </Button>
                                    </div>
                                  </div>
                                )}

                                {/* Reviewed info */}
                                {k.reviewed_at && (
                                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground pt-1">
                                    <Icon name="history" className="text-[12px]" />
                                    Reviewed {new Date(k.reviewed_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        )}
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
                      <Icon name="block" className="icon-sm" /> Remove
                    </Button>
                  ) : (
                    <Button
                      size="sm"
                      variant="secondary"
                      disabled={actionLoading === `${p.id}-restore`}
                      onClick={() => postAction(p.id, "restore")}
                    >
                      <Icon name="restore" className="icon-sm" /> Restore
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
                            {txTypeLabel(tx.type, t.admin)}
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
          {/* Category filter bar */}
          <div className="flex flex-wrap items-center gap-2">
            {(["all", "general", "billing", "account", "content_report", "partnerships", "privacy"] as const).map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => { setSupportCategory(cat === "all" ? null : cat); setSelectedMessage(null); }}
                className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                  (cat === "all" && !supportCategory) || supportCategory === cat
                    ? "bg-foreground text-background"
                    : "bg-muted text-muted-foreground hover:text-foreground"
                }`}
              >
                {cat === "all" ? `All (${supportTotal})` : (CATEGORY_LABELS[cat] || cat)}
              </button>
            ))}
            <div className="ml-auto flex gap-2">
              <button
                type="button"
                onClick={() => setSupportResolved(supportResolved === false ? null : false)}
                className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                  supportResolved === false
                    ? "bg-amber-500/20 text-amber-400"
                    : "bg-muted text-muted-foreground hover:text-foreground"
                }`}
              >
                Open
              </button>
              <button
                type="button"
                onClick={() => setSupportResolved(supportResolved === true ? null : true)}
                className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                  supportResolved === true
                    ? "bg-emerald-500/20 text-emerald-400"
                    : "bg-muted text-muted-foreground hover:text-foreground"
                }`}
              >
                Resolved
              </button>
            </div>
          </div>

          {selectedMessage ? (
            /* Message detail view */
            <Card className="overflow-hidden">
              <div className="border-b border-border px-4 py-3">
                <button
                  type="button"
                  onClick={() => setSelectedMessage(null)}
                  className="mb-2 inline-flex items-center gap-1 text-xs text-primary hover:underline"
                >
                  <Icon name="arrow_back" className="icon-xs" /> Back to messages
                </button>
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <h2 className="text-lg font-semibold text-foreground">
                      {selectedMessage.subject}
                    </h2>
                    <p className="mt-1 text-sm text-muted-foreground">
                      From: <span className="text-foreground">{selectedMessage.email}</span>
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(selectedMessage.created_at).toLocaleString()}
                      {selectedMessage.ip_address && <> · IP: {selectedMessage.ip_address}</>}
                    </p>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1">
                    <span className={`rounded px-2 py-0.5 text-[10px] font-semibold uppercase ${CATEGORY_COLORS[selectedMessage.category] || CATEGORY_COLORS.unknown}`}>
                      {CATEGORY_LABELS[selectedMessage.category] || selectedMessage.category}
                    </span>
                    {selectedMessage.resolved ? (
                      <span className="text-[10px] text-emerald-400">Resolved</span>
                    ) : (
                      <Button
                        size="sm"
                        variant="secondary"
                        disabled={actionLoading === selectedMessage.id}
                        onClick={() => resolveSupportMessage(selectedMessage.id)}
                      >
                        <Icon name="check_circle" className="icon-sm" /> Resolve
                      </Button>
                    )}
                  </div>
                </div>
              </div>
              <CardContent className="p-4">
                <pre className="whitespace-pre-wrap text-sm text-foreground">
                  {selectedMessage.message}
                </pre>
              </CardContent>
            </Card>
          ) : (
            /* Message list view */
            <div className="space-y-2">
              {supportMessages.length === 0 && (
                <p className="py-8 text-center text-sm text-muted-foreground">
                  No support messages yet.
                </p>
              )}
              {supportMessages.map((m: SupportMessage) => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => openSupportMessage(m)}
                  className={`w-full rounded-lg border px-4 py-3 text-left transition-colors hover:bg-white/5 ${
                    m.is_read
                      ? "border-border bg-card"
                      : "border-primary/20 bg-primary/5"
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        {!m.is_read && (
                          <span className="h-2 w-2 shrink-0 rounded-full bg-primary" />
                        )}
                        <span className={`text-sm truncate ${m.is_read ? "text-foreground" : "font-semibold text-foreground"}`}>
                          {m.email}
                        </span>
                        <span className={`shrink-0 rounded px-1.5 py-0.5 text-[9px] font-semibold uppercase leading-none ${CATEGORY_COLORS[m.category] || CATEGORY_COLORS.unknown}`}>
                          {CATEGORY_LABELS[m.category] || m.category}
                        </span>
                        {m.resolved && (
                          <span className="shrink-0 rounded px-1.5 py-0.5 text-[9px] font-semibold uppercase leading-none bg-emerald-500/15 text-emerald-400">
                            Resolved
                          </span>
                        )}
                      </div>
                      <p className={`mt-0.5 text-sm truncate ${m.is_read ? "text-foreground/80" : "font-medium text-foreground"}`}>
                        {m.subject}
                      </p>
                      <p className="mt-0.5 text-xs text-muted-foreground truncate">
                        {m.message.slice(0, 120)}
                      </p>
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-1">
                      <span className="text-xs text-muted-foreground whitespace-nowrap">
                        {new Date(m.created_at).toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                    </div>
                  </div>
                </button>
              ))}
              <Pagination page={supportPage} pageSize={PAGE_SIZE} total={supportTotal} onPageChange={(pg) => fetchInbox(pg)} />
            </div>
          )}
        </div>
      )}

      {/* ============================================================ */}
      {/* MODERATION TAB                                                */}
      {/* ============================================================ */}
      {tab === "moderation" && (
        <Card>
          <CardHeader>
            <CardTitle>Content Moderation — Pending Reviews</CardTitle>
            <p className="text-sm text-muted-foreground">
              Items flagged by AI safety. Age and NSFW scores are AI estimates only — they do not reflect verified age or confirmed content classification. All decisions require human review.
            </p>
          </CardHeader>
          <CardContent>
            {modLoading ? (
              <div className="space-y-3">
                {[...Array(3)].map((_, i) => (
                  <Skeleton key={i} className="h-20 w-full" />
                ))}
              </div>
            ) : modItems.length === 0 ? (
              <p className="py-8 text-center text-muted-foreground">No items pending review</p>
            ) : (
              <div className="space-y-3">
                {modItems.map((item) => (
                  <div
                    key={item.scan_id}
                    className="flex items-center justify-between rounded-lg border border-border p-4"
                  >
                    <div className="flex-1 space-y-1">
                      <div className="flex items-center gap-3">
                        <span
                          className={`rounded px-2 py-0.5 text-xs font-semibold ${
                            item.risk_level === "HIGH"
                              ? "bg-destructive/20 text-destructive"
                              : "bg-amber-500/20 text-amber-600"
                          }`}
                        >
                          {item.risk_level}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {item.decision}
                        </span>
                      </div>
                      <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
                        <span>
                          NSFW: <strong className="text-foreground">{(item.nsfw_score * 100).toFixed(1)}%</strong>{" "}
                          ({item.nsfw_label})
                        </span>
                        <span>
                          Est. age range: <strong className="text-foreground">{item.age_range_prediction}</strong>{" "}
                          <span className="text-muted-foreground/60">(AI estimate)</span>
                        </span>
                        <span>
                          Underage proxy: <strong className="text-foreground">{(item.underage_likelihood_proxy * 100).toFixed(1)}%</strong>{" "}
                          <span className="text-muted-foreground/60">(AI estimate)</span>
                        </span>
                        <span>Asset: {item.media_asset_id.slice(0, 8)}...</span>
                        <span>{new Date(item.created_at).toLocaleString()}</span>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={actionLoading === item.scan_id}
                        onClick={() => handleModReview(item.scan_id, "APPROVED")}
                      >
                        <Icon name="check_circle" className="icon-sm" /> Approve
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        disabled={actionLoading === item.scan_id}
                        onClick={() => handleModReview(item.scan_id, "REJECTED")}
                      >
                        <Icon name="cancel" className="icon-sm" /> Reject
                      </Button>
                    </div>
                  </div>
                ))}
                <Pagination
                  page={modPage}
                  pageSize={20}
                  total={modTotal}
                  onPageChange={(pg) => fetchModeration(pg)}
                />
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* ============================================================ */}
      {/* KYC TAB (super_admin only)                                    */}
      {/* ============================================================ */}
      {tab === "kyc" && isSuperAdmin && (
        <Card>
          <CardHeader className="pb-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500/10">
                <Icon name="verified_user" className="text-amber-400 text-xl" />
              </div>
              <div>
                <CardTitle>KYC Verification Review</CardTitle>
                <p className="mt-0.5 text-sm text-muted-foreground">
                  Review creator identity documents and approve or reject submissions.
                </p>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-5">
            {/* Status filter pills */}
            <div className="flex flex-wrap gap-2">
              {([
                { value: "SUBMITTED", label: "Pending Review", icon: "schedule" },
                { value: "APPROVED", label: "Approved", icon: "check_circle" },
                { value: "REJECTED", label: "Rejected", icon: "cancel" },
                { value: "CREATED", label: "Created", icon: "draft" },
                { value: "", label: "All", icon: "list" },
              ] as const).map((f) => (
                <button
                  key={f.value}
                  type="button"
                  onClick={() => {
                    setGlobalKycFilter(f.value);
                    fetchGlobalKyc(1, f.value);
                  }}
                  className={`inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-medium transition-all ${
                    globalKycFilter === f.value
                      ? f.value === "SUBMITTED" ? "bg-amber-500/20 text-amber-300 ring-1 ring-amber-500/30"
                        : f.value === "APPROVED" ? "bg-emerald-500/20 text-emerald-300 ring-1 ring-emerald-500/30"
                        : f.value === "REJECTED" ? "bg-red-500/20 text-red-300 ring-1 ring-red-500/30"
                        : "bg-primary/20 text-primary ring-1 ring-primary/30"
                      : "bg-muted text-muted-foreground hover:text-foreground hover:bg-muted/80"
                  }`}
                >
                  <Icon name={f.icon} className="text-[14px]" />
                  {f.label}
                </button>
              ))}
            </div>

            {globalKycLoading ? (
              <div className="space-y-4">
                {[...Array(3)].map((_, i) => (
                  <Skeleton key={i} className="h-48 w-full rounded-xl" />
                ))}
              </div>
            ) : globalKyc.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted/50 mb-4">
                  <Icon name="verified_user" className="text-3xl text-muted-foreground" />
                </div>
                <p className="text-sm font-medium text-muted-foreground">No KYC sessions found</p>
                <p className="mt-1 text-xs text-muted-foreground/70">
                  {globalKycFilter === "SUBMITTED" ? "No pending submissions to review" : "Try a different filter"}
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {globalKyc.map((k) => (
                  <div
                    key={k.id}
                    className={`rounded-xl border p-5 space-y-4 transition-colors ${
                      k.status === "SUBMITTED"
                        ? "border-amber-500/30 bg-amber-500/[0.03]"
                        : k.status === "APPROVED"
                        ? "border-emerald-500/20 bg-emerald-500/[0.02]"
                        : k.status === "REJECTED"
                        ? "border-red-500/20 bg-red-500/[0.02]"
                        : "border-border"
                    }`}
                  >
                    {/* Creator info header */}
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex items-center gap-3">
                        {k.creator?.avatar_url ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={k.creator.avatar_url}
                            alt=""
                            className="h-12 w-12 rounded-full object-cover ring-2 ring-border"
                          />
                        ) : (
                          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted ring-2 ring-border">
                            <Icon name="person" className="text-xl text-muted-foreground" />
                          </div>
                        )}
                        <div>
                          <p className="text-sm font-semibold text-foreground leading-tight">
                            {k.creator?.display_name || "Unknown Creator"}
                          </p>
                          {k.creator?.handle && (
                            <p className="text-xs text-primary/80 font-medium">@{k.creator.handle}</p>
                          )}
                          <p className="text-xs text-muted-foreground mt-0.5">{k.creator?.email}</p>
                        </div>
                      </div>
                      <div className="flex flex-col items-end gap-1.5">
                        <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold ${
                          k.status === "APPROVED" ? "bg-emerald-500/15 text-emerald-400"
                          : k.status === "REJECTED" ? "bg-red-500/15 text-red-400"
                          : k.status === "SUBMITTED" ? "bg-amber-500/15 text-amber-400"
                          : "bg-muted text-muted-foreground"
                        }`}>
                          <Icon name={
                            k.status === "APPROVED" ? "check_circle"
                            : k.status === "REJECTED" ? "cancel"
                            : k.status === "SUBMITTED" ? "schedule"
                            : "draft"
                          } className="text-[12px]" />
                          {k.status === "SUBMITTED" ? "Pending Review" : k.status.charAt(0) + k.status.slice(1).toLowerCase()}
                        </span>
                        <span className="text-[11px] text-muted-foreground">
                          {k.created_at ? new Date(k.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "\u2014"}
                        </span>
                      </div>
                    </div>

                    {/* Info grid: DOB + Session ID */}
                    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                      {k.date_of_birth && (
                        <div className="rounded-lg bg-muted/40 px-3 py-2">
                          <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Date of Birth</p>
                          <p className="mt-0.5 text-sm font-semibold text-foreground">
                            {new Date(k.date_of_birth + "T00:00:00").toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}
                          </p>
                        </div>
                      )}
                      <div className="rounded-lg bg-muted/40 px-3 py-2">
                        <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Session ID</p>
                        <p className="mt-0.5 text-xs font-mono text-foreground/70 truncate">{k.id.slice(0, 12)}...</p>
                      </div>
                    </div>

                    {/* Document images — side by side, clickable */}
                    {(k.id_document_url || k.selfie_url) ? (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {k.id_document_url && (
                          <div className="space-y-2">
                            <div className="flex items-center gap-1.5">
                              <Icon name="badge" className="text-sm text-muted-foreground" />
                              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">ID Document</p>
                            </div>
                            <a
                              href={k.id_document_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="group relative block overflow-hidden rounded-xl border border-border bg-black/20"
                            >
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img
                                src={k.id_document_url}
                                alt="ID Document"
                                className="w-full h-56 object-contain transition-transform duration-200 group-hover:scale-[1.02]"
                                loading="lazy"
                              />
                              <div className="absolute inset-0 flex items-center justify-center bg-black/0 group-hover:bg-black/30 transition-colors">
                                <span className="rounded-full bg-black/60 p-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                  <Icon name="open_in_new" className="text-white text-lg" />
                                </span>
                              </div>
                            </a>
                          </div>
                        )}
                        {k.selfie_url && (
                          <div className="space-y-2">
                            <div className="flex items-center gap-1.5">
                              <Icon name="face" className="text-sm text-muted-foreground" />
                              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Selfie Photo</p>
                            </div>
                            <a
                              href={k.selfie_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="group relative block overflow-hidden rounded-xl border border-border bg-black/20"
                            >
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img
                                src={k.selfie_url}
                                alt="Selfie"
                                className="w-full h-56 object-contain transition-transform duration-200 group-hover:scale-[1.02]"
                                loading="lazy"
                              />
                              <div className="absolute inset-0 flex items-center justify-center bg-black/0 group-hover:bg-black/30 transition-colors">
                                <span className="rounded-full bg-black/60 p-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                  <Icon name="open_in_new" className="text-white text-lg" />
                                </span>
                              </div>
                            </a>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="flex items-center gap-2 rounded-lg border border-dashed border-border py-6 justify-center">
                        <Icon name="image_not_supported" className="text-muted-foreground" />
                        <p className="text-xs text-muted-foreground">No documents uploaded yet</p>
                      </div>
                    )}

                    {/* Previous admin notes */}
                    {k.admin_notes && (
                      <div className="flex items-start gap-2 rounded-lg bg-muted/30 border border-border/50 px-3 py-2.5">
                        <Icon name="note" className="text-sm text-muted-foreground mt-0.5 shrink-0" />
                        <div>
                          <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground mb-0.5">Admin Notes</p>
                          <p className="text-sm text-foreground">{k.admin_notes}</p>
                        </div>
                      </div>
                    )}

                    {/* Review controls — only for SUBMITTED sessions */}
                    {k.status === "SUBMITTED" && (
                      <div className="space-y-3 border-t border-border pt-4">
                        <p className="text-xs font-semibold text-foreground">Review Decision</p>
                        <textarea
                          placeholder="Add notes about this review (optional)..."
                          value={kycReviewNotes[k.id] || ""}
                          onChange={(e) => setKycReviewNotes((prev) => ({ ...prev, [k.id]: e.target.value }))}
                          className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/40 transition-all"
                          rows={2}
                        />
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            onClick={() => reviewKyc(k.id, "approve")}
                            disabled={kycReviewing === k.id}
                            className="bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm"
                          >
                            {kycReviewing === k.id ? (
                              <Spinner className="mr-1.5 h-3.5 w-3.5" />
                            ) : (
                              <Icon name="check_circle" className="mr-1.5 icon-sm" />
                            )}
                            Approve Identity
                          </Button>
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() => reviewKyc(k.id, "reject")}
                            disabled={kycReviewing === k.id}
                            className="shadow-sm"
                          >
                            {kycReviewing === k.id ? (
                              <Spinner className="mr-1.5 h-3.5 w-3.5" />
                            ) : (
                              <Icon name="cancel" className="mr-1.5 icon-sm" />
                            )}
                            Reject
                          </Button>
                        </div>
                      </div>
                    )}

                    {/* Reviewed timestamp */}
                    {k.reviewed_at && (
                      <div className="flex items-center gap-1.5 text-xs text-muted-foreground pt-1">
                        <Icon name="history" className="text-[13px]" />
                        Reviewed on {new Date(k.reviewed_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })} at{" "}
                        {new Date(k.reviewed_at).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}
                      </div>
                    )}
                  </div>
                ))}
                <Pagination
                  page={globalKycPage}
                  pageSize={PAGE_SIZE}
                  total={globalKycTotal}
                  onPageChange={(pg) => fetchGlobalKyc(pg, globalKycFilter)}
                />
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </Page>
  );
}
