"use client";

import { useState } from "react";
import Link from "next/link";
import "./notifications.css";

interface NotificationItem {
  id: number;
  unread: boolean;
  icon: "box" | "car" | "wallet" | "boxcheck" | "coins";
  title: string;
  body: string;
  meta: string;
  actionText: string;
  actionHref: string;
}

const INITIAL_NOTIFICATIONS: NotificationItem[] = [
  {
    id: 1,
    unread: true,
    icon: "box",
    title: "A new request for your camera",
    body: "Nabila Sultana wants to rent your Canon EOS 200D from 19–21 October. Review the request before confirming.",
    meta: "Rental · 10 minutes ago",
    actionText: "Review request",
    actionHref: "#",
  },
  {
    id: 2,
    unread: true,
    icon: "car",
    title: "Your ride leaves soon",
    body: "Arif Hossain is heading from Dhanmondi 27 to TSC, DU at 8:30 AM. Your seat is confirmed.",
    meta: "Ride · 25 minutes ago",
    actionText: "View ride",
    actionHref: "#",
  },
  {
    id: 3,
    unread: true,
    icon: "wallet",
    title: "50 deposit tokens released",
    body: "Your phone charger return was confirmed. The refundable deposit is back in your available balance.",
    meta: "Wallet · 1 hour ago",
    actionText: "View transaction",
    actionHref: "#",
  },
  {
    id: 4,
    unread: false,
    icon: "boxcheck",
    title: "Pickup confirmed",
    body: "You picked up the scientific calculator from Nafis Ahmed at Science Library. Return by 15 October, 5:00 PM.",
    meta: "Rental · Yesterday · 4:20 PM",
    actionText: "View rental",
    actionHref: "#",
  },
  {
    id: 5,
    unread: false,
    icon: "car",
    title: "Ride booking successful",
    body: "1 seat reserved with Arif Hossain. 80 tokens were paid from your wallet for Dhanmondi 27 → TSC, DU.",
    meta: "Ride · Yesterday · 2:15 PM",
    actionText: "View booking",
    actionHref: "#",
  },
  {
    id: 6,
    unread: false,
    icon: "coins",
    title: "Rental earnings received",
    body: "120 tokens from your camera rental have been added to your wallet. Thank you for sharing on campus.",
    meta: "Wallet · 12 October · 6:40 PM",
    actionText: "View earnings",
    actionHref: "#",
  },
];

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
  const [items, setItems] = useState<NotificationItem[]>(INITIAL_NOTIFICATIONS);
  const [activeTab, setActiveTab] = useState<"all" | "unread">("all");

  const unreadCount = items.filter((item) => item.unread).length;

  const handleMarkAllAsRead = () => {
    setItems((prev) => prev.map((item) => ({ ...item, unread: false })));
  };

  const displayedItems = activeTab === "unread" ? items.filter((item) => item.unread) : items;

  return (
    <div className="notifications-page">
      {/* Header */}
      <header className="header-nav">
        <div className="header-inner">
          <Link className="logo" href="/home">
            <svg viewBox="0 0 24 24" fill="none" stroke="#0b5a52" strokeWidth="3" strokeLinecap="round">
              <circle cx="7" cy="12" r="4.5" />
              <circle cx="17" cy="12" r="4.5" />
            </svg>
            UniShare
          </Link>

          <nav className="main-nav" aria-label="Main">
            <Link href="/home">Home</Link>
            <Link href="#">Marketplace</Link>
            <Link href="#">My products</Link>
            <Link href="#">My rentals</Link>
            <Link href="#">Rides</Link>
            <Link href="#">Wallet</Link>
            <Link href="#">Favorites</Link>
          </nav>

          <div className="header-right">
            <Link className="bell-link" href="/notifications" id="bell">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M6 8a6 6 0 1112 0c0 7 3 9 3 9H3s3-2 3-9" />
                <path d="M10.3 21a1.9 1.9 0 003.4 0" />
              </svg>
              {unreadCount > 0 && <span id="bell-count">{unreadCount}</span>}
            </Link>

            <Link className="sos-link" href="#">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                <path d="M9 12l2 2 4-4" />
              </svg>
              <span>SOS</span>
            </Link>

            <div className="avatar">FR</div>
            <div className="user">
              <div className="name">Farhana Rahman</div>
              <div className="sub">My profile</div>
            </div>

            <svg className="chev" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M6 9l6 6 6-6" />
            </svg>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main>
        <div className="crumbs">
          <Link href="/home">Home</Link>
          <span>›</span>
          <span>Notifications</span>
        </div>

        <div className="eyebrow">University of Dhaka · Verified students only</div>

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
                  <Link className="action" href={item.actionHref}>
                    {item.actionText}
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M5 12h14M13 6l6 6-6 6" />
                    </svg>
                  </Link>
                </div>
              </div>
            ))
          ) : (
            <div className="empty-state">No unread notifications right now.</div>
          )}
        </div>

        <button className="load-more" type="button">
          Load earlier notifications
        </button>
      </main>

      {/* Footer */}
      <footer>
        <div className="footer-inner">
          <span>UniShare. Made for university students in Bangladesh.</span>
          <nav>
            <Link href="#">Privacy</Link>
            <Link href="#">Terms</Link>
            <Link href="#">Get help</Link>
            <Link href="/login">Log out</Link>
          </nav>
        </div>
      </footer>
    </div>
  );
}

