"use client";

import React, { useState, useMemo } from "react";
import Link from "next/link";
import AppNavbar from "./components/AppNavbar";
import {
  clearClientSession,
  formatMemberSince,
  getUserScopedKey,
  useCurrentUser,
  useLocalStorageRaw,
} from "./lib/user-client";
import "./campus-home.css";

// SVG Helper matching the design
function SvgIcon({
  name,
  size = 16,
  className = "",
  style = {},
}: {
  name: string;
  size?: number;
  className?: string;
  style?: React.CSSProperties;
}) {
  const paths: Record<string, React.ReactNode> = {
    bell: (
      <>
        <path d="M6 16V11a6 6 0 0 1 12 0v5l1.5 2h-15zM10 21h4" />
      </>
    ),
    shield: (
      <>
        <path d="M12 3l8 3v6c0 4.5-3.4 8-8 9-4.6-1-8-4.5-8-9V6l8-3z" />
        <path d="M9 12l2 2 4-4" />
      </>
    ),
    plus: (
      <>
        <path d="M12 5v14M5 12h14" />
      </>
    ),
    car: (
      <>
        <path d="M5 16V11l2-4.5h10L19 11v5" />
        <path d="M3.5 16h17v2.5h-17zM5 11h14" />
      </>
    ),
    check: (
      <>
        <path d="M5 12l5 5 9-10" />
      </>
    ),
    lock: (
      <>
        <rect x="5" y="11" width="14" height="9" rx="2" />
        <path d="M8 11V8a4 4 0 0 1 8 0v3" />
      </>
    ),
    arrow: (
      <>
        <path d="M5 12h14M13 6l6 6-6 6" />
      </>
    ),
    search: (
      <>
        <circle cx="11" cy="11" r="6.5" />
        <path d="M16 16l4 4" />
      </>
    ),
    box: (
      <>
        <path d="M12 3l8 4.5v9L12 21l-8-4.5v-9L12 3z" />
        <path d="M4 7.5l8 4.5 8-4.5M12 12v9" />
      </>
    ),
    pin: (
      <>
        <path d="M12 21s6-5.6 6-10.5A6 6 0 0 0 6 10.5C6 15.4 12 21 12 21z" />
        <circle cx="12" cy="10.5" r="2.2" />
      </>
    ),
    chev: (
      <>
        <path d="M6 9l6 6 6-6" />
      </>
    ),
    clock: (
      <>
        <circle cx="12" cy="12" r="8.5" />
        <path d="M12 7.5V12l3 2" />
      </>
    ),
    heart: (
      <>
        <path d="M12 20s-7-4.4-7-10a4.2 4.2 0 0 1 7-3 4.2 4.2 0 0 1 7 3c0 5.6-7 10-7 10z" />
      </>
    ),
    hand: (
      <>
        <path d="M3 11l4-3 4 1.5 3-1.5 4 3.5-4.5 5.5-3.5-1-3 1.5L3 11z" />
        <path d="M17 8.5l4 2.5" />
      </>
    ),
  };

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      style={style}
      aria-hidden="true"
    >
      {paths[name]}
    </svg>
  );
}

interface CampusHomeProps {
  onLogout?: () => void;
}

export default function CampusHomeDashboard({ onLogout }: CampusHomeProps) {
  const { resolvedUser, isDemoUser, firstName } = useCurrentUser();
  const [searchQuery, setSearchQuery] = useState("");
  const [toastMsg, setToastMsg] = useState("");
  const [showToast, setShowToast] = useState(false);
  const [showProfileModal, setShowProfileModal] = useState(false);

  const productsStorageKey = getUserScopedKey(
    "unishare_my_products",
    resolvedUser.email,
    isDemoUser
  );
  const walletStorageKey = getUserScopedKey(
    "unishare_wallet",
    resolvedUser.email,
    isDemoUser
  );
  const notificationsStorageKey = getUserScopedKey(
    "unishare_notifications",
    resolvedUser.email,
    isDemoUser
  );

  const rawProductsJson = useLocalStorageRaw(productsStorageKey);
  const rawWalletJson = useLocalStorageRaw(walletStorageKey);
  const rawNotificationsJson = useLocalStorageRaw(notificationsStorageKey);

  const myProducts = useMemo(() => {
    if (!rawProductsJson) return null;
    try {
      const parsed = JSON.parse(rawProductsJson);
      return Array.isArray(parsed)
        ? (parsed as Array<{
            name?: string;
            category?: string;
            condition?: string;
            price?: number;
            rate?: number;
            deposit?: number;
            status?: string;
            state?: string;
          }>)
        : null;
    } catch {
      return null;
    }
  }, [rawProductsJson]);

  const walletSummary = useMemo(() => {
    if (!rawWalletJson) return null;
    try {
      return JSON.parse(rawWalletJson) as {
        balance?: number;
        heldDeposit?: number;
      };
    } catch {
      return null;
    }
  }, [rawWalletJson]);

  const storedNotifications = useMemo(() => {
    if (!rawNotificationsJson) return null;
    try {
      const parsed = JSON.parse(rawNotificationsJson);
      return Array.isArray(parsed)
        ? (parsed as Array<{
            title?: string;
            meta?: string;
            body?: string;
            read?: boolean;
          }>)
        : null;
    } catch {
      return null;
    }
  }, [rawNotificationsJson]);

  const tokenBalance = walletSummary?.balance ?? resolvedUser.tokenBalance;
  const heldDeposit = walletSummary?.heldDeposit ?? (isDemoUser ? 100 : 0);
  const activeRentalsCount = isDemoUser ? 1 : 0;
  const liveListingsCount = myProducts
    ? myProducts.filter(
        (p) => p.status !== "Paused" && p.state !== "paused" && p.state !== "draft"
      ).length
    : isDemoUser
    ? 2
    : 0;
  const firstListing =
    myProducts && myProducts.length > 0
      ? myProducts.find((p) => p.state !== "paused" && p.state !== "draft") ||
        myProducts[0]
      : isDemoUser
      ? {
          name: "Canon EOS 200D",
          category: "Cameras",
          condition: "Good",
          price: 60,
          rate: 60,
          deposit: 300,
          status: "Active",
          state: "active",
        }
      : null;

  const triggerToast = (msg: string) => {
    setToastMsg(msg);
    setShowToast(true);
    setTimeout(() => {
      setShowToast(false);
    }, 1800);
  };

  const handleLogoutClick = (e: React.MouseEvent) => {
    e.preventDefault();
    clearClientSession();
    if (onLogout) {
      onLogout();
    } else {
      window.location.href = "/";
    }
  };

  return (
    <div className="unishare-campus-home">
      <AppNavbar
        activeNav="home"
        user={{ tokenBalance }}
        onLogout={onLogout}
        onOpenProfile={() => setShowProfileModal(true)}
        onSos={() =>
          triggerToast("Emergency Campus SOS: Campus security contacted.")
        }
      />

      {/* Main Content */}
      <main className="wrap">
        <div className="eyebrow">Your campus, still sharing</div>
        <div className="hero">
          <div>
            <h1>Hello, {firstName}.</h1>
            <p className="sub">What do you need for your campus day?</p>
          </div>
          <div className="acts">
            <Link className="btn solid" href="/marketplace/list">
              <SvgIcon name="plus" size={16} />
              List an item
            </Link>
            <Link className="btn" href="/rides">
              <SvgIcon name="car" size={16} />
              Offer a ride
            </Link>
          </div>
        </div>

        {/* University Verification Banner */}
        <div className="band">
          <SvgIcon name="shield" size={18} style={{ width: "auto" }} />
          <div>
            <b>{resolvedUser.university}</b>
            <p>
              Only your university. Every item and ride here is from a verified{" "}
              {resolvedUser.university} student.
            </p>
          </div>
          {resolvedUser.verified ? (
            <span>
              <SvgIcon name="check" size={12} />
              Verified student
              <SvgIcon name="lock" size={16} />
            </span>
          ) : resolvedUser.studentId ? (
            <span>
              <SvgIcon name="clock" size={12} />
              Verification in review
              <SvgIcon name="lock" size={16} />
            </span>
          ) : (
            <Link href="/student-verification" style={{ textDecoration: "none", color: "inherit" }}>
              <span>
                <SvgIcon name="shield" size={12} />
                Complete student verification
                <SvgIcon name="arrow" size={14} />
              </span>
            </Link>
          )}
        </div>

        {/* Stat Cards */}
        <div className="stats">
          <div className="stat">
            <small>Available tokens</small>
            <strong>{tokenBalance}</strong>
            <p>Ready for your next booking</p>
          </div>
          <div className="stat">
            <small>Held deposits</small>
            <strong>{heldDeposit}</strong>
            <p>
              {isDemoUser
                ? "1 active rental deposit"
                : heldDeposit > 0
                ? "Refundable rental deposit"
                : "No held deposits"}
            </p>
          </div>
          <div className="stat">
            <small>Active rentals</small>
            <strong>{activeRentalsCount}</strong>
            <p>
              {activeRentalsCount === 0
                ? "No active rentals yet"
                : `${activeRentalsCount} item${activeRentalsCount > 1 ? "s" : ""} borrowed`}
            </p>
          </div>
          <div className="stat">
            <small>Live listings</small>
            <strong>{liveListingsCount}</strong>
            <p>
              {liveListingsCount === 0
                ? "No items listed yet"
                : `${liveListingsCount} item${liveListingsCount === 1 ? "" : "s"} available for rent`}
            </p>
          </div>
        </div>

        {/* Dashboard Tools */}
        <div className="sh" id="dashboard">
          <div>
            <h2>Dashboard tools</h2>
            <p>Search, notifications, wallet and activity in one place.</p>
          </div>
          <Link className="more" href="/notifications">
            View all activity <SvgIcon name="arrow" size={14} />
          </Link>
        </div>

        {/* Search */}
        <div className="search">
          <SvgIcon name="search" size={16} />
          <input
            id="q"
            type="search"
            placeholder="Search items, categories or owners"
            aria-label="Search items"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        {/* Panels */}
        <div className="tools">
          <div className="panel">
            <div className="ph">
              <span className="ic">
                <SvgIcon name="bell" size={18} />
              </span>
              <div>
                <b>Notifications</b>
                <small>
                  {storedNotifications
                    ? `${storedNotifications.filter((n) => !n.read).length} unread updates`
                    : isDemoUser
                    ? "3 unread updates"
                    : "Account updates"}
                </small>
              </div>
              <Link className="tag" href="/notifications">
                {storedNotifications || isDemoUser ? "View" : "New"}
              </Link>
            </div>
            {storedNotifications && storedNotifications.length > 0 ? (
              storedNotifications.slice(0, 3).map((n, idx) => (
                <div className="li" key={idx}>
                  <span className="ck">
                    <SvgIcon name="check" size={11} />
                  </span>
                  <div>
                    <b>{n.title || "Campus update"}</b>
                    <p>{n.meta ? `${n.meta} · ` : ""}{n.body || ""}</p>
                  </div>
                </div>
              ))
            ) : isDemoUser ? (
              <>
                <div className="li">
                  <span className="ck">
                    <SvgIcon name="check" size={11} />
                  </span>
                  <div>
                    <b>Pickup reminder for scientific calculator</b>
                    <p>14 Oct · 9:10 AM · Pickup at Science Library today.</p>
                  </div>
                </div>
                <div className="li">
                  <span className="ck">
                    <SvgIcon name="check" size={11} />
                  </span>
                  <div>
                    <b>Car ride seat booked</b>
                    <p>14 Oct · 9:18 AM · Arif Hossain · Dhanmondi 27 to TSC · 80 tokens / seat.</p>
                  </div>
                </div>
                <div className="li">
                  <span className="ck">
                    <SvgIcon name="check" size={11} />
                  </span>
                  <div>
                    <b>New request for Canon EOS 200D</b>
                    <p>14 Oct · 9:22 AM · Review the request and respond from your listings.</p>
                  </div>
                </div>
              </>
            ) : (
              <>
                <div className="li">
                  <span className="ck">
                    <SvgIcon name="check" size={11} />
                  </span>
                  <div>
                    <b>Welcome to {resolvedUser.university}</b>
                    <p>Your profile is active for {resolvedUser.email}.</p>
                  </div>
                </div>
                <div className="li">
                  <span className="ck">
                    <SvgIcon name="check" size={11} />
                  </span>
                  <div>
                    <b>
                      {resolvedUser.studentId
                        ? `Student ID ${resolvedUser.studentId} linked`
                        : "Complete student ID verification"}
                    </b>
                    <p>
                      {resolvedUser.department
                        ? `Department: ${resolvedUser.department}`
                        : "Submit your campus details to unlock all listings."}
                    </p>
                  </div>
                </div>
                <div className="li">
                  <span className="ck">
                    <SvgIcon name="check" size={11} />
                  </span>
                  <div>
                    <b>{tokenBalance} starter tokens available</b>
                    <p>Use tokens to rent items or top up anytime in your wallet.</p>
                  </div>
                </div>
              </>
            )}
          </div>

          <div className="panel wal">
            <div className="ph">
              <span className="ic">
                <SvgIcon name="box" size={18} />
              </span>
              <div>
                <b>Wallet Access</b>
                <small>{tokenBalance} tokens ready</small>
              </div>
              <Link className="tag" href="/wallet">
                Open wallet
              </Link>
            </div>
          </div>

          <div className="panel">
            <div className="ph">
              <span className="ic">
                <SvgIcon name="box" size={18} />
              </span>
              <div>
                <b>Recent Activity</b>
                <small>{isDemoUser ? "2 updates" : "Account summary"}</small>
              </div>
              <span className="tag">Today</span>
            </div>
            {isDemoUser ? (
              <>
                <div className="li">
                  <span className="ck">
                    <SvgIcon name="check" size={11} />
                  </span>
                  <div>
                    <b>Scientific calculator rental confirmed</b>
                    <p>14 Oct · 9:10 AM · 80 rental tokens charged; 100 held deposit.</p>
                  </div>
                </div>
                <div className="li">
                  <span className="ck">
                    <SvgIcon name="check" size={11} />
                  </span>
                  <div>
                    <b>Car ride seat booked</b>
                    <p>14 Oct · 9:18 AM · Arif Hossain · 80 tokens / seat.</p>
                  </div>
                </div>
              </>
            ) : (
              <>
                <div className="li">
                  <span className="ck">
                    <SvgIcon name="check" size={11} />
                  </span>
                  <div>
                    <b>Signed in as {resolvedUser.name}</b>
                    <p>{resolvedUser.university} · Member since {formatMemberSince(resolvedUser.createdAt)}.</p>
                  </div>
                </div>
                <div className="li">
                  <span className="ck">
                    <SvgIcon name="check" size={11} />
                  </span>
                  <div>
                    <b>
                      {liveListingsCount > 0 && firstListing?.name
                        ? `Listing active: ${firstListing.name}`
                        : "Ready to list or borrow on campus"}
                    </b>
                    <p>{tokenBalance} tokens available in your {resolvedUser.university} wallet.</p>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Upcoming Ride Card */}
        <div className="wide" id="rides">
          <div className="wh">
            <span className="ic">
              <SvgIcon name="car" size={18} />
            </span>
            <div>
              <b>Upcoming Ride</b>
              <small>{isDemoUser ? "Confirmed today" : "Your campus rides"}</small>
            </div>
            <span className="tag">
              {isDemoUser ? "80 tokens / seat" : "0 booked"}
            </span>
          </div>
          {isDemoUser ? (
            <>
              <div className="route">
                <div>
                  <SvgIcon name="clock" size={15} />
                  Dhanmondi 27
                </div>
                <div>
                  <SvgIcon name="pin" size={13} />
                  TSC, DU
                </div>
              </div>
              <div className="meta">
                <span>15 Oct · 8:30 AM</span>
                <span>Car · 2 seats left</span>
              </div>
              <div className="foot">
                <span className="ow" style={{ margin: 0 }}>
                  <span
                    className="mini"
                    style={{
                      width: "22px",
                      height: "22px",
                      borderRadius: "50%",
                      background: "var(--mint)",
                      color: "var(--teal)",
                      fontSize: "8px",
                      fontWeight: 700,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    AH
                  </span>
                  Arif Hossain{" "}
                  <SvgIcon name="check" size={12} style={{ color: "var(--teal)" }} />
                </span>
                <Link className="more" href="/rides">
                  Details <SvgIcon name="arrow" size={14} />
                </Link>
              </div>
            </>
          ) : (
            <>
              <div className="meta" style={{ marginTop: "6px" }}>
                <span>No upcoming ride booked yet for {resolvedUser.university}.</span>
              </div>
              <div className="foot">
                <span className="ow" style={{ margin: 0, color: "var(--muted)" }}>
                  Find or offer verified campus seats
                </span>
                <Link className="more" href="/rides">
                  Browse rides <SvgIcon name="arrow" size={14} />
                </Link>
              </div>
            </>
          )}
        </div>

        {/* Active Rental Card */}
        <div className="wide" id="rentals">
          <div className="wh">
            <span className="ic">
              <SvgIcon name="box" size={18} />
            </span>
            <div>
              <b>Active Rental</b>
              <small>{isDemoUser ? "Pickup today" : "Your borrowings"}</small>
            </div>
            <span className="tag">
              {isDemoUser ? "80 rental + 100 deposit" : "0 active"}
            </span>
          </div>
          {isDemoUser ? (
            <>
              <div className="rent">
                <div className="rim">
                  <span className="av-t">Pickup today</span>
                </div>
                <div>
                  <small>Calculators</small>
                  <h3>Scientific calculator</h3>
                  <div className="pr">
                    <b>40</b>tokens / day
                  </div>
                  <div className="loc">
                    <SvgIcon name="pin" size={12} />
                    Science Library
                  </div>
                  <div
                    className="ow"
                    style={{
                      borderTop: "1px solid var(--hair)",
                      paddingTop: "8px",
                      marginTop: "10px",
                    }}
                  >
                    <span className="mini">NA</span>
                    Nafis Ahmed
                    <SvgIcon name="check" size={12} />
                  </div>
                </div>
              </div>
              <div className="rsum" style={{ marginTop: "10px" }}>
                <span>2 days</span>
                <span>80 rental tokens</span>
                <span>100 refundable deposit</span>
              </div>
            </>
          ) : (
            <div className="foot" style={{ marginTop: "6px" }}>
              <span className="ow" style={{ margin: 0, color: "var(--muted)" }}>
                You haven&apos;t borrowed an item yet. You have {tokenBalance} tokens ready.
              </span>
              <Link className="more" href="/marketplace">
                Browse Marketplace <SvgIcon name="arrow" size={14} />
              </Link>
            </div>
          )}
        </div>

        {/* Your Campus Corner */}
        <div className="sh">
          <h2>Your campus corner</h2>
        </div>
        <div className="corner">
          <div className="cc">
            <h3>
              My rentals <SvgIcon name="box" size={18} />
            </h3>
            <div className="row">
              <b>
                {activeRentalsCount} item{activeRentalsCount === 1 ? "" : "s"} borrowed
              </b>
              <span className="tag">
                {activeRentalsCount > 0 ? `${activeRentalsCount} borrowed` : "Ready"}
              </span>
            </div>
            <div className="row" style={{ marginTop: "2px" }}>
              <p>
                {activeRentalsCount} active rental ·{" "}
                {isDemoUser ? "1 booked ride" : "0 booked rides"}
              </p>
            </div>
            <div className="row" style={{ marginTop: "2px" }}>
              <p>{isDemoUser ? "1 booked ride" : `${tokenBalance} available tokens`}</p>
              <p>
                {liveListingsCount} live listing{liveListingsCount === 1 ? "" : "s"}
              </p>
            </div>
            <Link className="more" href={isDemoUser ? "#rentals" : "/marketplace"}>
              {isDemoUser ? "View rentals" : "Browse rentals"} <SvgIcon name="arrow" size={14} />
            </Link>
          </div>
          <div className="cc">
            <h3>
              My listings <SvgIcon name="hand" size={20} />
            </h3>
            {firstListing ? (
              <>
                <div className="row">
                  <b>{firstListing.name}</b>
                  <span className="tag">
                    {firstListing.status ||
                      (firstListing.state === "draft"
                        ? "Draft"
                        : firstListing.state === "paused"
                        ? "Paused"
                        : "Active")}
                  </span>
                </div>
                <div className="row" style={{ marginTop: "2px" }}>
                  <p>
                    {firstListing.category || "Campus Item"} ·{" "}
                    {firstListing.condition || "Good"} ·{" "}
                    {firstListing.price ?? firstListing.rate ?? 0} tokens / day
                  </p>
                </div>
                <div className="row" style={{ marginTop: "2px" }}>
                  <p>{isDemoUser ? "1 pending request" : `${liveListingsCount} live listing${liveListingsCount === 1 ? "" : "s"}`}</p>
                  <p>{firstListing.deposit || 0} tokens deposit</p>
                </div>
              </>
            ) : (
              <>
                <div className="row">
                  <b>No listings yet</b>
                  <span className="tag">0 active</span>
                </div>
                <div className="row" style={{ marginTop: "2px" }}>
                  <p>Share books, calculators, or chargers with {resolvedUser.university} peers.</p>
                </div>
              </>
            )}
            <Link className="more" href="/my-products">
              Manage listings <SvgIcon name="arrow" size={14} />
            </Link>
          </div>
        </div>

        {/* Sharing Guide */}
        <div className="guide">
          <SvgIcon name="shield" size={18} style={{ color: "var(--teal)" }} />
          Meet in a public campus spot, check the item together, and agree on the return time.{" "}
          <Link href="#">
            Sharing guide <SvgIcon name="arrow" size={14} />
          </Link>
        </div>
      </main>

      {/* Footer */}
      <footer>
        <div className="wrap">
          <span>UniShare. Made for university students in Bangladesh.</span>
          <span>
            <Link href="#" style={{ marginLeft: 0 }}>
              Privacy
            </Link>
            <Link href="#">Terms</Link>
            <Link href="#">Get help</Link>
            <a href="#" onClick={handleLogoutClick}>
              Log out
            </a>
          </span>
        </div>
      </footer>

      {/* Student Profile Modal */}
      {showProfileModal && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0, 0, 0, 0.45)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 100,
            padding: "20px",
          }}
          onClick={() => setShowProfileModal(false)}
        >
          <div
            style={{
              background: "#ffffff",
              border: "1.5px solid var(--line)",
              borderRadius: "16px",
              width: "100%",
              maxWidth: "440px",
              padding: "24px",
              boxShadow: "0 12px 30px rgba(0,0,0,0.15)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "14px",
                marginBottom: "16px",
              }}
            >
              <div
                style={{
                  width: "48px",
                  height: "48px",
                  borderRadius: "50%",
                  background: "var(--mint)",
                  border: "1.5px solid var(--teal)",
                  color: "var(--teal)",
                  fontWeight: 700,
                  fontSize: "18px",
                  display: "grid",
                  placeItems: "center",
                }}
              >
                {resolvedUser.initials}
              </div>
              <div>
                <b style={{ fontSize: "17px", display: "block" }}>
                  {resolvedUser.name}
                </b>
                <small style={{ color: "var(--muted)", fontSize: "12px" }}>
                  {resolvedUser.email}
                </small>
                <div
                  style={{
                    fontSize: "11px",
                    color: "var(--teal)",
                    fontWeight: 700,
                    marginTop: "2px",
                  }}
                >
                  {resolvedUser.university} ·{" "}
                  {resolvedUser.verified
                    ? "Verified Student 🛡️"
                    : resolvedUser.studentId
                    ? "Verification Pending ⏳"
                    : "Email Verified"}
                </div>
              </div>
            </div>

            {/* Profile Info Details */}
            <div
              style={{
                background: "var(--mint)",
                borderRadius: "10px",
                padding: "14px 16px",
                marginBottom: "16px",
                fontSize: "12.5px",
                lineHeight: "1.6",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "6px" }}>
                <span style={{ color: "var(--muted)" }}>Student ID:</span>
                <b>{resolvedUser.studentId || "Not submitted yet"}</b>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "6px" }}>
                <span style={{ color: "var(--muted)" }}>Department:</span>
                <b>{resolvedUser.department || "Not provided yet"}</b>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "6px" }}>
                <span style={{ color: "var(--muted)" }}>Campus Status:</span>
                <b style={{ color: "var(--teal)" }}>
                  {resolvedUser.verified
                    ? "Verified Member ✓"
                    : resolvedUser.studentId
                    ? "In Review"
                    : "Pending Step 3"}
                </b>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ color: "var(--muted)" }}>Member Since:</span>
                <b>{formatMemberSince(resolvedUser.createdAt)}</b>
              </div>
            </div>

            {/* Campus Activity Summary */}
            <div
              style={{
                border: "1px solid var(--hair)",
                borderRadius: "10px",
                padding: "12px 16px",
                marginBottom: "20px",
                fontSize: "12px",
                color: "var(--muted)",
              }}
            >
              <b style={{ color: "var(--ink)", display: "block", marginBottom: "6px" }}>
                Campus Activity Overview
              </b>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "4px" }}>
                <span>Active Rentals:</span>
                <span style={{ color: "var(--ink)", fontWeight: 600 }}>
                  {isDemoUser ? "1 item (Scientific calculator)" : `${activeRentalsCount} items`}
                </span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span>Live Listings:</span>
                <span style={{ color: "var(--ink)", fontWeight: 600 }}>
                  {liveListingsCount} item{liveListingsCount === 1 ? "" : "s"}
                  {firstListing?.name ? ` (${firstListing.name})` : ""}
                </span>
              </div>
            </div>

            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                gap: "8px",
                flexWrap: "wrap",
              }}
            >
              <button
                className="btn"
                style={{
                  borderColor: "var(--hair)",
                  color: "var(--muted)",
                  fontSize: "12px",
                }}
                onClick={() => setShowProfileModal(false)}
              >
                Close
              </button>
              <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                <Link
                  href="/settings"
                  className="btn solid"
                  style={{ fontSize: "12px" }}
                  onClick={() => setShowProfileModal(false)}
                >
                  Settings
                </Link>
                <button
                  className="btn"
                  style={{
                    borderColor: "#c0392b",
                    color: "#c0392b",
                    fontSize: "12px",
                  }}
                  onClick={handleLogoutClick}
                >
                  Log out
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Toast Notification */}
      <div
        className={`toast ${showToast ? "on" : ""}`}
        id="toast"
        role="status"
        aria-live="polite"
      >
        {toastMsg}
      </div>
    </div>
  );
}

