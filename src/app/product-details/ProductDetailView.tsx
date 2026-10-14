"use client";

import React, { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { DEFAULT_ITEMS, MarketplaceItem, UserProfile } from '../marketplace/marketplace-data';
import '../marketplace/marketplace.css';
import './product-details.css';

interface ProductDetailViewProps {
  productId?: string;
}

export default function ProductDetailView({ productId }: ProductDetailViewProps) {
  const router = useRouter();

  // Authentication State
  const [user, setUser] = useState<UserProfile | null>(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [showProfileMenu, setShowProfileMenu] = useState(false);

  // Product & Interaction State
  const [rentalDays, setRentalDays] = useState(1);
  const [favorites, setFavorites] = useState<Record<string, boolean>>({});
  const [borrowRequested, setBorrowRequested] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [toastVisible, setToastVisible] = useState(false);

  // Load User & Favorites on Client Mount
  useEffect(() => {
    try {
      const storedUser = localStorage.getItem('unishare_user');
      const isLoggedIn =
        localStorage.getItem('unishare_logged_in') === 'true' ||
        document.cookie.includes('unishare_logged_in=true') ||
        document.cookie.includes('unishare_token=');

      if (storedUser) {
        setUser(JSON.parse(storedUser));
      } else if (isLoggedIn) {
        const fallback: UserProfile = {
          name: 'Farhana Rahman',
          email: 'farhana@std.du.ac.bd',
          initials: 'FR',
          university: 'University of Dhaka',
          verified: true,
          department: 'Computer Science & Engineering',
          tokenBalance: 420,
        };
        setUser(fallback);
        localStorage.setItem('unishare_user', JSON.stringify(fallback));
      }

      const storedFavs = localStorage.getItem('unishare_favorites');
      if (storedFavs) {
        setFavorites(JSON.parse(storedFavs));
      }
    } catch (e) {
      console.error(e);
    } finally {
      setAuthChecked(true);
    }
  }, []);

  // Determine the active item
  const item: MarketplaceItem = useMemo(() => {
    let targetId = productId;
    if (!targetId && typeof window !== 'undefined') {
      const q = new URLSearchParams(window.location.search).get('id');
      if (q) targetId = q;
    }

    // Check custom listed items in localStorage
    if (typeof window !== 'undefined') {
      try {
        const custom = localStorage.getItem('unishare_marketplace_items');
        if (custom) {
          const parsed = JSON.parse(custom) as MarketplaceItem[];
          const match = parsed.find(
            (it) => it.id === targetId || it.name.toLowerCase().replace(/[^a-z0-9]/g, '-').includes((targetId || '').toLowerCase())
          );
          if (match) return match;
        }
      } catch (err) {
        console.error(err);
      }
    }

    if (targetId) {
      const direct = DEFAULT_ITEMS.find((it) => it.id === targetId);
      if (direct) return direct;

      const slugMatch = DEFAULT_ITEMS.find((it) =>
        it.name.toLowerCase().replace(/[^a-z0-9]/g, '-').includes((targetId || '').toLowerCase())
      );
      if (slugMatch) return slugMatch;
    }

    return DEFAULT_ITEMS[0];
  }, [productId]);

  // Record item in recently viewed
  useEffect(() => {
    if (item && typeof window !== 'undefined') {
      try {
        const storedRecent = localStorage.getItem('unishare_recently_viewed');
        const list: string[] = storedRecent ? JSON.parse(storedRecent) : [];
        const updated = [item.name, ...list.filter((n) => n !== item.name)].slice(0, 10);
        localStorage.setItem('unishare_recently_viewed', JSON.stringify(updated));
      } catch (e) {
        console.error(e);
      }
    }
  }, [item]);

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
    setFavorites(updated);
    try {
      localStorage.setItem('unishare_favorites', JSON.stringify(updated));
    } catch (e) {
      console.error(e);
    }
    showToast(updated[item.name] ? `Added "${item.name}" to Favorites` : `Removed from Favorites`);
  };

  // Borrow Request Handler
  const handleBorrowRequest = () => {
    setBorrowRequested(true);
    showToast(`Request sent to ${item.owner}! Meet at ${item.area}.`);
  };

  // Demo Login Helper
  const handleDemoLogin = () => {
    const demoProfile: UserProfile = {
      name: 'Farhana Rahman',
      email: 'farhana@std.du.ac.bd',
      initials: 'FR',
      university: 'University of Dhaka',
      verified: true,
      department: 'Computer Science & Engineering',
      tokenBalance: 420,
    };
    setUser(demoProfile);
    localStorage.setItem('unishare_logged_in', 'true');
    localStorage.setItem('unishare_user', JSON.stringify(demoProfile));
    document.cookie = 'unishare_logged_in=true; path=/; max-age=86400';
    document.cookie = `unishare_token=demo_token_${Date.now()}; path=/; max-age=604800; SameSite=Lax`;
    showToast('Signed in as Farhana Rahman (DU Verified)');
  };

  // Logout Handler
  const handleLogout = () => {
    localStorage.removeItem('unishare_logged_in');
    localStorage.removeItem('unishare_user');
    document.cookie = 'unishare_logged_in=; path=/; max-age=0';
    document.cookie = 'unishare_token=; path=/; max-age=0; SameSite=Lax';
    setUser(null);
    setShowProfileMenu(false);
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
        <header className="top">
          <div className="wrap">
            <Link href="/" className="logo">
              <svg width="22" height="14" viewBox="0 0 22 14" fill="none" stroke="currentColor" strokeWidth="2.4">
                <circle cx="6.5" cy="7" r="4.5" />
                <circle cx="15.5" cy="7" r="4.5" />
              </svg>
              <span>UniShare</span>
            </Link>
            <div className="rt">
              <Link href="/login?redirect=/marketplace" className="btn" style={{ padding: '8px 18px', height: 40, fontSize: 14 }}>
                Log in
              </Link>
            </div>
          </div>
        </header>

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
    <div className="product-detail-page unishare-marketplace">
      {/* Top Navigation */}
      <header className="top">
        <div className="wrap">
          <Link href="/home" className="logo">
            <svg
              width="20"
              height="14"
              viewBox="0 0 20 14"
              fill="none"
              stroke="#0d6b63"
              strokeWidth="2"
              aria-hidden="true"
            >
              <circle cx="6" cy="7" r="4.5" />
              <circle cx="14" cy="7" r="4.5" />
            </svg>
            UniShare
          </Link>

          <nav className="menu" aria-label="Main Navigation">
            <Link href="/home">Home</Link>
            <Link className="on" href="/marketplace">
              Marketplace
            </Link>
            <Link href="/my-products">My products</Link>
            <Link href="/home#rentals">My rentals</Link>
            <Link href="/rides">Rides</Link>
            <Link href="/wallet">Wallet</Link>
            <Link href="/favorites">Favorites</Link>
          </nav>

          <div className="rt">
            {/* Notification Bell */}
            <Link
              href="/notifications"
              className="bell"
              aria-label="Notifications"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M6 8a6 6 0 1112 0c0 7 3 9 3 9H3s3-2 3-9" />
                <path d="M10.3 21a1.9 1.9 0 003.4 0" />
              </svg>
              <i />
            </Link>

            {/* SOS Safety Button */}
            <a
              className="sos"
              href="#"
              onClick={(e) => {
                e.preventDefault();
                showToast('Emergency Campus SOS: Dhaka University Proctorial Team contacted.');
              }}
              title="DU Campus Safety Hotline"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                <path d="M9 12l2 2 4-4" />
              </svg>
              <span>SOS</span>
            </a>

            {/* User Profile */}
            <div style={{ position: 'relative' }}>
              <div
                className="me"
                onClick={() => setShowProfileMenu(!showProfileMenu)}
                title="Click to view profile & options"
              >
                <span className="av">{user?.initials || 'FR'}</span>
                <div>
                  <b>{user?.name || 'Farhana Rahman'}</b>
                  <small>My profile ▾</small>
                </div>
              </div>

              {showProfileMenu && (
                <div className="profile-popover">
                  <div className="user-meta">
                    <div style={{ fontWeight: 700, fontSize: 13.5, color: 'var(--ink)' }}>
                      {user?.name || 'Farhana Rahman'}
                    </div>
                    <div style={{ fontSize: 11.5, color: 'var(--muted)' }}>
                      {user?.email || 'farhana@std.du.ac.bd'}
                    </div>
                    <div style={{ fontSize: 11.5, color: 'var(--brand)', fontWeight: 700, marginTop: 4 }}>
                      Wallet: {user?.tokenBalance ?? 420} tokens
                    </div>
                  </div>
                  <Link href="/marketplace" onClick={() => setShowProfileMenu(false)}>
                    Browse items
                  </Link>
                  <button
                    type="button"
                    onClick={handleLogout}
                    style={{ color: 'var(--red, #b91c1c)' }}
                  >
                    Log out
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="wrap">
        {/* Breadcrumb Navigation */}
        <nav className="crumb" aria-label="Breadcrumb" style={{ marginTop: 14 }}>
          <Link href="/">Home</Link>
          <span style={{ margin: '0 4px' }}>›</span>
          <Link href="/marketplace">Marketplace</Link>
          <span style={{ margin: '0 4px' }}>›</span>
          <span style={{ color: 'var(--ink)' }}>{item.name}</span>
        </nav>

        {/* Eyebrow */}
        <div className="eyebrow" style={{ marginTop: 14 }}>
          University of Dhaka · Verified students only
        </div>

        {/* Back Link */}
        <div style={{ marginTop: 12 }}>
          <Link href="/marketplace" className="pd-back-link">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M19 12H5M12 19l-7-7 7-7" />
            </svg>
            <span>Back to Marketplace</span>
          </Link>
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
                priority
              />
              <span className="pd-badge-avail">Available today</span>
            </div>

            {/* Category Tag & Product Title */}
            <span className="pd-category-tag">{item.category}</span>
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
                  <span className="pd-spec-val">DU Student Verified Only</span>
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
                    <span>Verified DU student</span>
                  </div>
                </div>
              </div>
              <div style={{ textAlign: 'right', fontSize: 12, color: 'var(--muted)' }}>
                <span>University of Dhaka</span>
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
                  onClick={() => setRentalDays((prev) => Math.max(1, prev - 1))}
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
                  onClick={() => setRentalDays((prev) => Math.min(30, prev + 1))}
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
                    onClick={() => setRentalDays(d)}
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
              <span>Your wallet: <strong>{user?.tokenBalance ?? 420} tokens</strong> available</span>
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

