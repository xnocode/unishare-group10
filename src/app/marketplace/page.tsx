'use strict';
'use client';

import React, { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import './marketplace.css';

interface MarketplaceItem {
  id: string;
  name: string;
  category: string;
  price: number;
  deposit: number;
  area: string;
  owner: string;
  initials: string;
  image: string;
  available: boolean;
  description?: string;
}

interface UserProfile {
  name: string;
  email: string;
  initials: string;
  university: string;
  verified: boolean;
  department?: string;
  studentId?: string;
  tokenBalance?: number;
}

const DEFAULT_ITEMS: MarketplaceItem[] = [
  {
    id: '1',
    name: 'Scientific calculator',
    category: 'Calculators',
    price: 40,
    deposit: 100,
    area: 'Science Library',
    owner: 'Nafis Ahmed',
    initials: 'NA',
    image: '/images/landing/calculator.jpeg',
    available: true,
    description: 'Casio fx-991EX ClassWiz. Ideal for engineering, physics, and calculus exams.',
  },
  {
    id: '2',
    name: 'Match-day football',
    category: 'Footballs',
    price: 60,
    deposit: 100,
    area: 'DU Central Field',
    owner: 'Sakib Hasan',
    initials: 'SH',
    image: '/images/landing/football.jpeg',
    available: true,
    description: 'FIFA standard size 5 match ball. Excellent grip, pumped and ready for match-day.',
  },
  {
    id: '3',
    name: 'Laptop charger · 65W',
    category: 'Laptop chargers',
    price: 50,
    deposit: 100,
    area: 'TSC',
    owner: 'Maliha Islam',
    initials: 'MI',
    image: '/images/landing/laptop-charger.jpeg',
    available: true,
    description: 'Type-C 65W fast charger compatible with MacBook, Dell XPS, HP, Asus and Lenovo.',
  },
  {
    id: '4',
    name: 'AirPods with charging case',
    category: 'AirPods',
    price: 80,
    deposit: 150,
    area: 'Arts Building',
    owner: 'Rafiul Karim',
    initials: 'RK',
    image: '/images/landing/airpods.jpeg',
    available: true,
    description: 'Noise-cancelling wireless earbuds with sanitized silicone tips and full charge.',
  },
  {
    id: '5',
    name: 'Phone charger · 45W',
    category: 'Phone chargers',
    price: 25,
    deposit: 50,
    area: 'Curzon Hall',
    owner: 'Nusrat Jahan',
    initials: 'NJ',
    image: '/images/landing/phone-charger.jpeg',
    available: true,
    description: 'Fast dual-port USB-C & USB-A wall adapter with braided charging cable.',
  },
  {
    id: '6',
    name: 'Wired earphones',
    category: 'Earphones',
    price: 20,
    deposit: 50,
    area: 'Central Library',
    owner: 'Tanvir Ahmed',
    initials: 'TA',
    image: '/images/landing/earphones.jpeg',
    available: true,
    description: '3.5mm jack with built-in mic. Crisp audio for online lectures and quiet study halls.',
  },
];

const CATEGORIES = [
  'All items',
  'Calculators',
  'Footballs',
  'Laptop chargers',
  'Phone chargers',
  'Earphones',
  'AirPods',
  'Cameras',
];

const PICKUP_AREAS = [
  'Science Library',
  'DU Central Field',
  'TSC',
  'Arts Building',
  'Curzon Hall',
  'Central Library',
  'Shahidullah Hall',
  'Mokarram Bhaban',
];

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
  const [activeItemModal, setActiveItemModal] = useState<MarketplaceItem | null>(null);
  const [rentalDays, setRentalDays] = useState(1);
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

  // Auth Initialization on Client Mount
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
      showToast(updated[itemName] ? `Added "${itemName}" to Favorites` : `Removed from Favorites`);
      return updated;
    });
  };

  // Open Item Detail
  const handleOpenItem = (item: MarketplaceItem) => {
    setActiveItemModal(item);
    setRentalDays(1);
    setRecentlyViewed((prev) => [item.name, ...prev.filter((n) => n !== item.name)]);
  };

  // Submit Borrow Request
  const handleBorrowRequest = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeItemModal) return;
    const totalTokens = activeItemModal.price * rentalDays;
    showToast(`Borrow request sent to ${activeItemModal.owner}! (${totalTokens} tokens)`);
    setActiveItemModal(null);
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

    setItems((prev) => [newItem, ...prev]);
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
          <Link href="/" className="logo">
            <svg
              width="22"
              height="14"
              viewBox="0 0 22 14"
              fill="none"
              stroke="#0B5D5E"
              strokeWidth="2.4"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <circle cx="6.5" cy="7" r="4.5" />
              <circle cx="15.5" cy="7" r="4.5" />
            </svg>
            <span>UniShare</span>
          </Link>

          <nav className="menu" aria-label="Main Navigation">
            <Link href="/">Home</Link>
            <Link className="on" href="/marketplace">
              Marketplace
            </Link>
            <a href="#" onClick={(e) => { e.preventDefault(); showToast('My products: 0 active listings.'); }}>
              My products
            </a>
            <a href="#" onClick={(e) => { e.preventDefault(); showToast('My rentals: 0 active rentals.'); }}>
              My rentals
            </a>
            <a href="#" onClick={(e) => { e.preventDefault(); showToast('Campus Rides: Opening for DU students soon.'); }}>
              Rides
            </a>
            <a href="#" onClick={(e) => { e.preventDefault(); showToast(`Token Wallet: ${user?.tokenBalance || 420} tokens available`); }}>
              Wallet
            </a>
            <a
              href="#"
              onClick={(e) => {
                e.preventDefault();
                setSelectedTab('fav');
              }}
            >
              Favorites
            </a>
          </nav>

          <div className="rt">
            {/* Notification Bell */}
            <button
              className="bell-btn"
              aria-label="Notifications"
              onClick={() => showToast('Notifications: Student verification status is 100% active.')}
            >
              <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M6 16V11a6 6 0 0 1 12 0v5l1.5 2h-15zM10 21h4" />
              </svg>
              <span className="dot" />
            </button>

            {/* SOS Safety Button */}
            <button
              className="sos-btn"
              onClick={() => showToast('DU Campus Safety Hotline: 01700-000000 · Proctor Office')}
              title="DU Campus Safety Hotline"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                <path d="M12 3l8 3v6c0 4.5-3.4 8-8 9-4.6-1-8-4.5-8-9V6l8-3z" />
                <path d="M9 12l2 2 4-4" />
              </svg>
              <span>SOS</span>
            </button>

            {/* User Profile Pill */}
            <div style={{ position: 'relative' }}>
              <div
                className="me-pill"
                onClick={() => setShowProfileMenu(!showProfileMenu)}
                title="Account options"
              >
                <span className="av">{user?.initials || 'FR'}</span>
                <div>
                  <b>{user?.name || 'Farhana Rahman'}</b>
                  <small>My profile</small>
                </div>
                <svg
                  width="12"
                  height="12"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.2"
                  style={{ color: 'var(--muted)', marginLeft: 2 }}
                >
                  <path d="M6 9l6 6 6-6" />
                </svg>
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

      {/* Item Details & Borrow Request Modal */}
      {activeItemModal && (
        <div className="unishare-modal-overlay" onClick={() => setActiveItemModal(null)}>
          <div className="unishare-modal-card" onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              className="close-btn"
              onClick={() => setActiveItemModal(null)}
              aria-label="Close"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>

            <div style={{ position: 'relative', height: 160, borderRadius: 10, overflow: 'hidden', marginBottom: 16, border: '1.5px solid var(--line)' }}>
              <Image
                src={activeItemModal.image}
                alt={activeItemModal.name}
                fill
                sizes="(max-width: 600px) 100vw, 480px"
                style={{ objectFit: 'cover' }}
              />
              <span className="avail-pill" style={{ top: 10, left: 10 }}>Available on Campus</span>
            </div>

            <div className="kicker" style={{ marginTop: 0 }}>{activeItemModal.category}</div>
            <h2>{activeItemModal.name}</h2>
            <p className="modal-sub">{activeItemModal.description}</p>

            <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px', background: 'var(--field)', borderRadius: 10, border: '1.5px solid var(--line)', marginBottom: 16 }}>
              <span style={{ width: 32, height: 32, borderRadius: '50%', background: 'var(--tint)', color: 'var(--brand)', display: 'grid', placeItems: 'center', fontWeight: 700, border: '1.5px solid var(--brand)' }}>
                {activeItemModal.initials}
              </span>
              <div>
                <strong style={{ display: 'block', fontSize: 13.5 }}>{activeItemModal.owner}</strong>
                <small style={{ color: 'var(--muted)', fontSize: 12 }}>Verified DU Student · Pickup at {activeItemModal.area}</small>
              </div>
            </div>

            <form onSubmit={handleBorrowRequest}>
              <div className="form-group">
                <label>Rental Duration (Days)</label>
                <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                  <button
                    type="button"
                    className="btn outline"
                    style={{ padding: '6px 14px', fontSize: 16, height: 38 }}
                    onClick={() => setRentalDays(Math.max(1, rentalDays - 1))}
                  >
                    -
                  </button>
                  <span style={{ fontWeight: 800, fontSize: 16, minWidth: 40, textAlign: 'center' }}>
                    {rentalDays} {rentalDays === 1 ? 'day' : 'days'}
                  </span>
                  <button
                    type="button"
                    className="btn outline"
                    style={{ padding: '6px 14px', fontSize: 16, height: 38 }}
                    onClick={() => setRentalDays(Math.min(14, rentalDays + 1))}
                  >
                    +
                  </button>
                </div>
              </div>

              <div className="calc-box">
                <div className="calc-row">
                  <span>Daily Rate</span>
                  <b>{activeItemModal.price} tokens / day</b>
                </div>
                <div className="calc-row">
                  <span>Refundable Deposit</span>
                  <b>{activeItemModal.deposit} tokens</b>
                </div>
                <div className="calc-row final">
                  <span>Total Tokens Required</span>
                  <b>{activeItemModal.price * rentalDays + activeItemModal.deposit} tokens</b>
                </div>
              </div>

              <button
                type="submit"
                className="btn"
                style={{ width: '100%', height: 46, fontSize: 15 }}
              >
                Request to Borrow
              </button>
            </form>
          </div>
        </div>
      )}

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

