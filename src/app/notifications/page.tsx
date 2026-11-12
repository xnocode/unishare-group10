"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import AppNavbar from "../components/AppNavbar";
import {
  clearClientSession,
  useCurrentUser,
  useRequireAuth,
} from "../lib/user-client";
import "./notifications.css";

interface NotificationItem {
  id: string;
  unread: boolean;
  icon: "box" | "car" | "wallet" | "boxcheck" | "coins";
  title: string;
  body: string;
  meta: string;
  actionText: string;
  actionHref: string;
}

interface RawDbNotification {
  id: string;
  category: string;
  title: string;
  body: string;
  unread: boolean;
  actionLabel?: string | null;
  actionHref?: string | null;
  createdAt: string;
}

function formatNotifTime(iso: string): string {
  try {
    const diffMs = Date.now() - new Date(iso).getTime();
    const mins = Math.round(diffMs / 60000);
    if (mins < 1) return "Just now";
    if (mins < 60) return `${mins} minute${mins === 1 ? "" : "s"} ago`;
    const hours = Math.round(mins / 60);
    if (hours < 24) return `${hours} hour${hours === 1 ? "" : "s"} ago`;
    return new Date(iso).toLocaleDateString("en-GB", {
      day: "numeric",
      month: "short",
    });
  } catch {
    return "Recent";
  }
}

function mapCategoryToIcon(category: string): NotificationItem["icon"] {
  if (category === "wallet" || category === "topup") return "wallet";
  if (category === "ride" || category === "rides") return "car";
  if (category === "rental") return "boxcheck";
  if (category === "marketplace") return "box";
  return "coins";
}

function NotificationIcon({ type }: { type: NotificationItem["icon"] }) {
  switch (type) {
    case "box":
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 8l-9-5-9 5v8l9 5 9-5V8z" />
          <path d="M3.3 7.5L12 12l8.7-4.5M12 12v9" />
          <path d="M7.5 5.2l9 5" />
        </svg>
      );
    case "car":
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M5 11l1.6-4.2A2 2 0 018.5 5.5h7a2 2 0 011.9 1.3L19 11" />
          <rect x="3" y="11" width="18" height="6" rx="2" />
          <path d="M6 17v2M18 17v2M7 14h.01M17 14h.01" />
        </svg>
      );
    case "wallet":
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M19 7V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2h14a2 2 0 002-2v-2" />
          <path d="M21 9h-5a2 2 0 000 4h5V9z" />
          <path d="M3 7h14" />
        </svg>
      );
    case "boxcheck":
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 10V8l-9-5-9 5v8l9 5 2-1.1" />
          <path d="M3.3 7.5L12 12l8.7-4.5M12 12v9" />
          <path d="M16 18l2 2 4-4" />
        </svg>
      );
    case "coins":
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="15" cy="9" r="6" />
          <path d="M15 6.5v5M13.5 8h3" />
          <path d="M9.5 10.5A6 6 0 106 20a6 6 0 005.5-3.5" />
        </svg>
      );
    default:
      return null;
  }
}

export default function NotificationsPage() {
  const router = useRouter();
  const { resolvedUser } = useCurrentUser();
  const [activeTab, setActiveTab] = useState<"all" | "unread">("all");
  const isAuthenticated = useRequireAuth("/notifications");

  const [dbNotifications, setDbNotifications] = useState<NotificationItem[]>([]);
  const [dbLoaded, setDbLoaded] = useState(false);
  const [unreadTotal, setUnreadTotal] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);

  const loadNotifications = useCallback(
    async (offset = 0, append = false) => {
      if (!resolvedUser.email) return;
      try {
        const res = await fetch(
          `/api/notifications?limit=20&offset=${offset}`,
          { headers: { "x-user-email": resolvedUser.email } }
        );
        const data = (await res.json().catch(() => null)) as {
          ok?: boolean;
          notifications?: RawDbNotification[];
          unreadCount?: number;
          hasMore?: boolean;
        } | null;
        if (res.ok && data?.ok && Array.isArray(data.notifications)) {
          const mapped: NotificationItem[] = data.notifications.map((n) => ({
            id: n.id,
            unread: Boolean(n.unread),
            icon: mapCategoryToIcon(n.category),
            title: n.title,
            body: n.body,
            meta: `${n.category ? n.category.charAt(0).toUpperCase() + n.category.slice(1) : "Campus"} · ${formatNotifTime(n.createdAt)}`,
            actionText: (n.actionLabel || "View details").replace(/\s*→\s*$/, ""),
            actionHref: n.actionHref && n.actionHref !== "#" ? n.actionHref : "/home",
          }));
          setDbNotifications((prev) => (append ? [...prev, ...mapped] : mapped));
          setUnreadTotal(typeof data.unreadCount === "number" ? data.unreadCount : 0);
          setHasMore(Boolean(data.hasMore));
        }
      } finally {
        setDbLoaded(true);
        setLoadingMore(false);
      }
    },
    [resolvedUser.email]
  );

  useEffect(() => {
    if (!isAuthenticated || !resolvedUser.email) return;
    void loadNotifications(0, false);

    const handleLiveRefresh = () => {
      if (typeof document !== "undefined" && document.visibilityState !== "visible") return;
      void loadNotifications(0, false);
    };

    const interval = setInterval(handleLiveRefresh, 12000);
    window.addEventListener("focus", handleLiveRefresh);
    return () => {
      clearInterval(interval);
      window.removeEventListener("focus", handleLiveRefresh);
    };
  }, [isAuthenticated, resolvedUser.email, loadNotifications]);

  const fallbackItems: NotificationItem[] = useMemo(
    () => [
      {
        id: "onboarding-wallet",
        unread: false,
        icon: "wallet",
        title: `Welcome to ${resolvedUser.university} on UniShare`,
        body: `Your account (${resolvedUser.email}) is active with ${resolvedUser.tokenBalance} tokens ready for campus rentals or rides.`,
        meta: "Account · Active",
        actionText: "Open wallet",
        actionHref: "/wallet",
      },
      {
        id: "onboarding-verify",
        unread: !resolvedUser.verified,
        icon: "boxcheck",
        title: resolvedUser.studentId
          ? `Student ID ${resolvedUser.studentId} recorded`
          : "Complete your student ID verification",
        body: resolvedUser.department
          ? `Department: ${resolvedUser.department} · ${resolvedUser.university}.`
          : `Submit your university ID card and face photo for ${resolvedUser.university}.`,
        meta: "Verification · Campus trust",
        actionText: resolvedUser.verified || resolvedUser.studentId ? "View status" : "Verify now",
        actionHref: resolvedUser.verified
          ? "/verification-approved"
          : resolvedUser.studentId
          ? "/verification-pending"
          : "/student-verification",
      },
    ],
    [
      resolvedUser.department,
      resolvedUser.email,
      resolvedUser.studentId,
      resolvedUser.tokenBalance,
      resolvedUser.university,
      resolvedUser.verified,
    ]
  );

  const items = dbNotifications.length > 0 ? dbNotifications : dbLoaded ? fallbackItems : [];
  const unreadCount = dbNotifications.length > 0 ? unreadTotal : items.filter((i) => i.unread).length;

  const handleMarkAllAsRead = async () => {
    setDbNotifications((prev) => prev.map((item) => ({ ...item, unread: false })));
    setUnreadTotal(0);
    if (resolvedUser.email) {
      await fetch("/api/notifications", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "x-user-email": resolvedUser.email,
        },
        body: JSON.stringify({ action: "mark_all_read" }),
      }).catch(() => {});
    }
  };

  const handleMarkSingleRead = (id: string) => {
    if (id.startsWith("onboarding-")) return;
    setDbNotifications((prev) =>
      prev.map((item) => (item.id === id ? { ...item, unread: false } : item))
    );
    setUnreadTotal((prev) => Math.max(0, prev - 1));
    if (resolvedUser.email) {
      void fetch("/api/notifications", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "x-user-email": resolvedUser.email,
        },
        body: JSON.stringify({ id }),
      }).catch(() => {});
    }
  };

  const handleLoadEarlier = () => {
    if (!hasMore || loadingMore) return;
    setLoadingMore(true);
    void loadNotifications(dbNotifications.length, true);
  };

  const displayedItems = activeTab === "unread" ? items.filter((item) => item.unread) : items;

  const handleLogout = (e?: React.MouseEvent) => {
    if (e) e.preventDefault();
    clearClientSession();
    router.push("/login");
  };

  if (!isAuthenticated) {
    return (
      <div
        style={{
          minHeight: "100vh",
          display: "grid",
          placeItems: "center",
          background: "#fff",
          fontFamily: "system-ui, sans-serif",
          color: "#0b5a52",
          fontWeight: 600,
        }}
      >
        Checking campus authorization...
      </div>
    );
  }

  return (
    <div className="notifications-page">
      <AppNavbar
        activeNav="notifications"
        unreadCount={unreadCount}
        onLogout={handleLogout}
      />

      {/* Main Content */}
      <main>
        <nav className="crumbs" aria-label="Breadcrumb">
          <Link href="/home">Home</Link>
          <span>›</span>
          <span className="current">Notifications</span>
        </nav>

        <div className="eyebrow">{resolvedUser.university} · Verified students only</div>

        <div className="title-row">
          <div>
            <h1>Notifications</h1>
            <p className="subtitle">The latest on your rentals, rides and tokens. All in one place.</p>
          </div>
          <button className="mark-all" id="markAll" type="button" onClick={handleMarkAllAsRead}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M2 12.5l4.5 4.5L15 8.5" />
              <path d="M12 15.5l1.5 1.5L22 8.5" />
            </svg>
            Mark all as read
          </button>
        </div>

        {/* Tabs */}
        <div className="tabs">
          <button
            className={`tab ${activeTab === "all" ? "active" : ""}`}
            data-tab="all"
            id="tab-all"
            type="button"
            onClick={() => setActiveTab("all")}
          >
            All updates ({items.length})
          </button>
          <button
            className={`tab ${activeTab === "unread" ? "active" : ""}`}
            data-tab="unread"
            id="tab-unread"
            type="button"
            onClick={() => setActiveTab("unread")}
          >
            Unread ({unreadCount})
          </button>
        </div>

        {/* Section Head */}
        <div className="section-head">
          <h2>Your updates</h2>
          {unreadCount > 0 && <span className="count-pill" id="pill">{unreadCount} unread</span>}
        </div>

        {/* Notifications List */}
        <div className="list" id="list">
          {displayedItems.length > 0 ? (
            displayedItems.map((item) => (
              <div key={item.id} className={`item ${item.unread ? "unread" : ""}`}>
                <div className="icon">
                  <NotificationIcon type={item.icon} />
                </div>
                <div className="body">
                  <h3>{item.title}</h3>
                  {item.unread && <span className="badge">Unread</span>}
                  <p>{item.body}</p>
                  <div className="meta">{item.meta}</div>
                  <Link
                    className="action"
                    href={item.actionHref}
                    onClick={() => handleMarkSingleRead(item.id)}
                  >
                    {item.actionText}
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M5 12h14M13 6l6 6-6 6" />
                    </svg>
                  </Link>
                </div>
              </div>
            ))
          ) : !dbLoaded ? (
            <div className="empty-state">Loading campus notifications...</div>
          ) : (
            <div className="empty-state">No unread notifications right now.</div>
          )}
        </div>

        {hasMore && (
          <button
            className="load-more"
            type="button"
            disabled={loadingMore}
            onClick={handleLoadEarlier}
          >
            {loadingMore ? "Loading earlier updates..." : "Load earlier notifications"}
          </button>
        )}
      </main>

      {/* Footer */}
      <footer>
        <div className="footer-inner">
          <span>UniShare. Made for university students in Bangladesh.</span>
          <nav>
            <Link href="/privacy">Privacy</Link>
            <Link href="/terms">Terms</Link>
            <Link href="/help">Get help</Link>
            <a href="#" onClick={handleLogout}>
              Log out
            </a>
          </nav>
        </div>
      </footer>
    </div>
  );
}

