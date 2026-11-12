"use client";

import React, { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import AppNavbar from "./components/AppNavbar";
import {
  clearClientSession,
  formatMemberSince,
  saveClientUser,
  useCurrentUser,
  useRequireAuth,
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

interface HomeProduct {
  id: string;
  name: string;
  category: string;
  condition: string;
  state: "active" | "paused" | "draft";
  rate: number;
  deposit: number;
}

interface HomeRental {
  id: string;
  listingId: string;
  listingTitle: string;
  borrowerName: string;
  lenderName: string;
  startDate: string;
  endDate: string;
  days: number;
  rentalFee: number;
  depositAmount: number;
  totalLocked: number;
  status: string;
}

interface HomeTransaction {
  id: string;
  title: string;
  subtitle: string;
  amount: number;
}

interface HomeNotification {
  id: string;
  title: string;
  body: string;
  unread: boolean;
  actionHref: string;
}

interface HomeJourney {
  id: string;
  origin: string;
  destination: string;
  createdAt?: string;
}

export default function CampusHomeDashboard({ onLogout }: CampusHomeProps) {
  const router = useRouter();
  const { resolvedUser, firstName } = useCurrentUser();
  const isAuthenticated = useRequireAuth("/home");
  const [searchQuery, setSearchQuery] = useState("");
  const [toastMsg, setToastMsg] = useState("");
  const [showToast, setShowToast] = useState(false);
  const [showProfileModal, setShowProfileModal] = useState(false);

  const [fetchedTokenBalance, setFetchedTokenBalance] = useState<number | null>(null);
  const tokenBalance = fetchedTokenBalance ?? resolvedUser.tokenBalance;
  const [heldDeposit, setHeldDeposit] = useState<number>(0);
  const [transactions, setTransactions] = useState<HomeTransaction[]>([]);
  const [myProducts, setMyProducts] = useState<HomeProduct[]>([]);
  const [borrowedRentals, setBorrowedRentals] = useState<HomeRental[]>([]);
  const [lentRentals, setLentRentals] = useState<HomeRental[]>([]);
  const [notifications, setNotifications] = useState<HomeNotification[]>([]);
  const [unreadNotificationsCount, setUnreadNotificationsCount] = useState<number>(0);
  const [myActiveJourney, setMyActiveJourney] = useState<HomeJourney | null>(null);
  const [activePartnersCount, setActivePartnersCount] = useState<number>(0);
  const resolvedUserRef = useRef(resolvedUser);
  useEffect(() => {
    resolvedUserRef.current = resolvedUser;
  }, [resolvedUser]);

  useEffect(() => {
    if (!isAuthenticated || !resolvedUser.email) return;
    let active = true;
    const userEmail = resolvedUser.email;
    const headers = { "x-user-email": userEmail };

    const load = async () => {
      try {
        const [walletRes, prodRes, rentRes, notifRes, ridesRes] = await Promise.all([
          fetch("/api/wallet", { headers }).catch(() => null),
          fetch("/api/marketplace?mine=true", { headers }).catch(() => null),
          fetch("/api/marketplace/rentals", { headers }).catch(() => null),
          fetch("/api/notifications?limit=4", { headers }).catch(() => null),
          fetch("/api/rides?browse=active", { headers }).catch(() => null),
        ]);
        if (!active) return;

        if (walletRes?.ok) {
          const w = (await walletRes.json().catch(() => null)) as {
            ok?: boolean;
            tokenBalance?: number;
            heldDeposit?: number;
            transactions?: HomeTransaction[];
          } | null;
          if (active && w?.ok) {
            if (typeof w.tokenBalance === "number") {
              setFetchedTokenBalance(w.tokenBalance);
              const latestUser = resolvedUserRef.current;
              if (w.tokenBalance !== latestUser.tokenBalance) {
                saveClientUser({ ...latestUser, tokenBalance: w.tokenBalance });
              }
            }
            setHeldDeposit(w.heldDeposit ?? 0);
            setTransactions(Array.isArray(w.transactions) ? w.transactions : []);
          }
        }

        if (prodRes?.ok) {
          const p = (await prodRes.json().catch(() => null)) as {
            ok?: boolean;
            myProducts?: HomeProduct[];
          } | null;
          if (active && p?.ok && Array.isArray(p.myProducts)) {
            setMyProducts(p.myProducts);
          }
        }

        if (rentRes?.ok) {
          const r = (await rentRes.json().catch(() => null)) as {
            ok?: boolean;
            borrowed?: HomeRental[];
            lent?: HomeRental[];
          } | null;
          if (active && r?.ok) {
            setBorrowedRentals(Array.isArray(r.borrowed) ? r.borrowed : []);
            setLentRentals(Array.isArray(r.lent) ? r.lent : []);
          }
        }

        if (notifRes?.ok) {
          const n = (await notifRes.json().catch(() => null)) as {
            ok?: boolean;
            notifications?: HomeNotification[];
            unreadCount?: number;
          } | null;
          if (active && n?.ok) {
            setNotifications(Array.isArray(n.notifications) ? n.notifications : []);
            setUnreadNotificationsCount(n.unreadCount ?? 0);
          }
        }

        if (ridesRes?.ok) {
          const rd = (await ridesRes.json().catch(() => null)) as {
            success?: boolean;
            count?: number;
            myActiveJourney?: HomeJourney | null;
          } | null;
          if (active && rd?.success) {
            setMyActiveJourney(rd.myActiveJourney ?? null);
            setActivePartnersCount(rd.count ?? 0);
          }
        }
      } catch {
        // Ignore transient network errors
      }
    };

    void load();

    const handleLiveRefresh = () => {
      if (typeof document !== "undefined" && document.visibilityState !== "visible") return;
      void load();
    };
    const interval = setInterval(handleLiveRefresh, 15000);
    window.addEventListener("focus", handleLiveRefresh);

    return () => {
      active = false;
      clearInterval(interval);
      window.removeEventListener("focus", handleLiveRefresh);
    };
  }, [isAuthenticated, resolvedUser.email]);

  const activeBorrowedRentals = borrowedRentals.filter(
    (r) => r.status === "PENDING" || r.status === "ACTIVE"
  );
  const activeRentalsCount = activeBorrowedRentals.length;
  const firstBorrowed = activeBorrowedRentals[0] || null;
  const pendingLentCount = lentRentals.filter((r) => r.status === "PENDING").length;

  const liveListings = myProducts.filter((p) => p.state === "active");
  const liveListingsCount = liveListings.length;
  const firstListing = liveListings[0] || myProducts[0] || null;

  const triggerToast = (msg: string) => {
    setToastMsg(msg);
    setShowToast(true);
    setTimeout(() => {
      setShowToast(false);
    }, 1800);
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const q = searchQuery.trim();
    router.push(q ? `/marketplace?q=${encodeURIComponent(q)}` : "/marketplace");
  };

  const handleLogoutClick = (e: React.MouseEvent) => {
    e.preventDefault();
    clearClientSession();
    if (onLogout) {
      onLogout();
    } else {
      router.push("/");
    }
  };

  if (!isAuthenticated) {
    return (
      <div className="unishare-campus-home" style={{ minHeight: "100vh", background: "#ffffff" }}>
        <AppNavbar activeNav="home" />
        <main className="wrap" style={{ paddingTop: "36px" }}>
          <div style={{ height: "42px", width: "260px", borderRadius: "8px", background: "#f5f7f6", marginBottom: "18px" }} />
          <div style={{ height: "110px", borderRadius: "12px", background: "#e9f2ef" }} />
        </main>
      </div>
    );
  }

  return (
    <div className="unishare-campus-home">
      <AppNavbar
        activeNav="home"
        user={{ tokenBalance }}
        unreadCount={unreadNotificationsCount}
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
              {heldDeposit > 0
                ? `${activeRentalsCount} active rental deposit${activeRentalsCount === 1 ? "" : "s"}`
                : "No held deposits"}
            </p>
          </div>
          <div className="stat">
            <small>Active rentals</small>
            <strong>{activeRentalsCount}</strong>
            <p>
              {activeRentalsCount === 0
                ? "No active rentals yet"
                : `${activeRentalsCount} item${activeRentalsCount > 1 ? "s" : ""} in progress`}
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
        <form className="search" onSubmit={handleSearchSubmit}>
          <SvgIcon name="search" size={16} />
          <input
            id="q"
            type="search"
            placeholder="Search campus items and press Enter"
            aria-label="Search items"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </form>

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
                  {notifications.length > 0
                    ? `${unreadNotificationsCount} unread update${unreadNotificationsCount === 1 ? "" : "s"}`
                    : "Account updates"}
                </small>
              </div>
              <Link className="tag" href="/notifications">
                View
              </Link>
            </div>
            {notifications.length > 0 ? (
              notifications.slice(0, 3).map((n) => (
                <div className="li" key={n.id}>
                  <span className="ck">
                    <SvgIcon name="check" size={11} />
                  </span>
                  <div>
                    <b>{n.title}</b>
                    <p>{n.body}</p>
                  </div>
                </div>
              ))
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
                    <b>{tokenBalance} tokens available</b>
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
                <small>{transactions.length > 0 ? `${transactions.length} recorded` : "Account summary"}</small>
              </div>
              <Link className="tag" href="/wallet">
                Ledger
              </Link>
            </div>
            {transactions.length > 0 ? (
              transactions.slice(0, 2).map((tx) => (
                <div className="li" key={tx.id}>
                  <span className="ck">
                    <SvgIcon name="check" size={11} />
                  </span>
                  <div>
                    <b>{tx.title}</b>
                    <p>{tx.amount >= 0 ? `+${tx.amount}` : tx.amount} tokens · {tx.subtitle}</p>
                  </div>
                </div>
              ))
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
              <b>Campus Ride Sharing</b>
              <small>{myActiveJourney ? "Your live route" : "Your campus rides"}</small>
            </div>
            <span className="tag">
              {myActiveJourney
                ? "Active route"
                : `${activePartnersCount} active peer${activePartnersCount === 1 ? "" : "s"}`}
            </span>
          </div>
          {myActiveJourney ? (
            <>
              <div className="route">
                <div>
                  <SvgIcon name="clock" size={15} />
                  {myActiveJourney.origin}
                </div>
                <div>
                  <SvgIcon name="pin" size={13} />
                  {myActiveJourney.destination}
                </div>
              </div>
              <div className="meta">
                <span>{resolvedUser.university} corridor</span>
                <span>{activePartnersCount} active campus partner{activePartnersCount === 1 ? "" : "s"} nearby</span>
              </div>
              <div className="foot">
                <span className="ow" style={{ margin: 0 }}>
                  Live GPS matching enabled
                </span>
                <Link className="more" href="/rides">
                  Open live ride map <SvgIcon name="arrow" size={14} />
                </Link>
              </div>
            </>
          ) : (
            <>
              <div className="meta" style={{ marginTop: "6px" }}>
                <span>
                  {activePartnersCount > 0
                    ? `${activePartnersCount} verified ${resolvedUser.university} student${activePartnersCount === 1 ? "" : "s"} currently active on campus routes.`
                    : `No active ride posted right now for ${resolvedUser.university}.`}
                </span>
              </div>
              <div className="foot">
                <span className="ow" style={{ margin: 0, color: "var(--muted)" }}>
                  Find or post safe same-campus travel partners
                </span>
                <Link className="more" href="/rides">
                  Open Rides <SvgIcon name="arrow" size={14} />
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
              <small>{firstBorrowed ? "In progress" : "Your borrowings"}</small>
            </div>
            <span className="tag">
              {firstBorrowed
                ? `${firstBorrowed.rentalFee} rental + ${firstBorrowed.depositAmount} deposit`
                : "0 active"}
            </span>
          </div>
          {firstBorrowed ? (
            <>
              <div className="foot" style={{ marginTop: "8px", alignItems: "flex-start" }}>
                <div>
                  <h3 style={{ fontSize: "16px", fontWeight: 700, marginBottom: "4px" }}>
                    {firstBorrowed.listingTitle}
                  </h3>
                  <div style={{ fontSize: "12.5px", color: "var(--muted)" }}>
                    Lender: <b>{firstBorrowed.lenderName}</b> · {firstBorrowed.startDate} → {firstBorrowed.endDate} ({firstBorrowed.days}d) · Status: <b>{firstBorrowed.status}</b>
                  </div>
                </div>
                <Link className="more" href="/my-products">
                  Manage rentals <SvgIcon name="arrow" size={14} />
                </Link>
              </div>
              <div className="rsum" style={{ marginTop: "10px" }}>
                <span>{firstBorrowed.days} days</span>
                <span>{firstBorrowed.rentalFee} rental tokens</span>
                <span>{firstBorrowed.depositAmount} refundable deposit</span>
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
                {activeRentalsCount > 0 ? `${activeRentalsCount} in escrow` : "Ready"}
              </span>
            </div>
            <div className="row" style={{ marginTop: "2px" }}>
              <p>
                {activeRentalsCount} active rental ·{" "}
                {myActiveJourney ? "1 active route" : "0 active routes"}
              </p>
            </div>
            <div className="row" style={{ marginTop: "2px" }}>
              <p>{tokenBalance} available tokens</p>
              <p>
                {liveListingsCount} live listing{liveListingsCount === 1 ? "" : "s"}
              </p>
            </div>
            <Link className="more" href={activeRentalsCount > 0 ? "/my-products" : "/marketplace"}>
              {activeRentalsCount > 0 ? "View rentals" : "Browse rentals"} <SvgIcon name="arrow" size={14} />
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
                    {firstListing.state === "draft"
                      ? "Draft"
                      : firstListing.state === "paused"
                      ? "Paused"
                      : "Active"}
                  </span>
                </div>
                <div className="row" style={{ marginTop: "2px" }}>
                  <p>
                    {firstListing.category || "Campus Item"} ·{" "}
                    {firstListing.condition || "Good"} ·{" "}
                    {firstListing.rate ?? 0} tokens / day
                  </p>
                </div>
                <div className="row" style={{ marginTop: "2px" }}>
                  <p>
                    {pendingLentCount > 0
                      ? `${pendingLentCount} pending request${pendingLentCount === 1 ? "" : "s"}`
                      : `${liveListingsCount} live listing${liveListingsCount === 1 ? "" : "s"}`}
                  </p>
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
          <Link href="/help">
            Sharing guide <SvgIcon name="arrow" size={14} />
          </Link>
        </div>
      </main>

      {/* Footer */}
      <footer>
        <div className="wrap">
          <span>UniShare. Made for university students in Bangladesh.</span>
          <span>
            <Link href="/privacy" style={{ marginLeft: 0 }}>
              Privacy
            </Link>
            <Link href="/terms">Terms</Link>
            <Link href="/help">Get help</Link>
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
                  {activeRentalsCount} item{activeRentalsCount === 1 ? "" : "s"}
                  {firstBorrowed ? ` (${firstBorrowed.listingTitle})` : ""}
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

