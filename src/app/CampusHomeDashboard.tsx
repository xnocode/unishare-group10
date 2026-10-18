"use client";

import React, { useState, useMemo, useEffect } from "react";
import Link from "next/link";
import AppNavbar from "./components/AppNavbar";
import "./campus-home.css";

interface ProductItem {
  n: string;
  c: string;
  p: number;
  a: string;
  o: string;
  i: string;
  imgVar: string;
}

const ITEMS: ProductItem[] = [
  {
    n: "Scientific calculator",
    c: "Calculators",
    p: 40,
    a: "Science Library",
    o: "Nafis Ahmed",
    i: "NA",
    imgVar: "var(--img-calc)",
  },
  {
    n: "Match-day football",
    c: "Footballs",
    p: 60,
    a: "DU Central Field",
    o: "Sakib Hasan",
    i: "SH",
    imgVar: "var(--img-ball)",
  },
  {
    n: "Laptop charger · 65W",
    c: "Laptop chargers",
    p: 50,
    a: "TSC",
    o: "Maliha Islam",
    i: "MI",
    imgVar: "var(--img-chg)",
  },
  {
    n: "AirPods with charging case",
    c: "AirPods",
    p: 80,
    a: "Arts Building",
    o: "Rafiul Karim",
    i: "RK",
    imgVar: "var(--img-pods)",
  },
];

const CATEGORIES = [
  "All items",
  "Calculators",
  "Footballs",
  "Laptop chargers",
  "Phone chargers",
  "Earphones",
  "AirPods",
  "Cameras",
];

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

export default function CampusHomeDashboard({ onLogout }: CampusHomeProps) {
  const [selectedCat, setSelectedCat] = useState("All items");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedArea, setSelectedArea] = useState("");
  const [selectedPrice, setSelectedPrice] = useState("");
  const [availOnly, setAvailOnly] = useState(true);
  const [sortBy, setSortBy] = useState("rec");
  const [favorites, setFavorites] = useState<Record<string, boolean>>({});
  const [toastMsg, setToastMsg] = useState("");
  const [showToast, setShowToast] = useState(false);
  const [showProfileModal, setShowProfileModal] = useState(false);

  useEffect(() => {
    try {
      const stored = localStorage.getItem("unishare_favorites");
      if (stored) {
        setFavorites(JSON.parse(stored));
      }
    } catch (e) {
      console.error(e);
    }
  }, []);

  const pickupAreas = useMemo(() => {
    const set = new Set<string>();
    ITEMS.forEach((item) => set.add(item.a));
    return Array.from(set);
  }, []);

  const triggerToast = (msg: string) => {
    setToastMsg(msg);
    setShowToast(true);
    setTimeout(() => {
      setShowToast(false);
    }, 1800);
  };

  const toggleFavorite = (itemName: string) => {
    const isFav = !favorites[itemName];
    const updated = { ...favorites, [itemName]: isFav };
    setFavorites(updated);
    try {
      localStorage.setItem("unishare_favorites", JSON.stringify(updated));
    } catch (e) {
      console.error(e);
    }
    triggerToast(isFav ? "Added to Favorites" : "Removed from Favorites");
  };

  const filteredItems = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    const result = ITEMS.filter((x) => {
      const matchCat = selectedCat === "All items" || x.c === selectedCat;
      const matchArea = !selectedArea || x.a === selectedArea;
      const matchPrice = !selectedPrice || x.p <= Number(selectedPrice);
      const matchQ =
        !q || `${x.n} ${x.c} ${x.o} ${x.a}`.toLowerCase().includes(q);
      return matchCat && matchArea && matchPrice && matchQ;
    });

    if (sortBy === "lo") {
      result.sort((a, b) => a.p - b.p);
    } else if (sortBy === "hi") {
      result.sort((a, b) => b.p - a.p);
    }
    return result;
  }, [selectedCat, searchQuery, selectedArea, selectedPrice, sortBy]);

  const handleLogoutClick = (e: React.MouseEvent) => {
    e.preventDefault();
    if (onLogout) {
      onLogout();
    } else {
      try {
        localStorage.removeItem("unishare_logged_in");
        localStorage.removeItem("unishare_user");
        document.cookie = "unishare_logged_in=; path=/; max-age=0";
      } catch (err) {
        console.error(err);
      }
      window.location.href = "/";
    }
  };

  return (
    <div className="unishare-campus-home">
      <AppNavbar
        activeNav="home"
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
            <h1>Hello, Farhana.</h1>
            <p className="sub">What do you need for your campus day?</p>
          </div>
          <div className="acts">
            <Link className="btn solid" href="#">
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
            <b>University of Dhaka</b>
            <p>
              Only your university. Every item and ride here is from a verified
              DU student.
            </p>
          </div>
          <span>
            <SvgIcon name="check" size={12} />
            Verified student
            <SvgIcon name="lock" size={16} />
          </span>
        </div>

        {/* Stat Cards */}
        <div className="stats">
          <div className="stat">
            <small>Available tokens</small>
            <strong>500</strong>
            <p>Ready for your next booking</p>
          </div>
          <div className="stat">
            <small>Held deposits</small>
            <strong>100</strong>
            <p>1 active rental deposit</p>
          </div>
          <div className="stat">
            <small>Active rentals</small>
            <strong>1</strong>
            <p>1 item borrowed</p>
          </div>
          <div className="stat">
            <small>Live listings</small>
            <strong>2</strong>
            <p>2 items available for rent</p>
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
        <div className="search">
          <SvgIcon name="search" size={16} />
          <input
            id="q"
            type="search"
            placeholder="Search items, categories or owners"
            aria-label="Search items"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        {/* Panels */}
        <div className="tools">
          <div className="panel">
            <div className="ph">
              <span className="ic">
                <SvgIcon name="bell" size={18} />
              </span>
              <div>
                <b>Notifications</b>
                <small>3 unread updates</small>
              </div>
              <Link className="tag" href="/notifications">New</Link>
            </div>
            <div className="li">
              <span className="ck">
                <SvgIcon name="check" size={11} />
              </span>
              <div>
                <b>Pickup reminder for scientific calculator</b>
                <p>14 Oct · 9:10 AM · Pickup at Science Library today.</p>
              </div>
            </div>
            <div className="li">
              <span className="ck">
                <SvgIcon name="check" size={11} />
              </span>
              <div>
                <b>Car ride seat booked</b>
                <p>14 Oct · 9:18 AM · Arif Hossain · Dhanmondi 27 to TSC · 80 tokens / seat.</p>
              </div>
            </div>
            <div className="li">
              <span className="ck">
                <SvgIcon name="check" size={11} />
              </span>
              <div>
                <b>New request for Canon EOS 200D</b>
                <p>14 Oct · 9:22 AM · Review the request and respond from your listings.</p>
              </div>
            </div>
          </div>

          <div className="panel wal">
            <div className="ph">
              <span className="ic">
                <SvgIcon name="box" size={18} />
              </span>
              <div>
                <b>Wallet Access</b>
                <small>Open wallet</small>
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
                <small>2 updates</small>
              </div>
              <span className="tag">Today</span>
            </div>
            <div className="li">
              <span className="ck">
                <SvgIcon name="check" size={11} />
              </span>
              <div>
                <b>Scientific calculator rental confirmed</b>
                <p>14 Oct · 9:10 AM · 80 rental tokens charged; 100 held deposit.</p>
              </div>
            </div>
            <div className="li">
              <span className="ck">
                <SvgIcon name="check" size={11} />
              </span>
              <div>
                <b>Car ride seat booked</b>
                <p>14 Oct · 9:18 AM · Arif Hossain · 80 tokens / seat.</p>
              </div>
            </div>
          </div>
        </div>

        {/* Recommended Products */}
        <div className="sh" id="marketplace">
          <div>
            <h2>Recommended Products</h2>
            <p>A little borrowing goes a long way. Find your everyday essentials.</p>
          </div>
          <Link className="more" href="/marketplace">
            View all items <SvgIcon name="arrow" size={14} />
          </Link>
        </div>

        {/* Filter Controls */}
        <div className="filters">
          <label className="sel">
            <SvgIcon name="pin" size={13} />
            <select
              id="area"
              aria-label="Pickup area"
              value={selectedArea}
              onChange={(e) => setSelectedArea(e.target.value)}
            >
              <option value="">Pickup area</option>
              {pickupAreas.map((area) => (
                <option key={area} value={area}>
                  {area}
                </option>
              ))}
            </select>
            <SvgIcon name="chev" size={12} />
          </label>

          <label className="sel">
            <select
              id="price"
              aria-label="Price per day"
              style={{ paddingLeft: "12px" }}
              value={selectedPrice}
              onChange={(e) => setSelectedPrice(e.target.value)}
            >
              <option value="">Price per day</option>
              <option value="50">Up to 50 tokens</option>
              <option value="60">Up to 60 tokens</option>
              <option value="80">Up to 80 tokens</option>
            </select>
            <SvgIcon name="chev" size={12} />
          </label>

          <button
            className={`pillbtn ${availOnly ? "" : "off"}`}
            id="avail"
            aria-pressed={availOnly}
            onClick={() => setAvailOnly(!availOnly)}
          >
            Available now
          </button>

          <span className="fl-sp" />

          <label className="sel">
            <select
              id="sort"
              aria-label="Sort"
              style={{ paddingLeft: "12px" }}
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
            >
              <option value="rec">Sort: Recommended</option>
              <option value="lo">Price: low to high</option>
              <option value="hi">Price: high to low</option>
            </select>
            <SvgIcon name="chev" size={12} />
          </label>
        </div>

        {/* Category Chips */}
        <div className="chips" id="chips">
          {CATEGORIES.map((cat) => (
            <button
              key={cat}
              className={`chip ${cat === selectedCat ? "on" : ""}`}
              onClick={() => setSelectedCat(cat)}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* Items Grid */}
        <div className="grid" id="grid">
          {filteredItems.length > 0 ? (
            filteredItems.map((item) => {
              const isFav = !!favorites[item.n];
              return (
                <article key={item.n} className="pc">
                  <div
                    className="pim"
                    style={{ backgroundImage: item.imgVar }}
                  >
                    <span className="av-t">Available today</span>
                    <button
                      className={`heart ${isFav ? "on" : ""}`}
                      aria-label="Favorite"
                      aria-pressed={isFav}
                      onClick={() => toggleFavorite(item.n)}
                    >
                      <SvgIcon name="heart" size={13} />
                    </button>
                  </div>
                  <div className="pb">
                    <small>{item.c}</small>
                    <h3>{item.n}</h3>
                    <div className="pr">
                      <b>{item.p}</b>tokens / day
                    </div>
                    <div className="loc">
                      <SvgIcon name="pin" size={12} />
                      {item.a}
                    </div>
                    <div className="ow">
                      <span className="mini">{item.i}</span>
                      {item.o}
                      <SvgIcon name="check" size={12} />
                    </div>
                  </div>
                </article>
              );
            })
          ) : (
            <div className="empty">
              No items match right now. Try another category or clear your filters.
            </div>
          )}
        </div>

        {/* Upcoming Ride Card */}
        <div className="wide" id="rides">
          <div className="wh">
            <span className="ic">
              <SvgIcon name="car" size={18} />
            </span>
            <div>
              <b>Upcoming Ride</b>
              <small>Confirmed today</small>
            </div>
            <span className="tag">80 tokens / seat</span>
          </div>
          <div className="route">
            <div>
              <SvgIcon name="clock" size={15} />
              Dhanmondi 27
            </div>
            <div>
              <SvgIcon name="pin" size={13} />
              TSC, DU
            </div>
          </div>
          <div className="meta">
            <span>15 Oct · 8:30 AM</span>
            <span>Car · 2 seats left</span>
          </div>
          <div className="foot">
            <span className="ow" style={{ margin: 0 }}>
              <span
                className="mini"
                style={{
                  width: "22px",
                  height: "22px",
                  borderRadius: "50%",
                  background: "var(--mint)",
                  color: "var(--teal)",
                  fontSize: "8px",
                  fontWeight: 700,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                AH
              </span>
              Arif Hossain{" "}
              <SvgIcon name="check" size={12} style={{ color: "var(--teal)" }} />
            </span>
            <Link className="more" href="/rides">
              Details <SvgIcon name="arrow" size={14} />
            </Link>
          </div>
        </div>

        {/* Active Rental Card */}
        <div className="wide" id="rentals">
          <div className="wh">
            <span className="ic">
              <SvgIcon name="box" size={18} />
            </span>
            <div>
              <b>Active Rental</b>
              <small>Pickup today</small>
            </div>
            <span className="tag">80 rental + 100 deposit</span>
          </div>
          <div className="rent">
            <div className="rim">
              <span className="av-t">Pickup today</span>
            </div>
            <div>
              <small>Calculators</small>
              <h3>Scientific calculator</h3>
              <div className="pr">
                <b>40</b>tokens / day
              </div>
              <div className="loc">
                <SvgIcon name="pin" size={12} />
                Science Library
              </div>
              <div
                className="ow"
                style={{
                  borderTop: "1px solid var(--hair)",
                  paddingTop: "8px",
                  marginTop: "10px",
                }}
              >
                <span className="mini">NA</span>
                Nafis Ahmed
                <SvgIcon name="check" size={12} />
              </div>
            </div>
          </div>
          <div className="rsum" style={{ marginTop: "10px" }}>
            <span>2 days</span>
            <span>80 rental tokens</span>
            <span>100 refundable deposit</span>
          </div>
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
              <b>1 item borrowed</b>
              <span className="tag">1 borrowed</span>
            </div>
            <div className="row" style={{ marginTop: "2px" }}>
              <p>1 active rental · 1 booked ride</p>
            </div>
            <div className="row" style={{ marginTop: "2px" }}>
              <p>1 booked ride</p>
              <p>2 live listings</p>
            </div>
            <Link className="more" href="#">
              View rentals <SvgIcon name="arrow" size={14} />
            </Link>
          </div>
          <div className="cc">
            <h3>
              My listings <SvgIcon name="hand" size={20} />
            </h3>
            <div className="row">
              <b>Canon EOS 200D</b>
              <span className="tag">Active</span>
            </div>
            <div className="row" style={{ marginTop: "2px" }}>
              <p>Cameras · Good · 60 tokens / day</p>
            </div>
            <div className="row" style={{ marginTop: "2px" }}>
              <p>1 pending request</p>
              <p>300 tokens deposit</p>
            </div>
            <Link className="more" href="/my-products">
              Manage listings <SvgIcon name="arrow" size={14} />
            </Link>
          </div>
        </div>

        {/* Sharing Guide */}
        <div className="guide">
          <SvgIcon name="shield" size={18} style={{ color: "var(--teal)" }} />
          Meet in a public campus spot, check the item together, and agree on the return time.{" "}
          <Link href="#">
            Sharing guide <SvgIcon name="arrow" size={14} />
          </Link>
        </div>
      </main>

      {/* Footer */}
      <footer>
        <div className="wrap">
          <span>UniShare. Made for university students in Bangladesh.</span>
          <span>
            <Link href="#" style={{ marginLeft: 0 }}>
              Privacy
            </Link>
            <Link href="#">Terms</Link>
            <Link href="#">Get help</Link>
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
                FR
              </div>
              <div>
                <b style={{ fontSize: "17px", display: "block" }}>
                  Farhana Rahman
                </b>
                <small style={{ color: "var(--muted)", fontSize: "12px" }}>
                  farhana@std.du.ac.bd
                </small>
                <div
                  style={{
                    fontSize: "11px",
                    color: "var(--teal)",
                    fontWeight: 700,
                    marginTop: "2px",
                  }}
                >
                  University of Dhaka · Verified Student 🛡️
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
                <b>2021-DU-8491</b>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "6px" }}>
                <span style={{ color: "var(--muted)" }}>Department:</span>
                <b>Computer Science & Eng.</b>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "6px" }}>
                <span style={{ color: "var(--muted)" }}>Campus Status:</span>
                <b style={{ color: "var(--teal)" }}>Verified Member ✓</b>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ color: "var(--muted)" }}>Member Since:</span>
                <b>October 2026</b>
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
                <span style={{ color: "var(--ink)", fontWeight: 600 }}>1 item (Scientific calculator)</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span>Live Listings:</span>
                <span style={{ color: "var(--ink)", fontWeight: 600 }}>2 items (Canon EOS 200D)</span>
              </div>
            </div>

            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
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

