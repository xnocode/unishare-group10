"use client";

import React, { useState, useEffect, useMemo, useSyncExternalStore } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';

const emptySubscribe = () => () => {};
function useInitialDaysParam(): number {
  return useSyncExternalStore(
    emptySubscribe,
    () => {
      const raw = new URLSearchParams(window.location.search).get('days');
      const parsed = raw ? Number(raw) : NaN;
      return Number.isFinite(parsed) && parsed >= 1 ? Math.min(30, Math.round(parsed)) : 1;
    },
    () => 1
  );
}
import { DEFAULT_ITEMS, MarketplaceItem } from '../marketplace/marketplace-data';
import AppNavbar from '../components/AppNavbar';
import {
  clearClientSession,
  DEMO_USER,
  getUserScopedKey,
  saveClientUser,
  useCurrentUser,
  useIsHydrated,
  useLocalStorageRaw,
  writeUserScopedJson,
} from '../lib/user-client';
import '../marketplace/marketplace.css';
import './product-details.css';

interface ProductDetailViewProps {
  productId?: string;
}

export default function ProductDetailView({ productId }: ProductDetailViewProps) {
  const router = useRouter();

  // Authentication State
  const { user, resolvedUser, isDemoUser } = useCurrentUser();
  const authChecked = useIsHydrated();

  // Product & Interaction State
  const initialDaysFromQuery = useInitialDaysParam();
  const [customRentalDays, setCustomRentalDays] = useState<number | null>(null);
  const rentalDays = customRentalDays ?? initialDaysFromQuery;
  const [borrowRequested, setBorrowRequested] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [toastVisible, setToastVisible] = useState(false);
  const [remoteItem, setRemoteItem] = useState<MarketplaceItem | null>(null);

  useEffect(() => {
    if (!productId) return;
    let active = true;
    fetch(`/api/marketplace/${encodeURIComponent(productId)}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data: { ok?: boolean; marketItem?: MarketplaceItem } | null) => {
        if (active && data?.ok && data.marketItem) {
          setRemoteItem(data.marketItem);
        }
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [productId]);

  const favoritesKey = getUserScopedKey(
    'unishare_favorites',
    resolvedUser.email,
    isDemoUser
  );
  const recentKey = getUserScopedKey(
    'unishare_recently_viewed',
    resolvedUser.email,
    isDemoUser
  );
  const walletKey = getUserScopedKey(
    'unishare_wallet',
    resolvedUser.email,
    isDemoUser
  );

  const rawFavsJson = useLocalStorageRaw(favoritesKey);
  const rawWalletJson = useLocalStorageRaw(walletKey);
  const rawCustomItemsJson = useLocalStorageRaw('unishare_marketplace_items');
  const myProductsKey = getUserScopedKey(
    'unishare_my_products',
    resolvedUser.email,
    isDemoUser
  );
  const rawMyProductsJson = useLocalStorageRaw(myProductsKey);

  const favorites: Record<string, boolean> = useMemo(() => {
    if (!rawFavsJson) return {};
    try {
      return JSON.parse(rawFavsJson) as Record<string, boolean>;
    } catch {
      return {};
    }
  }, [rawFavsJson]);

  const walletBalance = useMemo(() => {
    if (rawWalletJson) {
      try {
        const parsed = JSON.parse(rawWalletJson) as { balance?: number };
        if (parsed.balance !== undefined) return parsed.balance;
      } catch {}
    }
    return resolvedUser.tokenBalance;
  }, [rawWalletJson, resolvedUser.tokenBalance]);

  // Determine the active item
  const item: MarketplaceItem = useMemo(() => {
    let targetId = productId;
    if (!targetId && typeof window !== 'undefined') {
      const q = new URLSearchParams(window.location.search).get('id');
      if (q) targetId = q;
    }

    if (rawCustomItemsJson) {
      try {
        const parsed = JSON.parse(rawCustomItemsJson) as MarketplaceItem[];
        const match = parsed.find(
          (it) => it.id === targetId || it.name.toLowerCase().replace(/[^a-z0-9]/g, '-').includes((targetId || '').toLowerCase())
        );
        if (match) return match;
      } catch (err) {
        console.error(err);
      }
    }

    if (targetId) {
      if (rawMyProductsJson) {
        try {
          const mine = JSON.parse(rawMyProductsJson) as Array<{
            id: string;
            name: string;
            category: string;
            condition?: string;
            rate: number;
            deposit: number;
            area?: string;
            maxRentalDays?: number;
            description?: string;
            image: string;
            state?: string;
            note?: string;
          }>;
          const ownMatch = mine.find((it) => it.id === targetId);
          if (ownMatch) {
            return {
              id: ownMatch.id,
              name: ownMatch.name,
              category: ownMatch.category,
              price: ownMatch.rate,
              deposit: ownMatch.deposit,
              area: ownMatch.area || 'TSC',
              owner: resolvedUser.name,
              ownerEmail: resolvedUser.email,
              initials: resolvedUser.initials,
              image: ownMatch.image,
              available: ownMatch.state !== 'paused',
              condition: ownMatch.condition,
              maxRentalDays: ownMatch.maxRentalDays,
              description: ownMatch.description || ownMatch.note || `Listed by ${resolvedUser.name}.`,
            };
          }
        } catch {}
      }

      const direct = DEFAULT_ITEMS.find((it) => it.id === targetId);
      if (direct) return direct;

      if (remoteItem && remoteItem.id === targetId) return remoteItem;

      const slugMatch = DEFAULT_ITEMS.find((it) =>
        it.name.toLowerCase().replace(/[^a-z0-9]/g, '-').includes((targetId || '').toLowerCase())
      );
      if (slugMatch) return slugMatch;
    }

    return remoteItem || DEFAULT_ITEMS[0];
  }, [productId, remoteItem, rawCustomItemsJson, rawMyProductsJson, resolvedUser.email, resolvedUser.initials, resolvedUser.name]);

  // Record item in recently viewed
  useEffect(() => {
    if (item && typeof window !== 'undefined') {
      try {
        const storedRecent = localStorage.getItem(recentKey);
        const list: string[] = storedRecent ? JSON.parse(storedRecent) : [];
        const updated = [item.name, ...list.filter((n) => n !== item.name)].slice(0, 10);
        localStorage.setItem(recentKey, JSON.stringify(updated));
      } catch (e) {
        console.error(e);
      }
    }
  }, [item, recentKey]);

  // Toast Helper
  const showToast = (msg: string) => {
    setToastMessage(msg);
    setToastVisible(true);
    setTimeout(() => {
      setToastVisible(false);
    }, 2500);
  };

  // Toggle Favorite
  const handleToggleFavorite = () => {
    const updated = { ...favorites, [item.name]: !favorites[item.name] };
    writeUserScopedJson(favoritesKey, updated);
    showToast(updated[item.name] ? `Added "${item.name}" to Favorites` : `Removed from Favorites`);
  };

  // Borrow Request Handler
  const handleBorrowRequest = () => {
    setBorrowRequested(true);
    showToast(`Request sent to ${item.owner}! Meet at ${item.area}.`);
  };

  // Demo Login Helper
  const handleDemoLogin = () => {
    saveClientUser(DEMO_USER);
    document.cookie = 'unishare_logged_in=true; path=/; max-age=86400';
    document.cookie = `unishare_token=demo_token_${Date.now()}; path=/; max-age=604800; SameSite=Lax`;
    showToast('Signed in as Farhana Rahman (DU Verified)');
  };

  // Logout Handler
  const handleLogout = () => {
    clearClientSession();
    showToast('Logged out of UniShare.');
    setTimeout(() => {
      router.push('/login');
    }, 400);
  };

  // Calculation
  const rentalFee = rentalDays * item.price;
  const totalTokens = rentalFee + item.deposit;

  // Unauthenticated Guard
  if (authChecked && !user) {
    return (
      <div className="unishare-marketplace">
        <AppNavbar mode="guest" redirectPath="/marketplace" />

        <main className="wrap" style={{ minHeight: '65vh', display: 'grid', placeItems: 'center', textAlign: 'center', padding: '60px 20px' }}>
          <div style={{ maxWidth: 460, background: '#ffffff', border: '1.5px solid var(--line)', borderRadius: 14, padding: 36, boxShadow: '0 4px 14px rgba(18, 32, 31, 0.08)' }}>
            <div style={{ width: 48, height: 48, borderRadius: '50%', background: 'var(--tint)', color: 'var(--brand)', display: 'grid', placeItems: 'center', margin: '0 auto 16px auto' }}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                <path d="M7 11V7a5 5 0 0 1 10 0v4" />
              </svg>
            </div>
            <h2 style={{ fontFamily: 'var(--font-bricolage, serif)', fontSize: 24, fontWeight: 800, marginBottom: 8 }}>
              University Email Required
            </h2>
            <p style={{ color: 'var(--muted)', fontSize: 14, lineHeight: 1.6, marginBottom: 24 }}>
              The UniShare shelf is exclusive to verified students of the University of Dhaka. Please log in with your university credentials to view product details.
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <Link
                href="/login?redirect=/marketplace"
                className="btn"
                style={{ width: '100%', height: 46 }}
              >
                Log in with university email
              </Link>
              <button
                type="button"
                className="btn outline"
                onClick={handleDemoLogin}
                style={{ width: '100%', height: 46 }}
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
    <div className="product-detail-page">
      <AppNavbar
        activeNav="marketplace"
        user={{ tokenBalance: walletBalance }}
        onLogout={handleLogout}
        onSos={() => showToast(`Emergency Campus SOS: ${resolvedUser.university} Proctorial Team contacted.`)}
      />

      {/* Main Container */}
      <main className="wrap">
        {/* Breadcrumb Navigation */}
        <nav className="crumb" aria-label="Breadcrumb">
          <Link href="/home">Home</Link>
          <span>›</span>
          <Link href="/marketplace">Marketplace</Link>
          <span>›</span>
          <span className="current">{item.name}</span>
        </nav>

        {/* Eyebrow */}
        <div className="eyebrow">
          {resolvedUser.university} · Verified students only
        </div>

        {/* Product Details 2-Column Layout */}
        <div className="pd-layout-grid">
          {/* Column 1: Product Showcase & Detailed Info */}
          <section className="pd-showcase-card">
            {/* Product Image */}
            <div className="pd-image-container">
              <Image
                src={item.image}
                alt={item.name}
                fill
                sizes="(max-width: 900px) 100vw, 650px"
                style={{ objectFit: 'cover' }}
                unoptimized={item.image.startsWith('data:')}
                priority
              />
              <span className="pd-badge-avail">
                {item.available === false ? 'Paused' : 'Available today'}
              </span>
            </div>

            {/* Category Tag & Product Title */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap', marginBottom: 8 }}>
              <span className="pd-category-tag" style={{ marginBottom: 0 }}>{item.category}</span>
              {(item.ownerEmail === resolvedUser.email || item.owner === resolvedUser.name) && (
                <Link
                  href="/my-products"
                  style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--brand)', textDecoration: 'underline' }}
                >
                  Your listing · Manage in My Products →
                </Link>
              )}
            </div>
            <h1 className="pd-title">{item.name}</h1>
            <p className="pd-desc">{item.description}</p>

            {/* Nicely Placed Feature Specs Grid */}
            <div className="pd-specs-grid">
              <div className="pd-spec-box">
                <div className="pd-spec-icon">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M12 21s6-5.6 6-10.5A6 6 0 0 0 6 10.5C6 15.4 12 21 12 21z" />
                    <circle cx="12" cy="10.5" r="2.2" />
                  </svg>
                </div>
                <div className="pd-spec-meta">
                  <span className="pd-spec-label">Pickup Location</span>
                  <span className="pd-spec-val">{item.area}</span>
                </div>
              </div>

              <div className="pd-spec-box">
                <div className="pd-spec-icon">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="12" cy="12" r="10" />
                    <polyline points="12 6 12 12 16 14" />
                  </svg>
                </div>
                <div className="pd-spec-meta">
                  <span className="pd-spec-label">Availability</span>
                  <span className="pd-spec-val">Available today · Active</span>
                </div>
              </div>

              <div className="pd-spec-box">
                <div className="pd-spec-icon">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M12 3l8 4.5v9L12 21l-8-4.5v-9L12 3z" />
                    <path d="M4 7.5l8 4.5 8-4.5M12 12v9" />
                  </svg>
                </div>
                <div className="pd-spec-meta">
                  <span className="pd-spec-label">Refundable Deposit</span>
                  <span className="pd-spec-val">{item.deposit} tokens (100% back)</span>
                </div>
              </div>

              <div className="pd-spec-box">
                <div className="pd-spec-icon">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M12 3l8 3v6c0 4.5-3.4 8-8 9-4.6-1-8-4.5-8-9V6l8-3z" />
                    <path d="M9 12l2 2 4-4" />
                  </svg>
                </div>
                <div className="pd-spec-meta">
                  <span className="pd-spec-label">Verification</span>
                  <span className="pd-spec-val">Student Verified Only</span>
                </div>
              </div>
            </div>

            {/* Owner Profile Card */}
            <div className="pd-owner-card">
              <div className="pd-owner-left">
                <div className="pd-owner-avatar">{item.initials}</div>
                <div>
                  <div className="pd-owner-name">{item.owner}</div>
                  <div className="pd-owner-badge">
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                      <path d="M20 6L9 17l-5-5" />
                    </svg>
                    <span>Verified {resolvedUser.university} student</span>
                  </div>
                </div>
              </div>
              <div style={{ textAlign: 'right', fontSize: 12, color: 'var(--muted)' }}>
                <span>{resolvedUser.university}</span>
                <br />
                <span style={{ color: 'var(--brand)', fontWeight: 600 }}>Meet at {item.area}</span>
              </div>
            </div>

            {/* Sharing Guidelines Notice */}
            <div className="pd-safety-box">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 3l8 3v6c0 4.5-3.4 8-8 9-4.6-1-8-4.5-8-9V6l8-3z" />
                <path d="M9 12l2 2 4-4" />
              </svg>
              <span>
                <strong>Campus Sharing Safety:</strong> Always meet the owner in a public campus spot (e.g. Science Library, TSC, or Curzon Hall). Inspect the item together before accepting. Confirm return to immediately unlock your deposit.
              </span>
            </div>
          </section>

          {/* Column 2: Sticky Rental Station & Token Calculation */}
          <aside className="pd-station-card">
            {/* Price Header */}
            <div className="pd-price-row">
              <span className="pd-price-val">{item.price}</span>
              <span className="pd-price-unit">tokens / day</span>
            </div>
            <div className="pd-deposit-sub">
              {item.deposit} tokens refundable deposit required
            </div>

            {/* Confirmation Banner If Borrowed */}
            {borrowRequested && (
              <div className="pd-confirm-banner">
                <h4>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <path d="M20 6L9 17l-5-5" />
                  </svg>
                  Request Sent Successfully!
                </h4>
                <p>
                  {item.owner} has been notified. Meet at <strong>{item.area}</strong> to collect your {item.name}.
                </p>
              </div>
            )}

            {/* Rental Duration Selector */}
            <div className="pd-duration-section">
              <label className="pd-duration-label" htmlFor="rental-days-stepper">
                Rental Duration
              </label>
              <div className="pd-stepper-row">
                <button
                  type="button"
                  id="rental-days-stepper"
                  className="pd-step-btn"
                  onClick={() => setCustomRentalDays(Math.max(1, rentalDays - 1))}
                  disabled={rentalDays <= 1}
                  aria-label="Decrease rental days"
                >
                  −
                </button>
                <div className="pd-step-val">
                  {rentalDays} {rentalDays === 1 ? 'day' : 'days'}
                </div>
                <button
                  type="button"
                  className="pd-step-btn"
                  onClick={() => setCustomRentalDays(Math.min(30, rentalDays + 1))}
                  aria-label="Increase rental days"
                >
                  +
                </button>
              </div>

              {/* Preset Quick Chips */}
              <div className="pd-presets-row">
                {[1, 2, 3, 7].map((d) => (
                  <button
                    key={d}
                    type="button"
                    className={`pd-preset-btn ${rentalDays === d ? 'active' : ''}`}
                    onClick={() => setCustomRentalDays(d)}
                  >
                    {d} {d === 1 ? 'day' : 'days'}
                  </button>
                ))}
              </div>
            </div>

            {/* Token Calculation Breakdown */}
            <div className="pd-breakdown-box">
              <div className="pd-breakdown-row">
                <span>Rental fee ({rentalDays} {rentalDays === 1 ? 'day' : 'days'} × {item.price})</span>
                <strong>{rentalFee} tokens</strong>
              </div>
              <div className="pd-breakdown-row">
                <span>Refundable deposit</span>
                <strong>{item.deposit} tokens</strong>
              </div>
              <div className="pd-breakdown-row total">
                <span>Total tokens required</span>
                <span className="pd-breakdown-total-tokens">{totalTokens} tokens</span>
              </div>
              <div className="pd-deposit-guarantee">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="10" />
                  <path d="M12 16v-4M12 8h.01" />
                </svg>
                <span>Deposit of {item.deposit} tokens is released back immediately upon item return.</span>
              </div>
            </div>

            {/* Primary Action Button */}
            <button
              type="button"
              className="pd-borrow-btn"
              onClick={handleBorrowRequest}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 5v14M5 12h14" />
              </svg>
              <span>{borrowRequested ? 'Send Another Request' : 'Request to borrow'}</span>
            </button>

            {/* Secondary Action Button - Save to Favorites */}
            <button
              type="button"
              className={`pd-fav-toggle-btn ${favorites[item.name] ? 'active' : ''}`}
              onClick={handleToggleFavorite}
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 20s-7-4.4-7-10a4.2 4.2 0 0 1 7-3 4.2 4.2 0 0 1 7 3c0 5.6-7 10-7 10z" />
              </svg>
              <span>{favorites[item.name] ? 'Saved to Favorites' : 'Save to favorites'}</span>
            </button>

            {/* Wallet Token Balance Pill */}
            <div className="pd-wallet-pill">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="2" y="5" width="20" height="14" rx="2" />
                <path d="M2 10h20" />
              </svg>
              <span>Your wallet: <strong>{walletBalance} tokens</strong> available</span>
            </div>
          </aside>
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
              style={{ background: 'none', border: 'none', color: 'var(--brand)', cursor: 'pointer', font: 'inherit', marginLeft: 16 }}
            >
              Log out
            </button>
          </span>
        </div>
      </footer>

      {/* Toast Notification */}
      <div className={`toast ${toastVisible ? 'on' : ''}`} role="status" aria-live="polite">
        {toastMessage}
      </div>
    </div>
  );
}

