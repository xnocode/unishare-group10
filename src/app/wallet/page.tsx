"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
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

const INITIAL_TRANSACTIONS: Transaction[] = [
  {
    id: "tx-1",
    icon: "calc",
    title: "Scientific calculator rental",
    subtitle: "14 Oct 2026 · 2 days · Nafis Ahmed",
    amount: "−80 tokens",
    badge: "Completed",
  },
  {
    id: "tx-2",
    icon: "lock",
    title: "Rental security deposit",
    subtitle: "14 Oct 2026 · Scientific calculator",
    amount: "100 tokens held",
    badge: "Held",
    isHeld: true,
  },
  {
    id: "tx-3",
    icon: "coin",
    title: "Tokens purchased",
    subtitle: "12 Oct 2026 · Payment reviewed and approved",
    amount: "+250 tokens",
    badge: "Completed",
  },
  {
    id: "tx-4",
    icon: "car",
    title: "Shared ride to TSC",
    subtitle: "11 Oct 2026 · Dhanmondi 27 → TSC, DU",
    amount: "−80 tokens",
    badge: "Completed",
  },
];

export default function WalletPage() {
  const router = useRouter();
  const [balance, setBalance] = useState(500);
  const [heldDeposit, setHeldDeposit] = useState(100);
  const [transactions, setTransactions] = useState<Transaction[]>(INITIAL_TRANSACTIONS);
  const [toastMsg, setToastMsg] = useState("");
  const [showToast, setShowToast] = useState(false);

  // Modals
  const [showBuyModal, setShowBuyModal] = useState(false);
  const [selectedPack, setSelectedPack] = useState(250);
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [transferRecipient, setTransferRecipient] = useState("Nafis Ahmed (Calculators)");
  const [transferAmount, setTransferAmount] = useState("50");

  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    try {
      const loggedIn = localStorage.getItem("unishare_logged_in") === "true";
      if (!loggedIn) {
        // Not logged in -> redirect to login first!
        router.replace("/login?redirect=/wallet");
      } else {
        setIsAuthenticated(true);
      }
    } catch (e) {
      console.error(e);
      router.replace("/login?redirect=/wallet");
    }
  }, [router]);

  const triggerToast = (msg: string) => {
    setToastMsg(msg);
    setShowToast(true);
    setTimeout(() => setShowToast(false), 2000);
  };

  const handleLogout = (e: React.MouseEvent) => {
    e.preventDefault();
    try {
      localStorage.removeItem("unishare_logged_in");
      localStorage.removeItem("unishare_user");
      document.cookie = "unishare_logged_in=; path=/; max-age=0";
    } catch (err) {
      console.error(err);
    }
    router.push("/login");
  };

  const confirmBuyTokens = () => {
    setBalance((prev) => prev + selectedPack);
    const newTx: Transaction = {
      id: `tx-${Date.now()}`,
      icon: "coin",
      title: "Tokens purchased",
      subtitle: "Just now · Payment confirmed via bKash/Nagad",
      amount: `+${selectedPack} tokens`,
      badge: "Completed",
    };
    setTransactions((prev) => [newTx, ...prev]);
    setShowBuyModal(false);
    triggerToast(`Successfully purchased ${selectedPack} tokens!`);
  };

  const confirmTransferTokens = () => {
    const amt = parseInt(transferAmount, 10);
    if (isNaN(amt) || amt <= 0) {
      triggerToast("Please enter a valid token amount.");
      return;
    }
    if (amt > balance) {
      triggerToast("Insufficient available tokens.");
      return;
    }
    setBalance((prev) => prev - amt);
    const newTx: Transaction = {
      id: `tx-${Date.now()}`,
      icon: "hand",
      title: `Transfer to ${transferRecipient}`,
      subtitle: "Just now · Instant campus peer transfer",
      amount: `−${amt} tokens`,
      badge: "Completed",
    };
    setTransactions((prev) => [newTx, ...prev]);
    setShowTransferModal(false);
    triggerToast(`Sent ${amt} tokens to ${transferRecipient}!`);
  };

  if (!isAuthenticated) {
    return (
      <div
        style={{
          minHeight: "100vh",
          display: "grid",
          placeItems: "center",
          background: "#ffffff",
          fontFamily: "system-ui, sans-serif",
        }}
      >
        <p style={{ color: "#0d5c5a", fontWeight: 600 }}>Checking campus authentication...</p>
      </div>
    );
  }

  return (
    <div className="unishare-wallet">
      {/* Header */}
      <header>
        <div className="hd">
          <Link className="brand" href="/home">
            <WalletIcon name="link" size={24} />
            UniShare
          </Link>
          <nav aria-label="Main">
            <Link href="/home">Home</Link>
            <Link href="/marketplace">Marketplace</Link>
            <Link href="/marketplace">My products</Link>
            <Link href="/home#rentals">My rentals</Link>
            <Link href="/home#rides">Rides</Link>
            <Link className="on" href="/wallet" aria-current="page">
              Wallet
            </Link>
            <Link href="#">Favorites</Link>
          </nav>
          <div className="right">
            <Link
              className="bell"
              aria-label="Notifications"
              href="/notifications"
            >
              <WalletIcon name="bell" size={20} />
              <i />
            </Link>
            <a
              className="sos"
              href="#"
              onClick={(e) => {
                e.preventDefault();
                triggerToast("Emergency Campus SOS: Campus security contacted.");
              }}
            >
              <WalletIcon name="shield" size={18} />
              SOS
            </a>
            <div className="me" onClick={handleLogout} title="Click to log out">
              <span className="av">FR</span>
              <div>
                <b>Farhana Rahman</b>
                <small>My profile</small>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="wrap">
        {/* Breadcrumb */}
        <div className="crumb">
          <Link href="/home">Home</Link>
          <span>›</span>
          <span>Wallet</span>
        </div>

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
          <WalletIcon name="shield" size={22} />
          <div>
            <b>University of Dhaka</b> &nbsp;Your wallet for sharing with verified
            students on your campus.
          </div>
          <span className="v">
            <WalletIcon name="check" size={14} style={{ marginRight: "4px" }} />
            Verified student
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
              <span>Scientific calculator</span>
              <b>100 tokens</b>
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
              <a
                className="lnk"
                href="#"
                onClick={(e) => {
                  e.preventDefault();
                  triggerToast("Showing full transaction history");
                }}
              >
                View history →
              </a>
            </div>
            <div className="card list">
              {transactions.map((tx) => (
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
              ))}
            </div>
          </section>

          {/* Sidebar */}
          <aside className="side">
            <div className="card promo">
              <WalletIcon name="hand" size={24} className="big" />
              <h3>Made for campus sharing</h3>
              <p>
                Rental rates, ride fares, deposits and transfers all use tokens.
                Keep your next campus day covered.
              </p>
              <Link className="lnk" href="/home#marketplace">
                Explore campus items →
              </Link>
            </div>
            <div className="help">
              <WalletIcon name="help" size={20} />
              <div>
                <b>A question about your balance?</b>
                <br />
                <a
                  href="#"
                  onClick={(e) => {
                    e.preventDefault();
                    triggerToast("Contacting campus wallet support team...");
                  }}
                >
                  Get help with your wallet →
                </a>
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
            <Link href="#">Privacy</Link>
            <Link href="#">Terms</Link>
            <Link href="#">Get help</Link>
            <a href="#" onClick={handleLogout}>
              Log out
            </a>
          </div>
        </div>
      </footer>

      {/* Buy Tokens Modal */}
      {showBuyModal && (
        <div
          className="modal-backdrop"
          onClick={() => setShowBuyModal(false)}
        >
          <div
            className="modal-card"
            onClick={(e) => e.stopPropagation()}
          >
            <h3>Buy Campus Tokens</h3>
            <p>
              Select a token pack to instantly top up your student sharing
              balance.
            </p>
            <div className="modal-options">
              {[100, 250, 500].map((pack) => (
                <div
                  key={pack}
                  className={`opt-btn ${selectedPack === pack ? "active" : ""}`}
                  onClick={() => setSelectedPack(pack)}
                >
                  <b>+{pack}</b>
                  <small>৳{pack}</small>
                </div>
              ))}
            </div>
            <div className="modal-actions">
              <button
                className="btn btn-line"
                style={{
                  color: "var(--ink)",
                  borderColor: "var(--line)",
                  background: "var(--soft)",
                }}
                onClick={() => setShowBuyModal(false)}
              >
                Cancel
              </button>
              <button
                className="btn btn-light"
                style={{
                  background: "var(--teal)",
                  color: "#ffffff",
                  borderColor: "var(--teal)",
                }}
                onClick={confirmBuyTokens}
              >
                Top up ৳{selectedPack}
              </button>
            </div>
          </div>
        </div>
      )}

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
            <p>Transfer tokens to another verified University of Dhaka student.</p>
            <label style={{ fontSize: "12px", color: "var(--muted)", display: "block", marginBottom: "4px" }}>
              Recipient
            </label>
            <select
              className="input-field"
              value={transferRecipient}
              onChange={(e) => setTransferRecipient(e.target.value)}
            >
              <option value="Nafis Ahmed (Calculators)">Nafis Ahmed (Calculators)</option>
              <option value="Arif Hossain (Rides)">Arif Hossain (Rides)</option>
              <option value="Sakib Hasan (Footballs)">Sakib Hasan (Footballs)</option>
              <option value="Maliha Islam (Laptop chargers)">Maliha Islam (Laptop chargers)</option>
            </select>
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
            <div className="modal-actions">
              <button
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
                className="btn btn-light"
                style={{
                  background: "var(--teal)",
                  color: "#ffffff",
                  borderColor: "var(--teal)",
                }}
                onClick={confirmTransferTokens}
              >
                Send Tokens
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

