'use strict';
'use client';

import React, { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import {
  DEFAULT_ITEMS,
  CATEGORIES,
  PICKUP_AREAS,
  MarketplaceItem,
  UserProfile,
} from './marketplace-data';
import './marketplace.css';

export default function MarketplacePage() {
  const router = useRouter();

  // Authentication State
  const [user, setUser] = useState<UserProfile | null>(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [showProfileMenu, setShowProfileMenu] = useState(false);

  // Marketplace State
  const [items, setItems] = useState<MarketplaceItem[]>(DEFAULT_ITEMS);
  const [selectedTab, setSelectedTab] = useState<'all' | 'fav' | 'recent' | 'you'>('all');
  const [selectedCategory, setSelectedCategory] = useState('All items');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedArea, setSelectedArea] = useState('');
  const [selectedPriceMax, setSelectedPriceMax] = useState('');
  const [selectedAvailability, setSelectedAvailability] = useState('now');
  const [selectedSort, setSelectedSort] = useState('rec');
  const [rentalDate, setRentalDate] = useState('');

  // Favorites & Recently Viewed State
  const [favorites, setFavorites] = useState<Record<string, boolean>>({});
  const [recentlyViewed, setRecentlyViewed] = useState<string[]>([]);

  // Modals & Toast State
  const [showListItemModal, setShowListItemModal] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [toastVisible, setToastVisible] = useState(false);

  // New Listing Form State
  const [newItemName, setNewItemName] = useState('');
  const [newItemCategory, setNewItemCategory] = useState('Calculators');
  const [newItemPrice, setNewItemPrice] = useState(30);
  const [newItemDeposit, setNewItemDeposit] = useState(80);
  const [newItemArea, setNewItemArea] = useState('TSC');
  const [newItemDesc, setNewItemDesc] = useState('');

  // Toast Helper
  const showToast = (msg: string) => {
    setToastMessage(msg);
    setToastVisible(true);
    setTimeout(() => {
      setToastVisible(false);
    }, 2400);
  };

  // Auth Initialization & LocalStorage on Client Mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem('unishare_user');
      const isLoggedIn =
        localStorage.getItem('unishare_logged_in') === 'true' ||
        document.cookie.includes('unishare_logged_in=true') ||
        document.cookie.includes('unishare_token=');

      if (stored) {
        setUser(JSON.parse(stored));
      } else if (isLoggedIn) {
        // Fallback profile if session cookie/flag exists
        const fallbackUser: UserProfile = {
          name: 'Farhana Rahman',
          email: 'farhana@std.du.ac.bd',
          initials: 'FR',
          university: 'University of Dhaka',
          verified: true,
          department: 'Computer Science & Engineering',
          tokenBalance: 420,
        };
        setUser(fallbackUser);
        localStorage.setItem('unishare_user', JSON.stringify(fallbackUser));
      }

      // Load saved favorites
      const storedFavs = localStorage.getItem('unishare_favorites');
      if (storedFavs) {
        setFavorites(JSON.parse(storedFavs));
      }

      // Load recently viewed
      const storedRecent = localStorage.getItem('unishare_recently_viewed');
      if (storedRecent) {
        setRecentlyViewed(JSON.parse(storedRecent));
      }

      // Load custom listed items
      const storedItems = localStorage.getItem('unishare_marketplace_items');
      if (storedItems) {
        setItems(JSON.parse(storedItems));
      }
    } catch (e) {
      console.error(e);
    } finally {
      setAuthChecked(true);
    }
  }, []);

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

  // Toggle Favorite
  const toggleFavorite = (itemName: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setFavorites((prev) => {
      const updated = { ...prev, [itemName]: !prev[itemName] };
      try {
        localStorage.setItem('unishare_favorites', JSON.stringify(updated));
      } catch (err) {
        console.error(err);
      }
      showToast(updated[itemName] ? `Added "${itemName}" to Favorites` : `Removed from Favorites`);
      return updated;
    });
  };

  // Open Item Detail - Direct move to product details page
  const handleOpenItem = (item: MarketplaceItem) => {
    try {
      const storedRecent = localStorage.getItem('unishare_recently_viewed');
      const list: string[] = storedRecent ? JSON.parse(storedRecent) : [];
      const updated = [item.name, ...list.filter((n) => n !== item.name)].slice(0, 10);
      localStorage.setItem('unishare_recently_viewed', JSON.stringify(updated));
    } catch (e) {
      console.error(e);
    }
    setRecentlyViewed((prev) => [item.name, ...prev.filter((n) => n !== item.name)]);
    router.push(`/product-details/${item.id}`);
  };

  // Submit New Listing
  const handleCreateListing = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newItemName.trim()) return;

    const newItem: MarketplaceItem = {
      id: Date.now().toString(),
      name: newItemName.trim(),
      category: newItemCategory,
      price: Number(newItemPrice) || 20,
      deposit: Number(newItemDeposit) || 50,
      area: newItemArea,
      owner: user ? user.name : 'Farhana Rahman',
      initials: user ? user.initials : 'FR',
      image: '/images/landing/calculator.jpeg',
      available: true,
      description: newItemDesc.trim() || 'Listed by verified DU student.',
    };

    setItems((prev) => {
      const updated = [newItem, ...prev];
      try {
        localStorage.setItem('unishare_marketplace_items', JSON.stringify(updated));
      } catch (err) {
        console.error(err);
      }
      return updated;
    });
    setShowListItemModal(false);
    setNewItemName('');
    setNewItemDesc('');
    showToast(`"${newItem.name}" added to campus shelf!`);
  };

  // Filter and Sort Items
  const filteredItems = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();

    const list = items.filter((x) => {
      // Tab filter
      if (selectedTab === 'fav' && !favorites[x.name]) return false;
      if (selectedTab === 'recent' && !recentlyViewed.includes(x.name)) return false;

      // Category filter
      if (selectedCategory !== 'All items' && x.category !== selectedCategory) return false;

      // Pickup Area filter
      if (selectedArea && x.area !== selectedArea) return false;

      // Price filter
      if (selectedPriceMax && x.price > Number(selectedPriceMax)) return false;

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
    selectedSort,
    selectedTab,
    favorites,
    recentlyViewed,
  ]);

  // Auth Gate: Shown if user has not logged in
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
      {/* Top Header */}
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
            <a href="#" onClick={(e) => { e.preventDefault(); showToast('My rentals: 0 active rentals.'); }}>
              My rentals
            </a>
            <Link href="/rides">
              Rides
            </Link>
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

              {/* Profile Popover Dropdown */}
              {showProfileMenu && (
                <div className="profile-popover">
                  <div className="user-meta">
                    <div style={{ fontWeight: 700, fontSize: 13.5 }}>{user?.name}</div>
                    <div style={{ fontSize: 11.5, color: 'var(--muted)' }}>{user?.email}</div>
                    <div style={{ fontSize: 11.5, color: 'var(--brand)', fontWeight: 700, marginTop: 4 }}>
                      Verified DU Student · {user?.tokenBalance || 420} Tokens
                    </div>
                  </div>
                  <button onClick={() => { setShowProfileMenu(false); showToast('Opened Student Profile'); }}>
                    My Profile
                  </button>
                  <button onClick={() => { setShowProfileMenu(false); setShowListItemModal(true); }}>
                    List an item
                  </button>
                  <div style={{ height: 1, background: 'var(--hair)', margin: '4px 0' }} />
                  <button
                    onClick={handleLogout}
                    style={{ color: 'var(--err)', fontWeight: 700 }}
                  >
                    Log out
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Main Body */}
      <main className="wrap">
        {/* Breadcrumb Navigation */}
        <nav className="crumb" aria-label="Breadcrumb">
          <Link href="/">Home</Link>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path d="M9 18l6-6-6-6" />
          </svg>
          <span style={{ fontWeight: 700, color: 'var(--ink)' }}>Marketplace</span>
        </nav>

        {/* Hero Section */}
        <div className="kicker">UNIVERSITY OF DHAKA · VERIFIED STUDENTS ONLY</div>
        <div className="hero-row">
          <div>
            <h1>Your campus, one shared shelf.</h1>
            <p className="hero-sub">Borrow what you need. Lend what you have. All from verified DU students.</p>
          </div>
          <button className="btn" onClick={() => setShowListItemModal(true)}>
            List an item
          </button>
        </div>

        {/* Campus Verification Trust Banner */}
        <div className="trust-banner">
          <svg className="shield-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M12 3l8 3v6c0 4.5-3.4 8-8 9-4.6-1-8-4.5-8-9V6l8-3z" />
            <path d="M9 12l2 2 4-4" />
          </svg>
          <div className="banner-text">
            <b>Only your university. Always a verified student.</b>
            <p>Every item here belongs to a University of Dhaka student. Meet on campus and pay with tokens.</p>
          </div>
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

            {/* Rental Dates Datepicker */}
            <label className="date-picker-wrap">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="8.5" />
                <path d="M12 7.5V12l3 2" />
              </svg>
              <span>
                {rentalDate
                  ? new Date(rentalDate + 'T00:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
                  : 'Rental dates'}
              </span>
              <input
                type="date"
                value={rentalDate}
                onChange={(e) => {
                  setRentalDate(e.target.value);
                  if (e.target.value) {
                    showToast(`Selected date: ${e.target.value}`);
                  }
                }}
                aria-label="Rental date"
              />
            </label>

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
          <span>{filteredItems.length} {filteredItems.length === 1 ? 'item' : 'items'} · DU students only</span>
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
                  />
                  <span className="avail-pill">Available today</span>
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

                  <div className="dep-text">{item.deposit} tokens refundable deposit</div>

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
                      <small>Verified DU student</small>
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
              {selectedTab === 'fav'
                ? 'No favorites yet. Tap the heart on any item to save it here.'
                : selectedTab === 'recent'
                ? 'Nothing viewed yet. Items you open will show up here.'
                : 'No items match your active filters. Try another category or clear your search query.'}
            </div>
          )}
        </div>

        {/* Informational Campus Borrowing Guide */}
        <div className="guide-card">
          <h3>A little borrowing goes a long way.</h3>
          <p>
            Choose your dates, send a request, then meet the owner in a public campus spot. Check the item
            together and confirm the return to release your deposit.
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

      {/* "List an item" Modal */}
      {showListItemModal && (
        <div className="unishare-modal-overlay" onClick={() => setShowListItemModal(false)}>
          <div className="unishare-modal-card" onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              className="close-btn"
              onClick={() => setShowListItemModal(false)}
              aria-label="Close"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>

            <div className="kicker" style={{ marginTop: 0 }}>PEER-TO-PEER LENDING</div>
            <h2>List an item for borrowing</h2>
            <p className="modal-sub">Earn tokens by sharing your gadget, sports gear, or book with DU peers.</p>

            <form onSubmit={handleCreateListing}>
              <div className="form-group">
                <label>Item Title</label>
                <input
                  type="text"
                  placeholder="e.g. Scientific calculator fx-991EX"
                  value={newItemName}
                  onChange={(e) => setNewItemName(e.target.value)}
                  required
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div className="form-group">
                  <label>Category</label>
                  <select
                    value={newItemCategory}
                    onChange={(e) => setNewItemCategory(e.target.value)}
                  >
                    {CATEGORIES.filter((c) => c !== 'All items').map((cat) => (
                      <option key={cat} value={cat}>
                        {cat}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label>Pickup Spot</label>
                  <select
                    value={newItemArea}
                    onChange={(e) => setNewItemArea(e.target.value)}
                  >
                    {PICKUP_AREAS.map((ar) => (
                      <option key={ar} value={ar}>
                        {ar}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div className="form-group">
                  <label>Tokens / day</label>
                  <input
                    type="number"
                    min="5"
                    max="500"
                    value={newItemPrice}
                    onChange={(e) => setNewItemPrice(Number(e.target.value))}
                    required
                  />
                </div>

                <div className="form-group">
                  <label>Refundable Deposit</label>
                  <input
                    type="number"
                    min="10"
                    max="1000"
                    value={newItemDeposit}
                    onChange={(e) => setNewItemDeposit(Number(e.target.value))}
                    required
                  />
                </div>
              </div>

              <div className="form-group">
                <label>Item Description & Notes</label>
                <textarea
                  rows={2}
                  placeholder="Condition, included cables/accessories, preferred meetup time..."
                  value={newItemDesc}
                  onChange={(e) => setNewItemDesc(e.target.value)}
                />
              </div>

              <button
                type="submit"
                className="btn"
                style={{ width: '100%', height: 46, fontSize: 15, marginTop: 8 }}
              >
                Publish to Campus Shelf
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Floating Toast Notification */}
      <div className={`toast-alert ${toastVisible ? 'show' : ''}`} role="status">
        {toastMessage}
      </div>
    </div>
  );
}

