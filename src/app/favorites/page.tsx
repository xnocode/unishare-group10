"use client";

import React, { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { DEFAULT_ITEMS, MarketplaceItem, UserProfile } from "../marketplace/marketplace-data";
import AppNavbar from "../components/AppNavbar";
import "../marketplace/marketplace.css";
import "./favorites.css";

export default function FavoritesPage() {
  const router = useRouter();

  // Authentication & User State
  const [user, setUser] = useState<UserProfile | null>(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [walletBalance, setWalletBalance] = useState(500);

  // Favorites & Items State
  const [favorites, setFavorites] = useState<Record<string, boolean>>({});
  const [items, setItems] = useState<MarketplaceItem[]>(DEFAULT_ITEMS);

  // Feedback State
  const [toastMessage, setToastMessage] = useState("");
  const [toastVisible, setToastVisible] = useState(false);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setToastVisible(true);
    setTimeout(() => {
      setToastVisible(false);
    }, 2400);
  };

  // Client Mount: Load Auth, Wallet & Favorites
  useEffect(() => {
    try {
      const storedUser = localStorage.getItem("unishare_user");
      const isLoggedIn =
        localStorage.getItem("unishare_logged_in") === "true" ||
        document.cookie.includes("unishare_logged_in=true") ||
        document.cookie.includes("unishare_token=");

      if (storedUser) {
        const parsed = JSON.parse(storedUser) as UserProfile;
        setUser(parsed);
        if (parsed.tokenBalance !== undefined) {
          setWalletBalance(parsed.tokenBalance);
        }
      } else if (isLoggedIn) {
        const fallback: UserProfile = {
          name: "Farhana Rahman",
          email: "farhana@std.du.ac.bd",
          initials: "FR",
          university: "University of Dhaka",
          verified: true,
          department: "Computer Science & Engineering",
          tokenBalance: 500,
        };
        setUser(fallback);
        setWalletBalance(500);
        localStorage.setItem("unishare_user", JSON.stringify(fallback));
      }

      // Load custom items
      const customItems = localStorage.getItem("unishare_marketplace_items");
      if (customItems) {
        setItems(JSON.parse(customItems));
      }

      // Load favorites
      const storedFavs = localStorage.getItem("unishare_favorites");
      if (storedFavs) {
        const parsedFavs = JSON.parse(storedFavs);
        setFavorites(parsedFavs);
      } else {
        // Initial friendly default
        const defaultFavs: Record<string, boolean> = {
          "Scientific calculator": true,
          "Match-day football": true,
        };
        setFavorites(defaultFavs);
        localStorage.setItem("unishare_favorites", JSON.stringify(defaultFavs));
      }
    } catch (e) {
      console.error(e);
    } finally {
      setAuthChecked(true);
    }
  }, []);

  // Filtered favorite items list
  const favoriteItems = useMemo(() => {
    return items.filter((item) => !!favorites[item.name]);
  }, [items, favorites]);

  // Total tokens required to borrow all active favorites
  const totalTokensNeeded = useMemo(() => {
    return favoriteItems.reduce((acc, curr) => acc + curr.price + curr.deposit, 0);
  }, [favoriteItems]);

  // Remove item from favorites
  const handleRemoveFavorite = (itemName: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    const updated = { ...favorites, [itemName]: false };
    setFavorites(updated);
    try {
      localStorage.setItem("unishare_favorites", JSON.stringify(updated));
    } catch (err) {
      console.error(err);
    }
    showToast(`Removed "${itemName}" from Favorites`);
  };

  // Demo Login Helper
  const handleDemoLogin = () => {
    const demoProfile: UserProfile = {
      name: "Farhana Rahman",
      email: "farhana@std.du.ac.bd",
      initials: "FR",
      university: "University of Dhaka",
      verified: true,
      department: "Computer Science & Engineering",
      tokenBalance: 500,
    };
    setUser(demoProfile);
    setWalletBalance(500);
    localStorage.setItem("unishare_logged_in", "true");
    localStorage.setItem("unishare_user", JSON.stringify(demoProfile));
    document.cookie = "unishare_logged_in=true; path=/; max-age=86400";
    document.cookie = `unishare_token=demo_token_${Date.now()}; path=/; max-age=604800; SameSite=Lax`;
    showToast("Signed in as Farhana Rahman (DU Verified)");
  };

  // Logout Handler
  const handleLogout = () => {
    localStorage.removeItem("unishare_logged_in");
    localStorage.removeItem("unishare_user");
    document.cookie = "unishare_logged_in=; path=/; max-age=0";
    document.cookie = "unishare_token=; path=/; max-age=0; SameSite=Lax";
    setUser(null);
    showToast("Logged out of UniShare.");
    setTimeout(() => {
      router.push("/login");
    }, 400);
  };

  // Unauthenticated Guard
  if (authChecked && !user) {
    return (
      <div className="unishare-marketplace">
        <AppNavbar mode="guest" redirectPath="/favorites" />

        <main className="wrap" style={{ minHeight: "65vh", display: "grid", placeItems: "center", textAlign: "center", padding: "60px 20px" }}>
          <div style={{ maxWidth: 460, background: "#ffffff", border: "1.5px solid var(--line)", borderRadius: 14, padding: 36, boxShadow: "0 4px 14px rgba(18, 32, 31, 0.08)" }}>
            <div style={{ width: 48, height: 48, borderRadius: "50%", background: "var(--tint)", color: "var(--brand)", display: "grid", placeItems: "center", margin: "0 auto 16px auto" }}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 20s-7-4.4-7-10a4.2 4.2 0 0 1 7-3 4.2 4.2 0 0 1 7 3c0 5.6-7 10-7 10z" />
              </svg>
            </div>
            <h2 style={{ fontFamily: "var(--font-bricolage, serif)", fontSize: 24, fontWeight: 800, marginBottom: 8 }}>
              Login to View Favorites
            </h2>
            <p style={{ color: "var(--muted)", fontSize: 14, lineHeight: 1.6, marginBottom: 24 }}>
              Your saved campus essentials and wallet readiness are accessible after signing in with your University of Dhaka account.
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <Link
                href="/login?redirect=/favorites"
                className="btn"
                style={{ width: "100%", height: 46 }}
              >
                Log in with university email
              </Link>
              <button
                type="button"
                className="btn outline"
                onClick={handleDemoLogin}
                style={{ width: "100%", height: 46 }}
              >
                Instant Access as Farhana Rahman (Demo)
              </button>
            </div>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="unishare-favorites-page unishare-marketplace">
      <AppNavbar
        activeNav="favorites"
        user={{ ...user, tokenBalance: walletBalance }}
        onLogout={handleLogout}
        onSos={() => showToast("DU Campus Safety Hotline: 01700-000000 · Proctor Office")}
      />

      {/* Main Content Area */}
      <main className="wrap">
        {/* Breadcrumb Navigation */}
        <nav className="crumb" aria-label="Breadcrumb" style={{ marginTop: 14 }}>
          <Link href="/home">Home</Link>
          <span style={{ margin: "0 4px" }}>›</span>
          <Link href="/marketplace">Marketplace</Link>
          <span style={{ margin: "0 4px" }}>›</span>
          <span style={{ color: "var(--ink)" }}>Favorites</span>
        </nav>

        {/* Eyebrow */}
        <div className="eyebrow" style={{ marginTop: 14 }}>
          University of Dhaka · Verified students only
        </div>

        {/* Back Link */}
        <div style={{ marginTop: 12 }}>
          <Link href="/marketplace" className="fav-back-link">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M19 12H5M12 19l-7-7 7-7" />
            </svg>
            <span>Back to Marketplace</span>
          </Link>
        </div>

        {/* Title Header */}
        <div className="fav-header-area">
          <div>
            <h1 className="fav-title">Your Saved Favorites</h1>
            <p className="fav-subtitle">
              Bookmarked campus essentials you plan to borrow. Review rental rates, check pickup locations, and confirm token readiness with your wallet.
            </p>
          </div>
          <span className="pill" style={{ height: "fit-content", padding: "8px 16px" }}>
            {favoriteItems.length} {favoriteItems.length === 1 ? "saved item" : "saved items"}
          </span>
        </div>

        {/* Direct Wallet Connection Banner */}
        <section className="fav-wallet-card" aria-label="Wallet Integration">
          <div className="fav-wallet-left">
            <div className="fav-wallet-icon-box">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="3" y="6" width="18" height="14" rx="3" />
                <path d="M3 10h18M16 14h2" />
              </svg>
            </div>
            <div>
              <div className="fav-wallet-title-row">
                <h3>Campus Token Wallet Connection</h3>
                {walletBalance >= (favoriteItems[0] ? favoriteItems[0].price + favoriteItems[0].deposit : 0) ? (
                  <span className="fav-wallet-status-tag">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                      <path d="M20 6L9 17l-5-5" />
                    </svg>
                    Wallet Ready to Borrow
                  </span>
                ) : (
                  <span className="fav-wallet-status-tag" style={{ background: "#fef3c7", color: "#92400e" }}>
                    Top-up Recommended
                  </span>
                )}
              </div>
              <p className="fav-wallet-desc">
                Available balance: <strong>{walletBalance} tokens</strong> · Total required to borrow your favorites: <strong>{totalTokensNeeded} tokens</strong> (including refundable deposits).
              </p>
            </div>
          </div>

          <div className="fav-wallet-actions">
            <Link href="/wallet" className="fav-wallet-btn">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="3" y="6" width="18" height="14" rx="3" />
                <path d="M3 10h18M16 14h2" />
              </svg>
              <span>Manage Wallet</span>
            </Link>
            <Link href="/buy-tokens" className="fav-wallet-btn outline">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                <path d="M12 5v14M5 12h14" />
              </svg>
              <span>Buy Tokens</span>
            </Link>
          </div>
        </section>

        {/* Favorites Grid or Empty State */}
        {favoriteItems.length > 0 ? (
          <div className="fav-grid">
            {favoriteItems.map((item) => {
              const itemTotal = item.price + item.deposit;
              const hasEnough = walletBalance >= itemTotal;

              return (
                <article key={item.id} className="fav-card">
                  {/* Photo with Remove Button */}
                  <div
                    className="fav-card-img-wrap"
                    onClick={() => router.push(`/product-details/${item.id}`)}
                  >
                    <Image
                      src={item.image}
                      alt={item.name}
                      fill
                      sizes="(max-width: 600px) 100vw, (max-width: 900px) 50vw, 360px"
                      style={{ objectFit: "cover" }}
                    />
                    <span className="avail-pill">Available today</span>
                    <button
                      type="button"
                      className="fav-remove-btn"
                      onClick={(e) => handleRemoveFavorite(item.name, e)}
                      aria-label={`Remove ${item.name} from favorites`}
                      title="Remove from favorites"
                    >
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" strokeWidth="1.5">
                        <path d="M12 20s-7-4.4-7-10a4.2 4.2 0 0 1 7-3 4.2 4.2 0 0 1 7 3c0 5.6-7 10-7 10z" />
                      </svg>
                    </button>
                  </div>

                  {/* Body Content */}
                  <div className="fav-card-body">
                    <span className="fav-card-cat">{item.category}</span>
                    <h3
                      className="fav-card-title"
                      onClick={() => router.push(`/product-details/${item.id}`)}
                    >
                      {item.name}
                    </h3>

                    <div className="fav-card-price-row">
                      <b>{item.price}</b>
                      <span>tokens / day</span>
                    </div>

                    <div className="fav-card-deposit">
                      {item.deposit} tokens refundable deposit
                    </div>

                    {/* Wallet Coverage Indicator */}
                    <div className="fav-card-wallet-badge">
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                        <path d="M20 6L9 17l-5-5" />
                      </svg>
                      <span>
                        {hasEnough
                          ? `Wallet covered (${itemTotal} tokens)`
                          : `Need ${itemTotal - walletBalance} more tokens`}
                      </span>
                    </div>

                    {/* Owner Information */}
                    <div className="fav-card-owner-row">
                      <div className="fav-card-owner-avatar">{item.initials}</div>
                      <div>
                        <div className="fav-card-owner-name">{item.owner}</div>
                        <div className="fav-card-owner-loc">Pickup at {item.area}</div>
                      </div>
                    </div>

                    {/* Action Button */}
                    <Link
                      href={`/product-details/${item.id}`}
                      className="fav-card-btn"
                    >
                      <span>Borrow Item</span>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                        <path d="M5 12h14M12 5l7 7-7 7" />
                      </svg>
                    </Link>
                  </div>
                </article>
              );
            })}
          </div>
        ) : (
          <div className="fav-empty-card">
            <div className="fav-empty-icon">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 20s-7-4.4-7-10a4.2 4.2 0 0 1 7-3 4.2 4.2 0 0 1 7 3c0 5.6-7 10-7 10z" />
              </svg>
            </div>
            <h3 className="fav-empty-title">No favorites saved yet</h3>
            <p className="fav-empty-sub">
              Tap the heart icon on any product in the marketplace to bookmark it here. You can easily keep track of items you need for exams, projects, or weekends.
            </p>
            <div className="fav-empty-actions">
              <Link href="/marketplace" className="btn" style={{ height: 44, padding: "0 22px" }}>
                Explore Marketplace
              </Link>
              <Link href="/wallet" className="btn outline" style={{ height: 44, padding: "0 22px" }}>
                Check Wallet Balance
              </Link>
            </div>
          </div>
        )}

        {/* Sharing Safety Notice */}
        <div className="fav-safety-box">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M12 3l8 3v6c0 4.5-3.4 8-8 9-4.6-1-8-4.5-8-9V6l8-3z" />
            <path d="M9 12l2 2 4-4" />
          </svg>
          <span>
            <strong>Public Campus Spots & Deposit Protection:</strong> Always meet the item owner in a public DU location (e.g. Science Library, TSC, or Curzon Hall). Your token deposit stays securely held until the item is returned in agreed condition.
          </span>
        </div>
      </main>

      {/* Footer */}
      <footer>
        <div className="wrap">
          <span>UniShare. Made for university students in Bangladesh.</span>
          <span>
            <Link href="#privacy" style={{ marginLeft: 0 }}>Privacy</Link>
            <Link href="#terms">Terms</Link>
            <Link href="#help">Get help</Link>
            <button
              type="button"
              onClick={handleLogout}
              style={{ background: "none", border: "none", color: "var(--brand)", cursor: "pointer", font: "inherit", marginLeft: 16 }}
            >
              Log out
            </button>
          </span>
        </div>
      </footer>

      {/* Floating Toast Alert */}
      <div className={`toast ${toastVisible ? "on" : ""}`} role="status" aria-live="polite">
        {toastMessage}
      </div>
    </div>
  );
}

