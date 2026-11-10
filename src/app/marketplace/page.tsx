'use strict';
'use client';

import React, { useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';

function toLocalIsoDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

const emptySubscribe = () => () => {};
let cachedTodayIso = '';
function getClientTodayIso(): string {
  const next = toLocalIsoDate(new Date());
  if (next !== cachedTodayIso) cachedTodayIso = next;
  return cachedTodayIso;
}

function addDaysIso(baseIso: string, offsetDays: number): string {
  const base = new Date(`${baseIso}T00:00:00`);
  base.setDate(base.getDate() + offsetDays);
  return toLocalIsoDate(base);
}

function calcRentalDays(startIso: string, endIso: string): number {
  if (!startIso) return 1;
  const start = new Date(`${startIso}T00:00:00`).getTime();
  const end = new Date(`${(endIso || startIso)}T00:00:00`).getTime();
  if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) return 1;
  return Math.max(1, Math.round((end - start) / 86400000) + 1);
}

function formatShortDate(iso: string): string {
  if (!iso) return '';
  return new Date(`${iso}T00:00:00`).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
  });
}
import {
  DEFAULT_ITEMS,
  CATEGORIES,
  PICKUP_AREAS,
  MarketplaceItem,
} from './marketplace-data';
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
import './marketplace.css';

export default function MarketplacePage() {
  const router = useRouter();
  const { user, resolvedUser, isDemoUser } = useCurrentUser();
  const authChecked = useIsHydrated();

  // Marketplace State
  const [selectedTab, setSelectedTab] = useState<'all' | 'fav' | 'recent' | 'you' | 'mine'>('all');
  const [selectedCategory, setSelectedCategory] = useState('All items');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedArea, setSelectedArea] = useState('');
  const [selectedPriceMax, setSelectedPriceMax] = useState('');
  const [selectedAvailability, setSelectedAvailability] = useState('now');
  const [selectedSort, setSelectedSort] = useState('rec');
  const [rentalStartDate, setRentalStartDate] = useState('');
  const [rentalEndDate, setRentalEndDate] = useState('');
  const [showDatePopover, setShowDatePopover] = useState(false);
  const dateFilterRef = useRef<HTMLDivElement>(null);

  const todayIso = useSyncExternalStore(
    emptySubscribe,
    getClientTodayIso,
    () => ''
  );
  const effectiveTodayIso = todayIso || undefined;
  const rentalDaysCount = rentalStartDate
    ? calcRentalDays(rentalStartDate, rentalEndDate || rentalStartDate)
    : null;

  useEffect(() => {
    if (!showDatePopover) return;
    const handlePointerDown = (event: MouseEvent) => {
      if (dateFilterRef.current && !dateFilterRef.current.contains(event.target as Node)) {
        setShowDatePopover(false);
      }
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setShowDatePopover(false);
    };
    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [showDatePopover]);

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

  const rawItemsJson = useLocalStorageRaw('unishare_marketplace_items');
  const rawFavsJson = useLocalStorageRaw(favoritesKey);
  const rawRecentJson = useLocalStorageRaw(recentKey);
  const rawWalletJson = useLocalStorageRaw(walletKey);
  const [serverItems, setServerItems] = useState<MarketplaceItem[]>([]);

  useEffect(() => {
    let active = true;
    const loadServerListings = async () => {
      try {
        const res = await fetch('/api/marketplace');
        const data = (await res.json().catch(() => null)) as {
          ok?: boolean;
          items?: MarketplaceItem[];
        } | null;
        if (active && res.ok && data?.ok && Array.isArray(data.items)) {
          setServerItems(data.items);
        }
      } catch {
        // fallback cleanly when offline
      }
    };
    loadServerListings();
    const handleRefresh = () => loadServerListings();
    window.addEventListener('unishare-storage', handleRefresh);
    window.addEventListener('focus', handleRefresh);
    return () => {
      active = false;
      window.removeEventListener('unishare-storage', handleRefresh);
      window.removeEventListener('focus', handleRefresh);
    };
  }, []);

  const items: MarketplaceItem[] = useMemo(() => {
    let localItems: MarketplaceItem[] = DEFAULT_ITEMS;
    if (rawItemsJson) {
      try {
        const parsed = JSON.parse(rawItemsJson);
        if (Array.isArray(parsed)) localItems = parsed as MarketplaceItem[];
      } catch {}
    }

    if (serverItems.length === 0) return localItems;
    const seenIds = new Set(serverItems.map((it) => it.id));
    return [...serverItems, ...localItems.filter((it) => !seenIds.has(it.id))];
  }, [rawItemsJson, serverItems]);

  const favorites: Record<string, boolean> = useMemo(() => {
    if (!rawFavsJson) return {};
    try {
      return JSON.parse(rawFavsJson) as Record<string, boolean>;
    } catch {
      return {};
    }
  }, [rawFavsJson]);

  const recentlyViewed: string[] = useMemo(() => {
    if (!rawRecentJson) return [];
    try {
      const parsed = JSON.parse(rawRecentJson);
      return Array.isArray(parsed) ? (parsed as string[]) : [];
    } catch {
      return [];
    }
  }, [rawRecentJson]);

  const walletBalance = useMemo(() => {
    if (rawWalletJson) {
      try {
        const parsed = JSON.parse(rawWalletJson) as { balance?: number };
        if (parsed.balance !== undefined) return parsed.balance;
      } catch {}
    }
    return resolvedUser.tokenBalance;
  }, [rawWalletJson, resolvedUser.tokenBalance]);

  // Toast State
  const [toastMessage, setToastMessage] = useState('');
  const [toastVisible, setToastVisible] = useState(false);

  // Toast Helper
  const showToast = (msg: string) => {
    setToastMessage(msg);
    setToastVisible(true);
    setTimeout(() => {
      setToastVisible(false);
    }, 2400);
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

  // Toggle Favorite
  const toggleFavorite = (itemName: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    const updated = { ...favorites, [itemName]: !favorites[itemName] };
    writeUserScopedJson(favoritesKey, updated);
    showToast(updated[itemName] ? `Added "${itemName}" to Favorites` : `Removed from Favorites`);
  };

  // Open Item Detail - Direct move to product details page
  const handleOpenItem = (item: MarketplaceItem) => {
    const updated = [item.name, ...recentlyViewed.filter((n) => n !== item.name)].slice(0, 10);
    writeUserScopedJson(recentKey, updated);
    const params = new URLSearchParams();
    if (rentalDaysCount) params.set('days', String(rentalDaysCount));
    if (rentalStartDate) params.set('from', rentalStartDate);
    if (rentalEndDate || rentalStartDate) params.set('to', rentalEndDate || rentalStartDate);
    const qs = params.toString();
    router.push(`/product-details/${item.id}${qs ? `?${qs}` : ''}`);
  };

  // Filter and Sort Items
  const filteredItems = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();

    const list = items.filter((x) => {
      // Tab filter
      if (selectedTab === 'fav' && !favorites[x.name]) return false;
      if (selectedTab === 'recent' && !recentlyViewed.includes(x.name)) return false;
      if (
        selectedTab === 'mine' &&
        x.ownerEmail !== resolvedUser.email &&
        x.owner !== resolvedUser.name
      ) {
        return false;
      }

      // Category filter
      if (selectedCategory !== 'All items' && x.category !== selectedCategory) return false;

      // Pickup Area filter
      if (selectedArea && x.area !== selectedArea) return false;

      // Price filter
      if (selectedPriceMax && x.price > Number(selectedPriceMax)) return false;

      // Availability filter
      if (selectedAvailability === 'now' && !x.available) return false;

      // Rental date duration filter
      if (rentalDaysCount && x.maxRentalDays && rentalDaysCount > x.maxRentalDays) return false;

      // Search query
      if (q) {
        const hay = `${x.name} ${x.category} ${x.owner} ${x.area}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }

      return true;
    });

    // Sort order
    if (selectedTab === 'recent') {
      list.sort((a, b) => recentlyViewed.indexOf(a.name) - recentlyViewed.indexOf(b.name));
    } else if (selectedSort === 'lo') {
      list.sort((a, b) => a.price - b.price);
    } else if (selectedSort === 'hi') {
      list.sort((a, b) => b.price - a.price);
    }

    if (selectedTab === 'you') {
      return list.slice(0, 4);
    }

    return list;
  }, [
    items,
    searchQuery,
    selectedCategory,
    selectedArea,
    selectedPriceMax,
    selectedAvailability,
    rentalDaysCount,
    selectedSort,
    selectedTab,
    favorites,
    recentlyViewed,
    resolvedUser.email,
    resolvedUser.name,
  ]);

  // Auth Gate: Shown if user has not logged in
  if (authChecked && !user) {
    return (
      <div className="unishare-marketplace">
        <AppNavbar mode="guest" redirectPath="/marketplace" />

        <main className="unishare-gate-wrapper">
          <div className="unishare-gate-card">
            <div className="gate-badge">
              <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="5" y="11" width="14" height="9" rx="2" />
                <path d="M8 11V8a4 4 0 0 1 8 0v3" />
              </svg>
            </div>
            <div className="kicker" style={{ marginTop: 0, marginBottom: 8 }}>
              UNIVERSITY OF DHAKA · MEMBERS ONLY
            </div>
            <h2 style={{ fontFamily: 'var(--head)', fontSize: 28, fontWeight: 800, marginBottom: 12 }}>
              Log in to access the Marketplace
            </h2>
            <p style={{ color: 'var(--muted)', fontSize: 15, lineHeight: 1.5, marginBottom: 28 }}>
              Campus borrowing and peer lending is restricted to verified University of Dhaka students.
              Log in with your university credentials to explore available gadgets, sports gear, and campus essentials.
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <Link
                href="/login?redirect=/marketplace"
                className="btn"
                style={{ width: '100%', height: 46 }}
              >
                Log in with University Email
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
    <div className="unishare-marketplace">
      <AppNavbar
        activeNav="marketplace"
        user={{ tokenBalance: walletBalance }}
        onLogout={handleLogout}
        onSos={() => showToast(`Emergency Campus SOS: ${resolvedUser.university} Proctorial Team contacted.`)}
      />

      {/* Main Body */}
      <main className="wrap">
        {/* Breadcrumb Navigation */}
        <nav className="crumb" aria-label="Breadcrumb">
          <Link href="/home">Home</Link>
          <span>›</span>
          <span className="current">Marketplace</span>
        </nav>

        {/* Hero Section */}
        <div className="kicker">{resolvedUser.university} · Verified students only</div>
        <div className="hero-row">
          <div>
            <h1>Your campus, one shared shelf.</h1>
            <p className="hero-sub">Borrow what you need. Lend what you have. All from verified {resolvedUser.university} students.</p>
          </div>
          <div className="hero-actions">
            <Link href="/my-products" className="btn outline">
              My listings
            </Link>
            <Link href="/marketplace/list" className="btn">
              List an item
            </Link>
          </div>
        </div>

        {/* Campus Verification Trust Banner */}
        <div className="trust-banner">
          <svg className="shield-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M12 3l8 3v6c0 4.5-3.4 8-8 9-4.6-1-8-4.5-8-9V6l8-3z" />
            <path d="M9 12l2 2 4-4" />
          </svg>
          <div className="banner-text">
            <b>Only your university. Always a verified student.</b>
            <p>Every item here belongs to a verified {resolvedUser.university} student. Meet on campus and pay with tokens.</p>
          </div>
          <span className="banner-status">
            {resolvedUser.verified ? 'Verified student' : 'Campus member'}
          </span>
        </div>

        {/* Organized Control Station (Tabs, Search, Filters, Categories) */}
        <section className="controls-container">
          {/* Tabs */}
          <div className="shelf-tabs" role="tablist">
            <button
              className={`shelf-tab ${selectedTab === 'all' ? 'on' : ''}`}
              onClick={() => setSelectedTab('all')}
            >
              Browse all
            </button>
            <button
              className={`shelf-tab ${selectedTab === 'fav' ? 'on' : ''}`}
              onClick={() => setSelectedTab('fav')}
            >
              Favorites
              {Object.values(favorites).filter(Boolean).length > 0 && (
                <span className="tab-badge">{Object.values(favorites).filter(Boolean).length}</span>
              )}
            </button>
            <button
              className={`shelf-tab ${selectedTab === 'recent' ? 'on' : ''}`}
              onClick={() => setSelectedTab('recent')}
            >
              Recently viewed
            </button>
            <button
              className={`shelf-tab ${selectedTab === 'you' ? 'on' : ''}`}
              onClick={() => setSelectedTab('you')}
            >
              For you
            </button>
            <button
              className={`shelf-tab ${selectedTab === 'mine' ? 'on' : ''}`}
              onClick={() => setSelectedTab('mine')}
            >
              My listings
              {items.filter(
                (x) => x.ownerEmail === resolvedUser.email || x.owner === resolvedUser.name
              ).length > 0 && (
                <span className="tab-badge">
                  {
                    items.filter(
                      (x) => x.ownerEmail === resolvedUser.email || x.owner === resolvedUser.name
                    ).length
                  }
                </span>
              )}
            </button>
          </div>

          {/* Search Bar */}
          <form
            className="search-bar-wrap"
            onSubmit={(e) => e.preventDefault()}
            role="search"
          >
            <svg className="search-ico" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="11" cy="11" r="7" />
              <path d="M16 16l4 4" />
            </svg>
            <input
              type="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search calculators, chargers, footballs…"
              aria-label="Search campus items"
            />
            <button className="btn" type="submit">
              Search items
            </button>
          </form>

          {/* Filters Row */}
          <div className="filters-row">
            {/* Pickup Area */}
            <label className="filter-select-wrap has-left-icon">
              <i className="left-ico">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M12 21s6-5.6 6-10.5A6 6 0 0 0 6 10.5C6 15.4 12 21 12 21z" />
                  <circle cx="12" cy="10.5" r="2.2" />
                </svg>
              </i>
              <select
                value={selectedArea}
                onChange={(e) => setSelectedArea(e.target.value)}
                aria-label="Pickup area"
              >
                <option value="">Pickup area</option>
                {PICKUP_AREAS.map((a) => (
                  <option key={a} value={a}>
                    {a}
                  </option>
                ))}
              </select>
              <i className="right-ico">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M6 9l6 6 6-6" />
                </svg>
              </i>
            </label>

            {/* Rental Dates Popover Picker */}
            <div className="date-filter-wrap" ref={dateFilterRef}>
              <button
                type="button"
                className={`date-picker-wrap ${rentalStartDate ? 'on' : ''}`}
                aria-expanded={showDatePopover}
                aria-label="Rental dates"
                onClick={() => setShowDatePopover((prev) => !prev)}
              >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="3" y="4" width="18" height="18" rx="2" />
                  <path d="M16 2v4M8 2v4M3 10h18" />
                </svg>
                <span>
                  {rentalStartDate
                    ? rentalEndDate && rentalEndDate !== rentalStartDate
                      ? `${formatShortDate(rentalStartDate)} – ${formatShortDate(rentalEndDate)} (${rentalDaysCount}d)`
                      : `${formatShortDate(rentalStartDate)} (1d)`
                    : 'Rental dates'}
                </span>
              </button>
              {rentalStartDate && (
                <button
                  type="button"
                  className="date-clear-btn"
                  aria-label="Clear rental dates"
                  title="Clear rental dates"
                  onClick={() => {
                    setRentalStartDate('');
                    setRentalEndDate('');
                    setShowDatePopover(false);
                  }}
                >
                  ×
                </button>
              )}

              {showDatePopover && (
                <div className="date-popover" role="dialog" aria-label="Select rental dates">
                  <div className="date-popover-title">Select rental dates</div>
                  <div className="date-presets">
                    <button
                      type="button"
                      className="date-preset-chip"
                      onClick={() => {
                        const base = todayIso || getClientTodayIso();
                        setRentalStartDate(base);
                        setRentalEndDate(base);
                        setShowDatePopover(false);
                      }}
                    >
                      Today (1d)
                    </button>
                    <button
                      type="button"
                      className="date-preset-chip"
                      onClick={() => {
                        const base = todayIso || getClientTodayIso();
                        const tmrw = addDaysIso(base, 1);
                        setRentalStartDate(tmrw);
                        setRentalEndDate(tmrw);
                        setShowDatePopover(false);
                      }}
                    >
                      Tomorrow
                    </button>
                    <button
                      type="button"
                      className="date-preset-chip"
                      onClick={() => {
                        const base = todayIso || getClientTodayIso();
                        setRentalStartDate(base);
                        setRentalEndDate(addDaysIso(base, 2));
                        setShowDatePopover(false);
                      }}
                    >
                      Next 3 days
                    </button>
                    <button
                      type="button"
                      className="date-preset-chip"
                      onClick={() => {
                        const base = todayIso || getClientTodayIso();
                        setRentalStartDate(base);
                        setRentalEndDate(addDaysIso(base, 6));
                        setShowDatePopover(false);
                      }}
                    >
                      Next 7 days
                    </button>
                  </div>

                  <div className="date-inputs-grid">
                    <div className="date-field">
                      <label htmlFor="mp-rental-start">Start date</label>
                      <input
                        id="mp-rental-start"
                        type="date"
                        min={effectiveTodayIso}
                        value={rentalStartDate}
                        onChange={(e) => {
                          const nextStart = e.target.value;
                          setRentalStartDate(nextStart);
                          if (!nextStart) {
                            setRentalEndDate('');
                          } else if (!rentalEndDate || rentalEndDate < nextStart) {
                            setRentalEndDate(nextStart);
                          }
                        }}
                      />
                    </div>
                    <div className="date-field">
                      <label htmlFor="mp-rental-end">Return date</label>
                      <input
                        id="mp-rental-end"
                        type="date"
                        min={rentalStartDate || effectiveTodayIso}
                        value={rentalEndDate || rentalStartDate}
                        onChange={(e) => {
                          const nextEnd = e.target.value;
                          if (!rentalStartDate && nextEnd) {
                            setRentalStartDate(nextEnd);
                          }
                          setRentalEndDate(nextEnd);
                        }}
                      />
                    </div>
                  </div>

                  {rentalStartDate && (
                    <div className="date-popover-summary">
                      {rentalDaysCount} {rentalDaysCount === 1 ? 'day' : 'days'} selected · Showing items supporting {rentalDaysCount}+ {rentalDaysCount === 1 ? 'day' : 'days'}
                    </div>
                  )}

                  <div className="date-popover-actions">
                    <button
                      type="button"
                      className="btn outline"
                      onClick={() => {
                        setRentalStartDate('');
                        setRentalEndDate('');
                        setShowDatePopover(false);
                      }}
                    >
                      Clear
                    </button>
                    <button
                      type="button"
                      className="btn"
                      onClick={() => setShowDatePopover(false)}
                    >
                      Apply
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Price Per Day */}
            <label className="filter-select-wrap">
              <select
                value={selectedPriceMax}
                onChange={(e) => setSelectedPriceMax(e.target.value)}
                aria-label="Price per day"
              >
                <option value="">Price per day</option>
                <option value="25">Up to 25 tokens</option>
                <option value="50">Up to 50 tokens</option>
                <option value="80">Up to 80 tokens</option>
              </select>
              <i className="right-ico">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M6 9l6 6 6-6" />
                </svg>
              </i>
            </label>

            {/* Availability */}
            <label className="filter-select-wrap">
              <select
                value={selectedAvailability}
                onChange={(e) => setSelectedAvailability(e.target.value)}
                aria-label="Availability"
              >
                <option value="now">Available now</option>
                <option value="any">Any time</option>
              </select>
              <i className="right-ico">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M6 9l6 6 6-6" />
                </svg>
              </i>
            </label>

            <span className="spacer-flex" />

            {/* Sort Dropdown */}
            <label className="filter-select-wrap">
              <select
                value={selectedSort}
                onChange={(e) => setSelectedSort(e.target.value)}
                aria-label="Sort"
              >
                <option value="rec">Sort: Recommended</option>
                <option value="lo">Price: low to high</option>
                <option value="hi">Price: high to low</option>
              </select>
              <i className="right-ico">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M6 9l6 6 6-6" />
                </svg>
              </i>
            </label>
          </div>

          {/* Category Chips */}
          <div className="chips-row">
            {CATEGORIES.map((cat) => (
              <button
                key={cat}
                type="button"
                className={`chip-pill ${cat === selectedCategory ? 'on' : ''}`}
                onClick={() => setSelectedCategory(cat)}
              >
                {cat}
              </button>
            ))}
          </div>
        </section>

        {/* Section Title & Counter */}
        <div className="section-bar">
          <h2>Available around campus</h2>
          <span>{filteredItems.length} {filteredItems.length === 1 ? 'item' : 'items'} · {resolvedUser.university} students only</span>
        </div>

        {/* 3-Column Shelf Grid */}
        <div className="shelf-grid">
          {filteredItems.length > 0 ? (
            filteredItems.map((item) => (
              <article
                key={item.id}
                className="shelf-card"
                onClick={() => handleOpenItem(item)}
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleOpenItem(item);
                }}
              >
                {/* Image Wrap */}
                <div className="card-img-wrap">
                  <Image
                    src={item.image}
                    alt={item.name}
                    fill
                    sizes="(max-width: 600px) 100vw, (max-width: 900px) 50vw, 360px"
                    style={{ objectFit: 'cover' }}
                    unoptimized={item.image.startsWith('data:')}
                  />
                  <span className="avail-pill">
                    {rentalStartDate
                      ? rentalEndDate && rentalEndDate !== rentalStartDate
                        ? `Free ${formatShortDate(rentalStartDate)}–${formatShortDate(rentalEndDate)}`
                        : `Free ${formatShortDate(rentalStartDate)}`
                      : 'Available today'}
                  </span>
                  <button
                    type="button"
                    className={`fav-btn ${favorites[item.name] ? 'on' : ''}`}
                    onClick={(e) => toggleFavorite(item.name, e)}
                    aria-label={`Save ${item.name} to favorites`}
                    aria-pressed={!!favorites[item.name]}
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M12 20s-7-4.4-7-10a4.2 4.2 0 0 1 7-3 4.2 4.2 0 0 1 7 3c0 5.6-7 10-7 10z" />
                    </svg>
                  </button>
                </div>

                {/* Content Body */}
                <div className="card-body">
                  <small className="cat-tag">{item.category}</small>
                  <h3>{item.name}</h3>

                  <div className="price-line">
                    <b>{item.price}</b>
                    <span>tokens / day</span>
                  </div>

                  <div className="dep-text">
                    {rentalDaysCount
                      ? `${rentalDaysCount}d est: ${item.price * rentalDaysCount} tokens · ${item.deposit} deposit`
                      : `${item.deposit} tokens refundable deposit${item.maxRentalDays ? ` · Max ${item.maxRentalDays}d` : ''}`}
                  </div>

                  <div className="loc-badge">
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M12 21s6-5.6 6-10.5A6 6 0 0 0 6 10.5C6 15.4 12 21 12 21z" />
                      <circle cx="12" cy="10.5" r="2.2" />
                    </svg>
                    <span>{item.area}</span>
                  </div>

                  {/* Owner Row */}
                  <div className="owner-strip">
                    <span className="owner-avatar">{item.initials}</span>
                    <div className="owner-info">
                      <strong>{item.owner}</strong>
                      <small>Verified {resolvedUser.university} student</small>
                    </div>
                    <svg
                      className="verified-check"
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.5"
                    >
                      <path d="M20 6L9 17l-5-5" />
                    </svg>
                  </div>
                </div>
              </article>
            ))
          ) : (
            <div className="empty-state">
              {selectedTab === 'fav' ? (
                'No favorites yet. Tap the heart on any item to save it here.'
              ) : selectedTab === 'recent' ? (
                'Nothing viewed yet. Items you open will show up here.'
              ) : selectedTab === 'mine' ? (
                <span>
                  You haven&apos;t published an item yet.{' '}
                  <Link href="/marketplace/list" style={{ color: 'var(--brand)', fontWeight: 700, textDecoration: 'underline' }}>
                    List your first item →
                  </Link>
                </span>
              ) : (
                'No items match your active filters. Try another category, date range, or clear your search query.'
              )}
            </div>
          )}
        </div>

        {/* Informational Campus Borrowing Guide */}
        <div className="guide-card">
          <h3>A little borrowing goes a long way.</h3>
          <p>
            Choose your dates, send a request, then meet the owner in a public campus spot. Check the item
            together and confirm the return to release your deposit. Want to earn tokens from gear you already own?{' '}
            <Link href="/marketplace/list" style={{ color: 'var(--brand)', fontWeight: 700, textDecoration: 'underline' }}>
              List an item
            </Link>{' '}
            or{' '}
            <Link href="/my-products" style={{ color: 'var(--brand)', fontWeight: 700, textDecoration: 'underline' }}>
              manage your listings in My Products →
            </Link>
          </p>
        </div>
      </main>

      {/* Footer */}
      <footer>
        <div className="wrap">
          <span>UniShare. Made for university students in Bangladesh.</span>
          <span>
            <a href="#">Privacy</a>
            <a href="#">Terms</a>
            <a href="#">Get help</a>
            <button
              type="button"
              className="logout-link"
              onClick={handleLogout}
            >
              Log out
            </button>
          </span>
        </div>
      </footer>

      {/* Floating Toast Notification */}
      <div className={`toast-alert ${toastVisible ? 'show' : ''}`} role="status">
        {toastMessage}
      </div>
    </div>
  );
}

