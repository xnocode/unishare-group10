"use client";

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import AppNavbar from "../components/AppNavbar";
import {
  clearClientSession,
  saveClientUser,
  useCurrentUser,
  useRequireAuth,
  type ClientUser,
} from "../lib/user-client";
import "./wallet.css";

// SVG helper for all wallet icons
function WalletIcon({
  name,
  size = 18,
  className = "",
  style = {},
}: {
  name: string;
  size?: number;
  className?: string;
  style?: React.CSSProperties;
}) {
  const icons: Record<string, React.ReactNode> = {
    shield: (
      <>
        <path d="M12 3l7 3v5c0 5-3 8-7 10-4-2-7-5-7-10V6z" />
        <path d="M9 12l2 2 4-4" />
      </>
    ),
    wallet: (
      <>
        <rect x="3" y="6" width="18" height="14" rx="3" />
        <path d="M3 10h18M16 14h2" />
      </>
    ),
    lock: (
      <>
        <rect x="5" y="11" width="14" height="9" rx="2" />
        <path d="M8 11V8a4 4 0 018 0v3M12 15v2" />
      </>
    ),
    calc: (
      <>
        <rect x="5" y="3" width="14" height="18" rx="2" />
        <path d="M8 7h8M8 12h1M12 12h1M16 12h0M8 16h1M12 16h1M16 16h0" />
      </>
    ),
    coin: (
      <>
        <circle cx="9" cy="9" r="5" />
        <circle cx="15" cy="15" r="5" />
      </>
    ),
    car: (
      <>
        <path d="M5 16V11l2-5h10l2 5v5zM3 16h18M7 19v-3M17 19v-3" />
        <path d="M5 11h14" />
      </>
    ),
    hand: (
      <>
        <path d="M3 11l4-4 4 2 3-2 7 6-5 5-3-1-3 2-3-3z" />
      </>
    ),
    help: (
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="M9.5 9.5a2.5 2.5 0 015 .5c0 1.5-2.5 2-2.5 3.5M12 17h0" />
      </>
    ),
    bell: (
      <>
        <path d="M6 17V11a6 6 0 0112 0v6l1.5 2h-15zM10 21h4" />
      </>
    ),
    plus: (
      <>
        <path d="M12 5v14M5 12h14" />
      </>
    ),
    up: (
      <>
        <path d="M7 17L17 7M8 7h9v9" />
      </>
    ),
    link: (
      <>
        <circle cx="8" cy="12" r="4" />
        <circle cx="16" cy="12" r="4" />
      </>
    ),
    check: (
      <>
        <path d="M5 12l5 5 9-10" />
      </>
    ),
    heart: (
      <>
        <path d="M12 20s-7-4.4-7-10a4.2 4.2 0 0 1 7-3 4.2 4.2 0 0 1 7 3c0 5.6-7 10-7 10z" />
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
      style={{ width: `${size}px`, height: `${size}px`, ...style }}
      aria-hidden="true"
    >
      {icons[name]}
    </svg>
  );
}

interface Transaction {
  id: string;
  icon: string;
  title: string;
  subtitle: string;
  amount: string;
  badge: string;
  isHeld?: boolean;
}

interface RawWalletTx {
  id: string;
  type: string;
  title: string;
  subtitle: string;
  amount: number;
  balanceAfter: number;
  createdAt: string;
}

interface ActiveBorrowItem {
  id: string;
  listingTitle: string;
  depositAmount: number;
  rentalFee: number;
  status: string;
}

function formatTxDate(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleDateString("en-GB", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  } catch {
    return "Recent";
  }
}

function mapRawTx(tx: RawWalletTx): Transaction {
  const iconMap: Record<string, string> = {
    TOPUP: "coin",
    TRANSFER_OUT: "hand",
    TRANSFER_IN: "coin",
    RENTAL_HOLD: "lock",
    RENTAL_REFUND: "check",
    RENTAL_EARN: "coin",
    RIDE_BOOK: "car",
  };
  const isPositive = tx.amount > 0;
  return {
    id: tx.id,
    icon: iconMap[tx.type] || "coin",
    title: tx.title,
    subtitle: `${formatTxDate(tx.createdAt)} · ${tx.subtitle}`,
    amount: isPositive ? `+${tx.amount} tokens` : `−${Math.abs(tx.amount)} tokens`,
    badge: `Bal: ${tx.balanceAfter}`,
    isHeld: tx.type === "RENTAL_HOLD",
  };
}

export default function WalletPage() {
  const router = useRouter();
  const { resolvedUser } = useCurrentUser();
  const [toastMsg, setToastMsg] = useState("");
  const [showToast, setShowToast] = useState(false);

  const [fetchedBalance, setFetchedBalance] = useState<number | null>(null);
  const balance = fetchedBalance ?? resolvedUser.tokenBalance;
  const [heldDeposit, setHeldDeposit] = useState<number>(0);
  const [activeBorrows, setActiveBorrows] = useState<ActiveBorrowItem[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [favoritesCount, setFavoritesCount] = useState<number>(0);
  const [showAllTx, setShowAllTx] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // Transfer Modal
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [recipientEmail, setRecipientEmail] = useState("");
  const [transferAmount, setTransferAmount] = useState("50");
  const [transferNote, setTransferNote] = useState("");
  const [transferSubmitting, setTransferSubmitting] = useState(false);
  const [peerSuggestions, setPeerSuggestions] = useState<
    Array<{
      id: string;
      fullName: string;
      initials: string;
      email: string;
      university: string;
      relation: string;
    }>
  >([]);
  const [isLoadingPeers, setIsLoadingPeers] = useState(false);

  const isAuthenticated = useRequireAuth("/wallet");

  const loadWallet = useCallback(async () => {
    if (!resolvedUser.email) return;
    const headers = { "x-user-email": resolvedUser.email };
    try {
      const [walletRes, favRes] = await Promise.all([
        fetch("/api/wallet", { headers }).catch(() => null),
        fetch("/api/marketplace/favorites", { headers }).catch(() => null),
      ]);

      if (walletRes?.ok) {
        const w = (await walletRes.json().catch(() => null)) as {
          ok?: boolean;
          tokenBalance?: number;
          heldDeposit?: number;
          activeBorrows?: ActiveBorrowItem[];
          transactions?: RawWalletTx[];
        } | null;
        if (w?.ok) {
          if (typeof w.tokenBalance === "number") {
            setFetchedBalance(w.tokenBalance);
          }
          setHeldDeposit(w.heldDeposit ?? 0);
          setActiveBorrows(Array.isArray(w.activeBorrows) ? w.activeBorrows : []);
          const mapped = Array.isArray(w.transactions) ? w.transactions.map(mapRawTx) : [];
          setTransactions(mapped);
        }
      }

      if (favRes?.ok) {
        const f = (await favRes.json().catch(() => null)) as {
          ok?: boolean;
          favorites?: unknown[];
        } | null;
        if (f?.ok && Array.isArray(f.favorites)) {
          setFavoritesCount(f.favorites.length);
        }
      }
    } finally {
      setIsLoading(false);
    }
  }, [resolvedUser.email]);

  useEffect(() => {
    if (!isAuthenticated || !resolvedUser.email) return;
    void loadWallet();

    const handleLiveRefresh = () => {
      if (typeof document !== "undefined" && document.visibilityState !== "visible") return;
      void loadWallet();
    };
    const interval = setInterval(handleLiveRefresh, 15000);
    window.addEventListener("focus", handleLiveRefresh);
    return () => {
      clearInterval(interval);
      window.removeEventListener("focus", handleLiveRefresh);
    };
  }, [isAuthenticated, resolvedUser.email, loadWallet]);

  useEffect(() => {
    if (!showTransferModal || !resolvedUser.email) return;
    let active = true;
    const timer = setTimeout(async () => {
      if (active) setIsLoadingPeers(true);
      try {
        const res = await fetch(
          `/api/wallet/peers?q=${encodeURIComponent(recipientEmail.trim())}`,
          { headers: { "x-user-email": resolvedUser.email } }
        );
        const data = (await res.json().catch(() => null)) as {
          ok?: boolean;
          peers?: Array<{
            id: string;
            fullName: string;
            initials: string;
            email: string;
            university: string;
            relation: string;
          }>;
        } | null;
        if (active && res.ok && data?.ok && Array.isArray(data.peers)) {
          setPeerSuggestions(data.peers);
        }
      } catch {
        // Ignore transient lookup issues cleanly
      } finally {
        if (active) setIsLoadingPeers(false);
      }
    }, 160);

    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [showTransferModal, recipientEmail, resolvedUser.email]);

  const triggerToast = (msg: string) => {
    setToastMsg(msg);
    setShowToast(true);
    setTimeout(() => setShowToast(false), 2400);
  };

  const handleLogout = (e?: React.MouseEvent) => {
    if (e) e.preventDefault();
    clearClientSession();
    router.push("/login");
  };

  const confirmTransferTokens = async () => {
    if (transferSubmitting) return;
    const cleanEmail = recipientEmail.trim().toLowerCase();
    if (!cleanEmail || !cleanEmail.includes("@")) {
      triggerToast("Enter a valid classmate student email.");
      return;
    }
    const amt = Math.round(Number(transferAmount));
    if (!Number.isFinite(amt) || amt <= 0) {
      triggerToast("Please enter a valid token amount.");
      return;
    }
    if (amt > balance) {
      triggerToast("Insufficient available tokens.");
      return;
    }

    setTransferSubmitting(true);
    try {
      const res = await fetch("/api/wallet/transfer", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-user-email": resolvedUser.email,
        },
        body: JSON.stringify({
          recipientEmail: cleanEmail,
          amount: amt,
          note: transferNote.trim(),
        }),
      });
      const data = (await res.json().catch(() => null)) as {
        ok?: boolean;
        error?: string;
        recipientName?: string;
        tokenBalance?: number;
        user?: ClientUser;
      } | null;
      if (!res.ok || !data?.ok) {
        triggerToast(data?.error || "Could not complete token transfer.");
        return;
      }

      if (data.user) saveClientUser(data.user);
      if (typeof data.tokenBalance === "number") setFetchedBalance(data.tokenBalance);
      setShowTransferModal(false);
      setRecipientEmail("");
      setTransferNote("");
      await loadWallet();
      triggerToast(`Sent ${amt} tokens to ${data.recipientName || cleanEmail}!`);
    } catch {
      triggerToast("Network error while transferring tokens.");
    } finally {
      setTransferSubmitting(false);
    }
  };

  if (!isAuthenticated) {
    return (
      <div className="unishare-wallet" style={{ minHeight: "100vh", background: "#ffffff" }}>
        <AppNavbar activeNav="wallet" />
        <main
          style={{
            maxWidth: "1000px",
            width: "100%",
            margin: "24px auto",
            padding: "0 24px",
          }}
        >
          <div
            style={{
              height: "36px",
              width: "260px",
              borderRadius: "8px",
              background: "#f5f7f6",
              marginBottom: "18px",
            }}
          />
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
              gap: "18px",
            }}
          >
            <div
              style={{
                height: "220px",
                borderRadius: "12px",
                background: "#e9f2ef",
              }}
            />
            <div
              style={{
                height: "220px",
                borderRadius: "12px",
                background: "#f5f7f6",
                border: "1px solid #d5dcda",
              }}
            />
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="unishare-wallet">
      <AppNavbar
        activeNav="wallet"
        user={{ tokenBalance: balance }}
        onLogout={handleLogout}
        onSos={() =>
          triggerToast("Emergency Campus SOS: Campus security contacted.")
        }
      />

      {/* Main Content */}
      <main className="wrap">
        {/* Breadcrumb */}
        <nav className="crumb" aria-label="Breadcrumb">
          <Link href="/home">Home</Link>
          <span>›</span>
          <span className="current">Wallet</span>
        </nav>

        <div className="eyebrow">{resolvedUser.university} · Verified students only</div>

        {/* Top Title & Balance Badge */}
        <div className="top">
          <div>
            <h1>Your campus wallet</h1>
            <p className="sub">A little balance. A lot of possibilities on campus.</p>
          </div>
          <span className="pill">{balance} available tokens</span>
        </div>

        {/* Verified Campus Banner */}
        <div className="banner">
          <WalletIcon name="shield" size={20} />
          <div>
            <b>{resolvedUser.university}</b>
            <p>Your wallet for sharing with verified students on your campus.</p>
          </div>
          <span className="v">
            <WalletIcon name="check" size={14} style={{ marginRight: "4px" }} />
            {resolvedUser.verified ? "Verified student" : "Student member"}
          </span>
        </div>

        {/* Main Grid: Available & Held Cards */}
        <div className="grid">
          {/* Hero Card: Available tokens */}
          <section className="card hero" aria-label="Available tokens">
            <div className="h">
              <span>Available tokens</span>
              <WalletIcon name="wallet" size={20} />
            </div>
            <div className="num">
              {balance}
              <small>tokens</small>
            </div>
            <p>Use for rentals, rides and same-campus transfers.</p>
            <div className="btns">
              <Link
                className="btn btn-light"
                href="/buy-tokens"
              >
                <WalletIcon name="plus" size={16} />
                Buy tokens
              </Link>
              <button
                className="btn btn-line"
                onClick={() => setShowTransferModal(true)}
              >
                <WalletIcon name="up" size={16} />
                Transfer tokens
              </button>
            </div>
          </section>

          {/* Held Deposits Card */}
          <section className="card held" aria-label="Held deposits">
            <div className="h">
              <h2>Held deposits</h2>
              <WalletIcon name="lock" size={20} />
            </div>
            <div className="num">{heldDeposit} tokens</div>
            <p>
              Reserved for your active rental. These tokens are not available to
              spend.
            </p>
            <div className="r">
              <span>
                {activeBorrows.length > 0
                  ? `${activeBorrows[0].listingTitle}${activeBorrows.length > 1 ? ` + ${activeBorrows.length - 1} more` : ""}`
                  : "No active rental"}
              </span>
              <b>{heldDeposit} tokens</b>
            </div>
            <small>
              Released once the return is confirmed and the deposit is cleared.
            </small>
          </section>
        </div>

        {/* Lower Grid: Recent Transactions & Sidebar */}
        <div className="low">
          {/* Recent Transactions List */}
          <section>
            <div className="sec">
              <h2>Recent transactions</h2>
              {transactions.length > 5 && (
                <button
                  type="button"
                  className="lnk"
                  style={{ background: "none", border: 0, cursor: "pointer", padding: 0 }}
                  onClick={() => setShowAllTx((prev) => !prev)}
                >
                  {showAllTx ? "Show less" : `View all (${transactions.length}) →`}
                </button>
              )}
            </div>
            <div className="card list">
              {isLoading ? (
                <div className="tx">
                  <div className="t">
                    <b>Loading campus wallet ledger...</b>
                    <small>Syncing balance and rental escrow from PostgreSQL.</small>
                  </div>
                </div>
              ) : transactions.length === 0 ? (
                <div className="tx">
                  <span className="ic">
                    <WalletIcon name="coin" size={18} />
                  </span>
                  <div className="t">
                    <b>No transactions recorded yet</b>
                    <small>Top up tokens, transfer to a peer, or borrow an item to get started.</small>
                  </div>
                  <div className="a">
                    {balance} tokens
                    <span className="badge">Ready</span>
                  </div>
                </div>
              ) : (
                (showAllTx ? transactions : transactions.slice(0, 6)).map((tx) => (
                  <div key={tx.id} className="tx">
                    <span className="ic">
                      <WalletIcon name={tx.icon} size={18} />
                    </span>
                    <div className="t">
                      <b>{tx.title}</b>
                      <small>{tx.subtitle}</small>
                    </div>
                    <div className="a">
                      {tx.amount}
                      <span className={`badge ${tx.isHeld ? "held" : ""}`}>
                        {tx.badge}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </section>

          {/* Sidebar */}
          <aside className="side">
            {/* Connected Favorites Card */}
            <div className="card promo promo-featured">
              <div className="promo-top">
                <div className="promo-title">
                  <WalletIcon name="heart" size={18} />
                  <span>Favorites Connection</span>
                </div>
                <span className="badge">
                  {favoritesCount} saved {favoritesCount === 1 ? "item" : "items"}
                </span>
              </div>
              <h3>Saved Favorites &amp; Readiness</h3>
              <p>
                Keep track of campus essentials you plan to borrow. Confirm your token balance covers rental rates and security deposits before meeting the owner.
              </p>
              <Link className="lnk" href="/favorites">
                Manage Favorites ({favoritesCount}) →
              </Link>
            </div>

            <div className="card promo">
              <WalletIcon name="hand" size={24} className="big" />
              <h3>Made for campus sharing</h3>
              <p>
                Rental rates, ride fares, deposits and transfers all use tokens.
                Keep your next campus day covered.
              </p>
              <Link className="lnk" href="/marketplace">
                Explore campus items →
              </Link>
            </div>
            <div className="help">
              <WalletIcon name="help" size={20} />
              <div>
                <b>A question about your balance?</b>
                <br />
                <Link href="/help">Get help with your wallet →</Link>
              </div>
            </div>
          </aside>
        </div>
      </main>

      {/* Footer */}
      <footer>
        <div className="ft">
          <span>UniShare. Made for university students in Bangladesh.</span>
          <div>
            <Link href="/privacy">Privacy</Link>
            <Link href="/terms">Terms</Link>
            <Link href="/help">Get help</Link>
            <a href="#" onClick={handleLogout}>
              Log out
            </a>
          </div>
        </div>
      </footer>

      {/* Transfer Tokens Modal */}
      {showTransferModal && (
        <div
          className="modal-backdrop"
          onClick={() => setShowTransferModal(false)}
        >
          <div
            className="modal-card"
            onClick={(e) => e.stopPropagation()}
          >
            <h3>Transfer Tokens</h3>
            <p>Send tokens instantly to another registered student account.</p>
            <label style={{ fontSize: "12px", color: "var(--muted)", display: "block", marginBottom: "4px" }}>
              Recipient student (type name or email)
            </label>
            <input
              type="text"
              className="input-field"
              placeholder="Search classmate name or classmate@university.edu.bd"
              value={recipientEmail}
              onChange={(e) => setRecipientEmail(e.target.value)}
            />
            {(isLoadingPeers || peerSuggestions.length > 0) && (
              <div className="peer-picker-box" aria-label="Verified campus recipients">
                <div className="peer-picker-head">
                  <span>{isLoadingPeers ? "Finding verified students..." : "Verified classmates"}</span>
                </div>
                <div className="peer-picker-list">
                  {peerSuggestions.map((peer) => {
                    const isSelected =
                      recipientEmail.trim().toLowerCase() === peer.email.toLowerCase();
                    return (
                      <button
                        key={peer.id}
                        type="button"
                        className={`peer-picker-item ${isSelected ? "active" : ""}`}
                        onClick={() => setRecipientEmail(peer.email)}
                      >
                        <span className="peer-avatar">{peer.initials}</span>
                        <span className="peer-meta">
                          <strong>{peer.fullName}</strong>
                          <small>{peer.email}</small>
                        </span>
                        <span className="peer-tag">{peer.relation}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
            <label style={{ fontSize: "12px", color: "var(--muted)", display: "block", marginBottom: "4px" }}>
              Amount (tokens)
            </label>
            <input
              type="number"
              className="input-field"
              min="1"
              max={balance}
              value={transferAmount}
              onChange={(e) => setTransferAmount(e.target.value)}
            />
            <label style={{ fontSize: "12px", color: "var(--muted)", display: "block", marginBottom: "4px" }}>
              Note (optional)
            </label>
            <input
              type="text"
              className="input-field"
              placeholder="e.g. Ride split or lab book share"
              maxLength={120}
              value={transferNote}
              onChange={(e) => setTransferNote(e.target.value)}
            />
            <div className="modal-actions">
              <button
                type="button"
                className="btn btn-line"
                style={{
                  color: "var(--ink)",
                  borderColor: "var(--line)",
                  background: "var(--soft)",
                }}
                onClick={() => setShowTransferModal(false)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-light"
                disabled={transferSubmitting}
                style={{
                  background: "var(--teal)",
                  color: "#ffffff",
                  borderColor: "var(--teal)",
                }}
                onClick={confirmTransferTokens}
              >
                {transferSubmitting ? "Sending..." : "Send Tokens"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Animated Toast */}
      <div
        className={`toast ${showToast ? "on" : ""}`}
        role="status"
        aria-live="polite"
      >
        {toastMsg}
      </div>
    </div>
  );
}

