"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import "./landing.css";
import CampusHomeDashboard from "./CampusHomeDashboard";

const RIDE_ALERTS = [
  {
    badge: "Ride Share",
    title: "Dhanmondi → Campus",
    meta: "Leaves 8:30 AM · 1 seat left",
  },
  {
    badge: "Rickshaw Share",
    title: "Shahbagh → Campus",
    meta: "Split fare · 25 tokens",
  },
  {
    badge: "Ride Alert",
    title: "Uttara → Campus Gate",
    meta: "Today 8:00 AM · Verified ✓",
  },
];

const SHELF_ALERTS = [
  {
    badge: "Campus Shelf",
    title: "Scientific Calculator",
    meta: "20 tokens/day · Library meetup",
  },
  {
    badge: "Campus Shelf",
    title: "65W Laptop Charger",
    meta: "35 tokens/day · Academic Bldg",
  },
  {
    badge: "New Request",
    title: "Canon EOS 200D",
    meta: "120 tokens/day · Zero cash",
  },
];

function useCrossfadeCycle(
  length: number,
  intervalMs: number,
  initialDelayMs: number,
  paused: boolean
) {
  const [index, setIndex] = useState(0);
  const [fading, setFading] = useState(false);

  useEffect(() => {
    if (paused || length <= 1) return;

    let intervalTimer: ReturnType<typeof setInterval> | null = null;
    let fadeTimer: ReturnType<typeof setTimeout> | null = null;

    const triggerAdvance = () => {
      setFading(true);
      fadeTimer = setTimeout(() => {
        setIndex((prev) => (prev + 1) % length);
        setFading(false);
      }, 280);
    };

    const startDelay = setTimeout(() => {
      triggerAdvance();
      intervalTimer = setInterval(triggerAdvance, intervalMs);
    }, initialDelayMs);

    return () => {
      clearTimeout(startDelay);
      if (intervalTimer) clearInterval(intervalTimer);
      if (fadeTimer) clearTimeout(fadeTimer);
    };
  }, [length, intervalMs, initialDelayMs, paused]);

  return { index, fading };
}

export default function Home() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [hasMounted, setHasMounted] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [ridePaused, setRidePaused] = useState(false);
  const [shelfPaused, setShelfPaused] = useState(false);

  const rideCycle = useCrossfadeCycle(RIDE_ALERTS.length, 7000, 6000, ridePaused);
  const shelfCycle = useCrossfadeCycle(SHELF_ALERTS.length, 7000, 9500, shelfPaused);

  useEffect(() => {
    setHasMounted(true);
    try {
      const loggedIn =
        localStorage.getItem("unishare_logged_in") === "true" ||
        document.cookie.includes("unishare_logged_in=true") ||
        (typeof window !== "undefined" &&
          new URLSearchParams(window.location.search).get("view") === "campus");
      setIsLoggedIn(loggedIn);

      const savedTheme = localStorage.getItem("unishare_theme");
      if (savedTheme === "dark" || savedTheme === "light") {
        setTheme(savedTheme);
      }
    } catch (e) {
      console.error(e);
    }
  }, []);

  const toggleTheme = () => {
    const next = theme === "light" ? "dark" : "light";
    setTheme(next);
    try {
      localStorage.setItem("unishare_theme", next);
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    const onScroll = () => {
      setIsScrolled(window.scrollY > 12);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const handleLogout = () => {
    try {
      localStorage.removeItem("unishare_logged_in");
      localStorage.removeItem("unishare_user");
      document.cookie = "unishare_logged_in=; path=/; max-age=0";
    } catch (e) {
      console.error(e);
    }
    setIsLoggedIn(false);
  };

  // If user is logged in, show the Campus Home Dashboard!
  if (hasMounted && isLoggedIn) {
    return <CampusHomeDashboard onLogout={handleLogout} />;
  }

  return (
    <main className={`unishare-landing ${theme === "dark" ? "dark" : ""}`}>
      {/* Floating Sticky Pill Navigation */}
      <div className={`nav-float ${isScrolled ? "scrolled" : ""}`}>
        <nav className="nav-pill" aria-label="Primary navigation">
          <Link className="logo" href="/">
            <svg
              viewBox="0 0 32 32"
              fill="none"
              stroke="#0B5D5E"
              strokeWidth="2.4"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <circle cx="11" cy="16" r="5" />
              <circle cx="21" cy="16" r="5" />
              <path d="M16 11.5v9" />
            </svg>
            UniShare
          </Link>

          <div className="nav-mid">
            <a className="nav-item" href="#features">
              Features
            </a>
            <a className="nav-item" href="#how">
              How it works
            </a>
            <Link className="nav-item" href="/marketplace">
              Marketplace
            </Link>
            <Link className="nav-item" href="/rides">
              Rides
            </Link>
          </div>

          <div className="nav-actions">
            <button
              type="button"
              className="theme-toggle"
              onClick={toggleTheme}
              aria-label={
                theme === "dark" ? "Switch to light mode" : "Switch to dark mode"
              }
              title={
                theme === "dark" ? "Switch to light mode" : "Switch to dark mode"
              }
            >
              {theme === "dark" ? (
                <svg
                  width="17"
                  height="17"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.1"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <circle cx="12" cy="12" r="4" />
                  <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" />
                </svg>
              ) : (
                <svg
                  width="17"
                  height="17"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.1"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z" />
                </svg>
              )}
            </button>
            <Link className="link" href="/login">
              Log in
            </Link>
            <Link className="btn sm pill-cta" href="/register">
              Create account
            </Link>
          </div>
        </nav>
      </div>

      {/* Hero Section */}
      <header className="hero">
        <div className="wrap">
          <div>
            <h1>
              Your campus,
              <br />
              one big <span>shared</span>
              <br />
              <span>shelf.</span>
            </h1>
            <p>
              Rent cameras, calculators, laptops and more from students of your
              own university. Verified with your university email, never open to
              outsiders.
            </p>
            <div className="cta">
              <Link className="btn" href="/register">
                Create account
              </Link>
              <Link className="btn ghost" href="/login">
                Log in
              </Link>
            </div>
            <small>Only students with a university email can join.</small>
          </div>
          <div className="photo">
            <img
              src="/images/landing/hero-student.jpeg"
              alt="A smiling UniShare student in a red kameez with a white shawl, hands open in welcome, standing in a green campus garden"
            />

            {/* Top-Right: Ride Notification Card */}
            <div
              className="hero-float-note top-right"
              aria-label="Campus ride availability"
              onMouseEnter={() => setRidePaused(true)}
              onMouseLeave={() => setRidePaused(false)}
            >
              <div
                className={`hero-note-inner ${
                  rideCycle.fading ? "is-fading" : ""
                }`}
              >
                <span className="hero-note-ic ride" aria-hidden="true">
                  <svg
                    width="18"
                    height="18"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.1"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H5c-.6 0-1 .4-1 1v7c0 .6.4 1 1 1h2" />
                    <circle cx="7" cy="17" r="2" />
                    <circle cx="17" cy="17" r="2" />
                  </svg>
                </span>
                <div className="hero-note-body">
                  <span className="hero-note-kicker">
                    <span className="hero-note-dot" aria-hidden="true" />
                    {RIDE_ALERTS[rideCycle.index].badge}
                  </span>
                  <b>{RIDE_ALERTS[rideCycle.index].title}</b>
                  <small>{RIDE_ALERTS[rideCycle.index].meta}</small>
                </div>
              </div>
            </div>

            {/* Bottom-Left: Shelf Item Notification Card */}
            <div
              className="hero-float-note bottom-left"
              aria-label="Campus shelf item"
              onMouseEnter={() => setShelfPaused(true)}
              onMouseLeave={() => setShelfPaused(false)}
            >
              <div
                className={`hero-note-inner ${
                  shelfCycle.fading ? "is-fading" : ""
                }`}
              >
                <span className="hero-note-ic shelf" aria-hidden="true">
                  <svg
                    width="18"
                    height="18"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.1"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z" />
                    <path d="M3 6h18" />
                    <path d="M16 10a4 4 0 0 1-8 0" />
                  </svg>
                </span>
                <div className="hero-note-body">
                  <span className="hero-note-kicker">
                    <span className="hero-note-dot" aria-hidden="true" />
                    {SHELF_ALERTS[shelfCycle.index].badge}
                  </span>
                  <b>{SHELF_ALERTS[shelfCycle.index].title}</b>
                  <small>{SHELF_ALERTS[shelfCycle.index].meta}</small>
                </div>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* What You Can Share */}
      <section className="share" id="features" aria-label="What you can share">
        <div className="wrap">
          <div className="col">
            <h2>Rent what you need for a day</h2>
            <p>
              Borrow a calculator for an exam, a charger when yours gives up, or a
              football for the weekend, all from a student on your campus.
            </p>
            <ul className="items">
              <li>
                <img
                  src="/images/landing/football.jpeg"
                  alt="Three footballs stacked on grass"
                  style={{ objectPosition: "50% 45%" }}
                />
                <span>Football</span>
              </li>
              <li>
                <img
                  src="/images/landing/laptop-charger.jpeg"
                  alt="Black laptop charger held in a hand"
                  style={{ objectPosition: "40% 55%" }}
                />
                <span>Laptop charger</span>
              </li>
              <li>
                <img
                  src="/images/landing/earphones.jpeg"
                  alt="Wired earphones on a wooden table"
                  style={{ objectPosition: "50% 60%" }}
                />
                <span>Earphones</span>
              </li>
              <li>
                <img
                  src="/images/landing/phone-charger.jpeg"
                  alt="White 45W phone charger with cable"
                  style={{ objectPosition: "50% 50%" }}
                />
                <span>Phone charger</span>
              </li>
              <li>
                <img
                  src="/images/landing/airpods.jpeg"
                  alt="AirPods in an open charging case"
                  style={{ objectPosition: "50% 40%" }}
                />
                <span>AirPods</span>
              </li>
              <li>
                <img
                  src="/images/landing/calculator.jpeg"
                  alt="Two transparent calculators held in a hand"
                  style={{ objectPosition: "50% 55%" }}
                />
                <span>Calculator</span>
              </li>
            </ul>
          </div>
          <div className="col">
            <h2>Share a ride to campus</h2>
            <p>
              Heading the same way? Offer a seat or find a ride with someone from
              your own university, by car or by rickshaw.
            </p>
            <ul className="items rides">
              <li>
                <Link href="/rides" style={{ display: "contents", color: "inherit" }}>
                  <img
                    src="/images/landing/car-ride.jpeg"
                    alt="Phone showing a Ride Share booking next to a white car on a Dhaka street"
                    style={{ objectPosition: "0% 50%" }}
                  />
                  <span>Car ride</span>
                </Link>
              </li>
              <li>
                <Link href="/rides" style={{ display: "contents", color: "inherit" }}>
                  <img
                    src="/images/landing/rickshaw.jpeg"
                    alt="A student with a backpack talking to a rickshaw puller while a passenger steps out of a painted rickshaw"
                    style={{ objectPosition: "28% 50%" }}
                  />
                  <span>Rickshaw</span>
                </Link>
              </li>
            </ul>
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="how" id="how">
        <div className="wrap">
          <div className="how-head">
            <h2>Joining takes three moves</h2>
            <p className="lead">
              Every member is checked, so you always know the person on the other
              side is a real student.
            </p>
          </div>
          <ol>
            <li>
              <div className="top">
                <span className="num">1</span>
                <svg
                  fill="none"
                  stroke="#0B5D5E"
                  strokeWidth="2.4"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  viewBox="0 0 40 40"
                  aria-hidden="true"
                >
                  <rect x="3" y="7" width="34" height="26" rx="4" />
                  <path d="M4 10l16 12 16-12" />
                </svg>
              </div>
              <h3>Sign up with your university email</h3>
              <p>We send a 6-digit code to confirm the address is yours.</p>
            </li>
            <li>
              <div className="top">
                <span className="num">2</span>
                <svg
                  fill="none"
                  stroke="#0B5D5E"
                  strokeWidth="2.4"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  viewBox="0 0 40 40"
                  aria-hidden="true"
                >
                  <rect x="3" y="7" width="34" height="26" rx="4" />
                  <circle cx="14" cy="17" r="4" />
                  <path d="M7 28c1-5 12-5 14 0M24 16h9M24 22h9" />
                </svg>
              </div>
              <h3>Get verified</h3>
              <p>Add your student details, ID card and a face photo for review.</p>
            </li>
            <li>
              <div className="top">
                <span className="num">3</span>
                <svg
                  fill="none"
                  stroke="#0B5D5E"
                  strokeWidth="2.4"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  viewBox="0 0 40 40"
                  aria-hidden="true"
                >
                  <circle cx="14" cy="20" r="8" />
                  <circle cx="26" cy="20" r="8" />
                  <path d="M20 13.5v13" />
                </svg>
              </div>
              <h3>Rent or lend</h3>
              <p>
                Once approved, you only see items and rides from your own
                university.
              </p>
            </li>
          </ol>
        </div>
      </section>

      {/* Final Call to Action */}
      <section className="final">
        <div className="wrap">
          <div>
            <h2>Ready to see what your campus has on the shelf?</h2>
            <p style={{ color: "var(--muted)", marginTop: "10px", fontSize: "16px" }}>
              Join verified students already sharing equipment, calculators, and daily rides on campus.
            </p>
          </div>
          <div className="cta">
            <Link className="btn" href="/register">
              Create account
            </Link>
            <Link className="btn ghost" href="/login">
              Log in
            </Link>
          </div>
        </div>
      </section>

      {/* Comprehensive Footer */}
      <footer>
        <div className="wrap">
          <div className="ft-main">
            {/* Brand & Mission */}
            <div className="ft-brand">
              <Link className="logo" href="/">
                <svg
                  viewBox="0 0 32 32"
                  fill="none"
                  stroke="#0B5D5E"
                  strokeWidth="2.4"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                  style={{ width: "24px", height: "24px" }}
                >
                  <circle cx="11" cy="16" r="5" />
                  <circle cx="21" cy="16" r="5" />
                  <path d="M16 11.5v9" />
                </svg>
                UniShare
              </Link>
              <p>
                The verified peer-to-peer sharing and campus mobility network made exclusively for university students in Bangladesh.
              </p>
            </div>

            {/* Column 2: Platform */}
            <div className="ft-col">
              <h4>Platform</h4>
              <ul>
                <li><Link href="/marketplace">Marketplace Shelf</Link></li>
                <li><Link href="/rides">Campus Ride Share</Link></li>
                <li><Link href="/wallet">Token Wallet</Link></li>
                <li><Link href="/home">Student Dashboard</Link></li>
                <li><Link href="/register">Join UniShare</Link></li>
              </ul>
            </div>

            {/* Column 3: Trust & Safety */}
            <div className="ft-col">
              <h4>Trust & Safety</h4>
              <ul>
                <li><Link href="/student-verification">Student Verification</Link></li>
                <li><Link href="/confirm-email">Institutional Email Check</Link></li>
                <li><Link href="/notifications">Activity Updates</Link></li>
                <li><a href="#how">How Verification Works</a></li>
                <li><span style={{ fontSize: "13px", color: "var(--muted)" }}>Safe On-Campus Meetups</span></li>
              </ul>
            </div>

            {/* Column 4: Support & Legal */}
            <div className="ft-col">
              <h4>Support & Legal</h4>
              <ul>
                <li><Link href="/login">Student Log In</Link></li>
                <li><Link href="/reset-password">Account Recovery</Link></li>
                <li><a href="mailto:support@unishare.online">Campus Support</a></li>
                <li><a href="#terms">Terms of Service</a></li>
                <li><a href="#privacy">Privacy Policy</a></li>
              </ul>
            </div>
          </div>

          {/* Bottom Bar */}
          <div className="ft-bottom">
            <span>
              UniShare. Made for university students in Bangladesh.
            </span>
            <div className="ft-bottom-links">
              <span>Peer-to-Peer Network</span>
            </div>
          </div>
        </div>
      </footer>
    </main>
  );
}
