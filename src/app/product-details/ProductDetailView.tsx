"use client";

import React, { useState, useEffect, useMemo, Suspense } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter, useSearchParams } from 'next/navigation';
import { DEFAULT_ITEMS, MarketplaceItem } from '../marketplace/marketplace-data';
import AppNavbar from '../components/AppNavbar';
import {
  clearClientSession,
  getUserScopedKey,
  saveClientUser,
  signInDemoStudent,
  useCurrentUser,
  useIsHydrated,
  useLocalStorageRaw,
  writeUserScopedJson,
  type ClientUser,
} from '../lib/user-client';
import '../marketplace/marketplace.css';
import './product-details.css';

interface ProductDetailViewProps {
  productId?: string;
}

function toIsoDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function addDays(baseIso: string, delta: number): string {
  const parts = baseIso.split('-').map(Number);
  if (parts.length === 3 && parts.every((n) => Number.isFinite(n) && n > 0)) {
    const dt = new Date(parts[0], parts[1] - 1, parts[2] + delta);
    return toIsoDate(dt);
  }
  const dt = new Date();
  dt.setDate(dt.getDate() + delta);
  return toIsoDate(dt);
}

function ProductDetailContent({ productId }: ProductDetailViewProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryId = (searchParams.get('id') || '').trim();
  const effectiveId = (productId || queryId).trim();
  const fromParam = (searchParams.get('from') || '').trim();
  const toParam = (searchParams.get('to') || '').trim();
  const daysParam = Number(searchParams.get('days') || '');

  // Authentication State
  const { user, resolvedUser, isDemoUser } = useCurrentUser();
  const authChecked = useIsHydrated();

  const initialDaysFromQuery =
    Number.isFinite(daysParam) && daysParam >= 1 ? Math.min(30, Math.round(daysParam)) : 1;

  const [customRentalDays, setCustomRentalDays] = useState<number | null>(null);
  const [pickupDate, setPickupDate] = useState(() => fromParam || toIsoDate(new Date()));
  const [borrowNote, setBorrowNote] = useState('');
  const [isBorrowing, setIsBorrowing] = useState(false);
  const [borrowError, setBorrowError] = useState('');
  const [borrowRequested, setBorrowRequested] = useState(false);
  const [existingRentalStatus, setExistingRentalStatus] = useState<'PENDING' | 'ACTIVE' | null>(null);
  const [isDemoLoading, setIsDemoLoading] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [toastVisible, setToastVisible] = useState(false);
  const [remoteState, setRemoteState] = useState<{
    id: string;
    item: MarketplaceItem | null;
  } | null>(null);
  const remoteItem = effectiveId && remoteState?.id === effectiveId ? remoteState.item : null;
  const isLoadingRemote = Boolean(effectiveId) && remoteState?.id !== effectiveId;
  const [dbFavRecord, setDbFavRecord] = useState<{
    email: string;
    ids: string[];
  } | null>(null);
  const dbFavoriteIds = useMemo(
    () =>
      user?.email && dbFavRecord?.email === user.email
        ? dbFavRecord.ids
        : null,
    [dbFavRecord, user?.email]
  );

  useEffect(() => {
    if (!effectiveId) return;
    let active = true;
    fetch(`/api/marketplace/${encodeURIComponent(effectiveId)}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data: { ok?: boolean; marketItem?: MarketplaceItem } | null) => {
        if (active) {
          setRemoteState({
            id: effectiveId,
            item: data?.ok && data.marketItem ? data.marketItem : null,
          });
        }
      })
      .catch(() => {
        if (active) setRemoteState({ id: effectiveId, item: null });
      });
    return () => {
      active = false;
    };
  }, [effectiveId]);

  useEffect(() => {
    const email = user?.email;
    if (!email) return;
    let active = true;
    fetch('/api/marketplace/favorites', {
      headers: { 'x-user-email': email },
    })
      .then((res) => (res.ok ? res.json() : null))
      .then((data: { ok?: boolean; listingIds?: string[] } | null) => {
        if (active && data?.ok && Array.isArray(data.listingIds)) {
          setDbFavRecord({ email, ids: data.listingIds });
        }
      })
      .catch(() => {});

    if (effectiveId && !DEFAULT_ITEMS.some((d) => d.id === effectiveId)) {
      fetch('/api/marketplace/rentals', {
        headers: { 'x-user-email': email },
      })
        .then((res) => (res.ok ? res.json() : null))
        .then((data: { ok?: boolean; borrowed?: Array<{ listingId: string; status: string }> } | null) => {
          if (!active || !data?.ok || !Array.isArray(data.borrowed)) return;
          const match = data.borrowed.find(
            (r) => r.listingId === effectiveId && (r.status === 'PENDING' || r.status === 'ACTIVE')
          );
          setExistingRentalStatus(match ? (match.status as 'PENDING' | 'ACTIVE') : null);
        })
        .catch(() => {});
    }

    return () => {
      active = false;
    };
  }, [user?.email, effectiveId]);

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
  const customMarketKey = getUserScopedKey(
    'unishare_marketplace_items',
    resolvedUser.email,
    isDemoUser
  );

  const rawFavsJson = useLocalStorageRaw(favoritesKey);
  const rawCustomItemsJson = useLocalStorageRaw(customMarketKey);
  const myProductsKey = getUserScopedKey(
    'unishare_my_products',
    resolvedUser.email,
    isDemoUser
  );
  const rawMyProductsJson = useLocalStorageRaw(myProductsKey);

  const favorites: Record<string, boolean> = useMemo(() => {
    const merged: Record<string, boolean> = {};
    if (rawFavsJson) {
      try {
        Object.assign(merged, JSON.parse(rawFavsJson) as Record<string, boolean>);
      } catch {}
    }
    if (Array.isArray(dbFavoriteIds)) {
      for (const id of dbFavoriteIds) merged[id] = true;
    }
    return merged;
  }, [rawFavsJson, dbFavoriteIds]);

  const walletBalance = resolvedUser.tokenBalance;

  // Determine the active item cleanly without false fallback to Calculator on 404
  const item: MarketplaceItem | null = useMemo(() => {
    if (!effectiveId) return DEFAULT_ITEMS[0];
    if (remoteItem && remoteItem.id === effectiveId) return remoteItem;

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
        const ownMatch = mine.find((it) => it.id === effectiveId);
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
            university: resolvedUser.university,
            initials: resolvedUser.initials,
            image: ownMatch.image,
            available: ownMatch.state === 'active',
            condition: ownMatch.condition,
            maxRentalDays: ownMatch.maxRentalDays,
            description: ownMatch.description || ownMatch.note || `Listed by ${resolvedUser.name}.`,
          };
        }
      } catch {}
    }

    if (rawCustomItemsJson) {
      try {
        const parsed = JSON.parse(rawCustomItemsJson) as MarketplaceItem[];
        const exactCustom = parsed.find((it) => it.id === effectiveId);
        if (exactCustom) return exactCustom;
      } catch {}
    }

    const directDefault = DEFAULT_ITEMS.find((it) => it.id === effectiveId);
    if (directDefault) return directDefault;

    return null;
  }, [effectiveId, remoteItem, rawCustomItemsJson, rawMyProductsJson, resolvedUser.email, resolvedUser.initials, resolvedUser.name, resolvedUser.university]);

  const maxAllowedDays = item?.maxRentalDays || 7;
  const rentalDays = Math.min(maxAllowedDays, Math.max(1, customRentalDays ?? initialDaysFromQuery));
  const computedEndDate = toParam && customRentalDays === null ? toParam : addDays(pickupDate, rentalDays - 1);

  // Record item in recently viewed keyed by id
  useEffect(() => {
    if (item && typeof window !== 'undefined') {
      try {
        const storedRecent = localStorage.getItem(recentKey);
        const list: string[] = storedRecent ? JSON.parse(storedRecent) : [];
        const updated = [item.id, ...list.filter((n) => n !== item.id && n !== item.name)].slice(0, 10);
        localStorage.setItem(recentKey, JSON.stringify(updated));
      } catch {}
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

  const isOwnListing = Boolean(
    item &&
      ((item.ownerEmail && item.ownerEmail.toLowerCase() === resolvedUser.email.toLowerCase()) ||
        item.owner === resolvedUser.name)
  );
  const isFavorited = Boolean(item && (favorites[item.id] || favorites[item.name]));

  // Toggle Favorite
  const handleToggleFavorite = () => {
    if (!item) return;
    const nextSaved = !isFavorited;
    const updated = { ...favorites, [item.id]: nextSaved };
    delete updated[item.name];
    writeUserScopedJson(favoritesKey, updated);

    if (user?.email && Array.isArray(dbFavoriteIds)) {
      setDbFavRecord({
        email: user.email,
        ids: nextSaved
          ? [item.id, ...dbFavoriteIds.filter((id) => id !== item.id)]
          : dbFavoriteIds.filter((id) => id !== item.id),
      });
    }

    if (user?.email) {
      fetch('/api/marketplace/favorites', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-email': user.email,
        },
        body: JSON.stringify({ listingId: item.id }),
      }).catch(() => {});
    }

    showToast(nextSaved ? `Added "${item.name}" to Favorites` : 'Removed from Favorites');
  };

  // Real DB Escrow Borrow Request Handler
  const handleBorrowRequest = async () => {
    if (!item || isOwnListing || !item.available || isBorrowing) return;
    setBorrowError('');

    if (DEFAULT_ITEMS.some((d) => d.id === item.id) && !remoteItem) {
      setBorrowRequested(true);
      showToast(`Showcase preview request recorded for ${item.owner}. Try borrowing any live student listing for full wallet escrow!`);
      return;
    }

    setIsBorrowing(true);
    try {
      const res = await fetch('/api/marketplace/rentals', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(user?.email ? { 'x-user-email': user.email } : {}),
        },
        body: JSON.stringify({
          listingId: item.id,
          startDate: pickupDate,
          endDate: computedEndDate,
          days: rentalDays,
          note: borrowNote.trim(),
        }),
      });
      const data = (await res.json().catch(() => null)) as {
        ok?: boolean;
        error?: string;
        newBalance?: number;
      } | null;

      if (!res.ok || !data?.ok) {
        setBorrowError(data?.error || 'Could not submit borrow request.');
        return;
      }

      if (typeof data.newBalance === 'number') {
        if (user) {
          saveClientUser({ ...(user as ClientUser), tokenBalance: data.newBalance });
        }
      }
      setBorrowRequested(true);
      showToast(`Borrow request sent to ${item.owner}! Meet at ${item.area}.`);
    } catch {
      setBorrowError('Network error submitting borrow request. Please try again.');
    } finally {
      setIsBorrowing(false);
    }
  };

  // Demo Login Helper (real server session)
  const handleDemoLogin = async () => {
    if (isDemoLoading) return;
    setIsDemoLoading(true);
    try {
      const signedIn = await signInDemoStudent();
      if (signedIn) {
        showToast('Signed in as Farhana Rahman (DU Verified)');
      } else {
        showToast('Could not connect to login service right now.');
      }
    } finally {
      setIsDemoLoading(false);
    }
  };

  // Logout Handler
  const handleLogout = () => {
    clearClientSession();
    showToast('Logged out of UniShare.');
    setTimeout(() => {
      router.push('/login');
    }, 400);
  };

  if (!authChecked) {
    return (
      <div className="product-detail-page">
        <AppNavbar mode="guest" redirectPath="/marketplace" />
        <main className="wrap" style={{ padding: '72px 24px', textAlign: 'center', color: 'var(--muted)' }}>
          Loading item details...
        </main>
      </div>
    );
  }

  // Unauthenticated Guard
  if (!user) {
    const redirTarget = effectiveId ? `/product-details/${effectiveId}` : '/marketplace';
    return (
      <div className="unishare-marketplace">
        <AppNavbar mode="guest" redirectPath={redirTarget} />

        <main className="wrap" style={{ minHeight: '65vh', display: 'grid', placeItems: 'center', textAlign: 'center', padding: '60px 20px' }}>
          <div style={{ maxWidth: 460, background: '#ffffff', border: '1.5px solid var(--line)', borderRadius: 14, padding: 36, boxShadow: '0 4px 14px rgba(18, 32, 31, 0.08)' }}>
            <div style={{ width: 48, height: 48, borderRadius: '50%', background: 'var(--tint)', color: 'var(--brand)', display: 'grid', placeItems: 'center', margin: '0 auto 16px auto' }}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                <path d="M7 11V7a5 5 0 0 1 10 0v4" />
              </svg>
            </div>
            <h2 style={{ fontFamily: 'var(--head)', fontSize: 24, fontWeight: 800, marginBottom: 8 }}>
              University Account Required
            </h2>
            <p style={{ color: 'var(--muted)', fontSize: 14, lineHeight: 1.6, marginBottom: 24 }}>
              The UniShare shelf is exclusive to verified campus students. Log in with your student account to view item details and submit rental requests.
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <Link
                href={`/login?redirect=${encodeURIComponent(redirTarget)}`}
                className="btn"
                style={{ width: '100%', height: 46 }}
              >
                Log in with university email
              </Link>
              <button
                type="button"
                className="btn outline"
                onClick={handleDemoLogin}
                disabled={isDemoLoading}
                style={{ width: '100%', height: 46 }}
              >
                {isDemoLoading ? 'Signing in...' : 'Instant Access as Farhana Rahman (Demo)'}
              </button>
            </div>
          </div>
        </main>
      </div>
    );
  }

  if (isLoadingRemote && !item) {
    return (
      <div className="product-detail-page">
        <AppNavbar activeNav="marketplace" user={{ ...resolvedUser, tokenBalance: walletBalance }} onLogout={handleLogout} />
        <main className="wrap" style={{ padding: '72px 24px', textAlign: 'center', color: 'var(--muted)' }}>
          Fetching listing details from UniShare...
        </main>
      </div>
    );
  }

  if (!item) {
    return (
      <div className="product-detail-page">
        <AppNavbar activeNav="marketplace" user={{ ...resolvedUser, tokenBalance: walletBalance }} onLogout={handleLogout} />
        <main className="wrap" style={{ padding: '72px 24px', textAlign: 'center' }}>
          <div style={{ maxWidth: 460, margin: '0 auto', background: '#fff', border: '1.5px solid var(--hair)', borderRadius: 12, padding: 32 }}>
            <h1 style={{ fontSize: 24, marginBottom: 10 }}>Listing not found</h1>
            <p style={{ color: 'var(--muted)', fontSize: 14, marginBottom: 22 }}>
              This item may have been removed or is no longer listed on the campus shelf.
            </p>
            <Link href="/marketplace" className="btn" style={{ display: 'inline-flex', padding: '10px 20px', background: 'var(--brand)', color: '#fff', borderRadius: 8, fontWeight: 700 }}>
              Back to Marketplace
            </Link>
          </div>
        </main>
      </div>
    );
  }

  // Calculation
  const rentalFee = rentalDays * item.price;
  const totalTokens = rentalFee + item.deposit;
  const isShowcaseSample = !remoteItem && DEFAULT_ITEMS.some((d) => d.id === item.id);
  const hasOpenRequest = borrowRequested || existingRentalStatus !== null;

  return (
    <div className="product-detail-page">
      <AppNavbar
        activeNav="marketplace"
        user={{ ...resolvedUser, tokenBalance: walletBalance }}
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
                unoptimized
                priority
              />
              <span
                className="pd-badge-avail"
                style={item.available === false ? { background: '#fef2f2', color: '#991b1b' } : undefined}
              >
                {item.available === false ? (item.status === 'paused' ? 'Paused' : 'Currently rented') : 'Available today'}
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
                  <span className="pd-spec-val">
                    {item.available === false
                      ? item.status === 'paused'
                        ? 'Paused by lender'
                        : 'Currently rented out'
                      : `Available today · Max ${maxAllowedDays}d`}
                  </span>
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
                    <span>
                      {isShowcaseSample
                        ? 'Sample showcase · Reference item'
                        : `Verified ${item.university || resolvedUser.university} student`}
                    </span>
                  </div>
                </div>
              </div>
              <div style={{ textAlign: 'right', fontSize: 12, color: 'var(--muted)' }}>
                <span>{isShowcaseSample ? 'Campus Reference' : item.university || resolvedUser.university}</span>
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
            {hasOpenRequest && (
              <div className="pd-confirm-banner">
                <h4>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <path d="M20 6L9 17l-5-5" />
                  </svg>
                  {existingRentalStatus === 'ACTIVE'
                    ? 'Active Rental In Progress'
                    : 'Request Sent Successfully!'}
                </h4>
                <p>
                  {existingRentalStatus === 'ACTIVE' ? (
                    <>
                      Your borrow from <strong>{item.owner}</strong> is active at <strong>{item.area}</strong>.{' '}
                    </>
                  ) : (
                    <>
                      {item.owner} has been notified. Meet at <strong>{item.area}</strong> to collect your {item.name}.{' '}
                    </>
                  )}
                  {!isShowcaseSample && (
                    <Link href="/my-products" style={{ color: 'var(--brand)', fontWeight: 700, textDecoration: 'underline' }}>
                      Track in My Products →
                    </Link>
                  )}
                </p>
              </div>
            )}

            {isShowcaseSample && !hasOpenRequest && (
              <div
                style={{
                  background: 'var(--soft)',
                  border: '1px solid var(--hair)',
                  borderRadius: 10,
                  padding: '10px 12px',
                  fontSize: 12.5,
                  color: 'var(--muted)',
                  marginBottom: 14,
                  lineHeight: 1.45,
                }}
              >
                <strong style={{ color: 'var(--ink)' }}>Sample showcase item:</strong> Preview pricing without locking tokens. To borrow with live wallet escrow, pick any{' '}
                <Link href="/marketplace" style={{ color: 'var(--brand)', fontWeight: 700, textDecoration: 'underline' }}>
                  verified student listing →
                </Link>
              </div>
            )}

            {/* Rental Duration Selector */}
            <div className="pd-duration-section">
              <label className="pd-duration-label" htmlFor="rental-pickup-date">
                Pickup date &amp; duration (max {maxAllowedDays}d)
              </label>
              <input
                id="rental-pickup-date"
                type="date"
                min={toIsoDate(new Date())}
                value={pickupDate}
                onChange={(e) => setPickupDate(e.target.value || toIsoDate(new Date()))}
                style={{
                  width: '100%',
                  height: 38,
                  padding: '0 10px',
                  border: '1.5px solid var(--hair)',
                  borderRadius: 8,
                  fontSize: 13.5,
                  marginBottom: 10,
                }}
              />
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
                  {rentalDays} {rentalDays === 1 ? 'day' : 'days'} ({pickupDate} → {computedEndDate})
                </div>
                <button
                  type="button"
                  className="pd-step-btn"
                  onClick={() => setCustomRentalDays(Math.min(maxAllowedDays, rentalDays + 1))}
                  disabled={rentalDays >= maxAllowedDays}
                  aria-label="Increase rental days"
                >
                  +
                </button>
              </div>

              {/* Preset Quick Chips */}
              <div className="pd-presets-row">
                {[1, 2, 3, 7, 14]
                  .filter((d) => d <= maxAllowedDays)
                  .map((d) => (
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

            {!isOwnListing && !hasOpenRequest && item.available !== false && (
              <div style={{ marginBottom: 14 }}>
                <label className="pd-duration-label" htmlFor="rental-note">
                  Meetup note for {item.owner} (optional)
                </label>
                <input
                  id="rental-note"
                  type="text"
                  maxLength={240}
                  value={borrowNote}
                  onChange={(e) => setBorrowNote(e.target.value)}
                  placeholder={`e.g. Meet near ${item.area} at 11 AM`}
                  style={{
                    width: '100%',
                    height: 38,
                    padding: '0 10px',
                    border: '1.5px solid var(--hair)',
                    borderRadius: 8,
                    fontSize: 13.5,
                  }}
                />
              </div>
            )}

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

            {borrowError && (
              <div
                role="alert"
                style={{
                  background: '#fef2f2',
                  border: '1px solid #fecaca',
                  color: '#991b1b',
                  borderRadius: 8,
                  padding: '10px 12px',
                  fontSize: 13,
                  marginBottom: 12,
                }}
              >
                {borrowError}{' '}
                {borrowError.toLowerCase().includes('more tokens') && (
                  <Link href="/buy-tokens" style={{ textDecoration: 'underline', fontWeight: 700 }}>
                    Buy tokens →
                  </Link>
                )}
              </div>
            )}

            {/* Primary Action Button */}
            {isOwnListing ? (
              <Link
                href={`/marketplace/list?edit=${encodeURIComponent(item.id)}`}
                className="pd-borrow-btn"
                style={{ textDecoration: 'none' }}
              >
                <span>Edit your listing</span>
              </Link>
            ) : (
                <button
                type="button"
                className="pd-borrow-btn"
                onClick={handleBorrowRequest}
                disabled={isBorrowing || hasOpenRequest || item.available === false}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M12 5v14M5 12h14" />
                </svg>
                <span>
                  {item.available === false
                    ? 'Currently unavailable'
                    : existingRentalStatus === 'ACTIVE'
                    ? 'Active Rental In Progress'
                    : hasOpenRequest
                    ? 'Request Pending Lender Approval'
                    : isBorrowing
                    ? 'Holding escrow...'
                    : 'Request to borrow'}
                </span>
              </button>
            )}

            {/* Secondary Action Button - Save to Favorites */}
            <button
              type="button"
              className={`pd-fav-toggle-btn ${isFavorited ? 'active' : ''}`}
              onClick={handleToggleFavorite}
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 20s-7-4.4-7-10a4.2 4.2 0 0 1 7-3 4.2 4.2 0 0 1 7 3c0 5.6-7 10-7 10z" />
              </svg>
              <span>{isFavorited ? 'Saved to Favorites' : 'Save to favorites'}</span>
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
            <Link href="/privacy" style={{ marginLeft: 0 }}>Privacy</Link>
            <Link href="/terms">Terms</Link>
            <Link href="/help">Get help</Link>
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

export default function ProductDetailView({ productId }: ProductDetailViewProps) {
  return (
    <Suspense
      fallback={
        <div className="product-detail-page">
          <AppNavbar mode="guest" redirectPath="/marketplace" />
          <main className="wrap" style={{ padding: '72px 24px', textAlign: 'center', color: 'var(--muted)' }}>
            Loading item details...
          </main>
        </div>
      }
    >
      <ProductDetailContent productId={productId} />
    </Suspense>
  );
}

