"use client";

import React, { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import "./app-navbar.css";

export type ActiveNavKey =
  | "home"
  | "marketplace"
  | "my-products"
  | "rides"
  | "wallet"
  | "favorites"
  | "notifications"
  | "sos";

export interface NavUser {
  name?: string;
  email?: string;
  initials?: string;
  university?: string;
  tokenBalance?: number;
}

interface AppNavbarProps {
  mode?: "app" | "guest";
  activeNav?: ActiveNavKey;
  user?: NavUser | null;
  unreadCount?: number;
  redirectPath?: string;
  onLogout?: () => void;
  onOpenProfile?: () => void;
  onSos?: () => void;
}

const DEFAULT_USER: Required<NavUser> = {
  name: "Farhana Rahman",
  email: "farhana@std.du.ac.bd",
  initials: "FR",
  university: "University of Dhaka",
  tokenBalance: 420,
};

function deriveInitials(name?: string, provided?: string): string {
  if (provided?.trim()) return provided.trim().slice(0, 2).toUpperCase();
  if (!name?.trim()) return "US";
  const parts = name.trim().split(/\s+/);
  return parts
    .slice(0, 2)
    .map((p) => p[0])
    .join("")
    .toUpperCase();
}

const NAV_ITEMS: { key: ActiveNavKey; label: string; href: string }[] = [
  { key: "home", label: "Home", href: "/home" },
  { key: "marketplace", label: "Marketplace", href: "/marketplace" },
  { key: "rides", label: "Rides", href: "/rides" },
  { key: "wallet", label: "Wallet", href: "/wallet" },
];

function NavIcon({ name }: { name: string }) {
  switch (name) {
    case "home":
      return (
        <svg viewBox="0 0 24 24" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1v-9.5z" />
        </svg>
      );
    case "marketplace":
      return (
        <svg viewBox="0 0 24 24" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M6 7h12l1 13H5L6 7z" />
          <path d="M9 7a3 3 0 0 1 6 0" />
        </svg>
      );
    case "rides":
      return (
        <svg viewBox="0 0 24 24" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M5 15V10l2-4.5h10L19 10v5" />
          <rect x="3" y="15" width="18" height="3.5" rx="1" />
          <path d="M6.5 18.5v2M17.5 18.5v2M5 10.5h14" />
        </svg>
      );
    case "wallet":
      return (
        <svg viewBox="0 0 24 24" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <rect x="3" y="5" width="18" height="14" rx="2.5" />
          <path d="M3 10h18M15.5 14h2" />
        </svg>
      );
    case "bell":
      return (
        <svg viewBox="0 0 24 24" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M6 16V11a6 6 0 0 1 12 0v5l1.5 2h-15zM10 21h4" />
        </svg>
      );
    case "shield":
      return (
        <svg viewBox="0 0 24 24" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M12 3l8 3v6c0 4.5-3.4 8-8 9-4.6-1-8-4.5-8-9V6l8-3z" />
          <path d="M9 12l2 2 4-4" />
        </svg>
      );
    case "box":
      return (
        <svg viewBox="0 0 24 24" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M12 3l8 4.5v9L12 21l-8-4.5v-9L12 3z" />
          <path d="M4 7.5l8 4.5 8-4.5M12 12v9" />
        </svg>
      );
    case "heart":
      return (
        <svg viewBox="0 0 24 24" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M12 20s-7-4.5-9-8.8C1.5 7.9 3.8 5 6.8 5c1.9 0 3.5 1 4.4 2.4h1.6C13.7 6 15.3 5 17.2 5c3 0 5.3 2.9 3.8 6.2-2 4.3-9 8.8-9 8.8z" />
        </svg>
      );
    case "clock":
      return (
        <svg viewBox="0 0 24 24" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <circle cx="12" cy="12" r="9" />
          <path d="M12 7v5l3 2" />
        </svg>
      );
    case "user":
      return (
        <svg viewBox="0 0 24 24" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <circle cx="12" cy="8" r="4" />
          <path d="M5 20a7 7 0 0 1 14 0" />
        </svg>
      );
    case "coin":
      return (
        <svg viewBox="0 0 24 24" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <circle cx="12" cy="12" r="9" />
          <path d="M12 7v10M9 10h4.5a1.5 1.5 0 0 1 0 3H10" />
        </svg>
      );
    case "logout":
      return (
        <svg viewBox="0 0 24 24" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9" />
        </svg>
      );
    default:
      return null;
  }
}

export default function AppNavbar({
  mode = "app",
  activeNav,
  user,
  unreadCount = 1,
  redirectPath,
  onLogout,
  onOpenProfile,
  onSos,
}: AppNavbarProps) {
  const router = useRouter();
  const [storedUser, setStoredUser] = useState<NavUser | null>(null);
  const [profileOpen, setProfileOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  const profileRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    try {
      const raw = localStorage.getItem("unishare_user");
      if (raw) {
        setStoredUser(JSON.parse(raw));
      }
    } catch {
      // Ignore malformed storage entries cleanly
    }
  }, []);

  useEffect(() => {
    const handleOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      if (profileRef.current && !profileRef.current.contains(target)) {
        setProfileOpen(false);
      }
    };
    document.addEventListener("mousedown", handleOutside);
    return () => document.removeEventListener("mousedown", handleOutside);
  }, []);

  const resolvedUser: Required<NavUser> = {
    name: user?.name || storedUser?.name || DEFAULT_USER.name,
    email: user?.email || storedUser?.email || DEFAULT_USER.email,
    initials: deriveInitials(
      user?.name || storedUser?.name || DEFAULT_USER.name,
      user?.initials || storedUser?.initials
    ),
    university:
      user?.university || storedUser?.university || DEFAULT_USER.university,
    tokenBalance:
      user?.tokenBalance ??
      storedUser?.tokenBalance ??
      DEFAULT_USER.tokenBalance,
  };

  const handleSignOut = () => {
    setProfileOpen(false);
    setMobileOpen(false);
    try {
      localStorage.removeItem("unishare_logged_in");
      localStorage.removeItem("unishare_user");
      document.cookie = "unishare_logged_in=; path=/; max-age=0";
      document.cookie = "unishare_user=; path=/; max-age=0; SameSite=Lax";
      document.cookie = "unishare_token=; path=/; max-age=0; SameSite=Lax";
      fetch("/api/auth/logout", { method: "POST" }).catch(() => {});
    } catch {
      // Ignore storage access errors
    }
    if (onLogout) {
      onLogout();
    } else {
      router.push("/");
    }
  };

  // Emergency SOS Dual-Action: 1-click -> Open /sos setup; Press & hold (2s) -> Dispatch Emergency Alert
  const [sosContact, setSosContact] = useState<{ name: string; phoneNumber: string } | null>(null);
  const [isHolding, setIsHolding] = useState(false);
  const [holdProgress, setHoldProgress] = useState(0);
  const [isTriggering, setIsTriggering] = useState(false);
  const [sosToast, setSosToast] = useState<string | null>(null);

  const holdTimerRef = useRef<NodeJS.Timeout | null>(null);
  const progressIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const triggeredRef = useRef(false);

  const loadEmergencyContact = () => {
    try {
      const raw = localStorage.getItem("unishare_emergency_contacts");
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setSosContact(parsed[0]);
          return;
        }
      }
      const singleRaw = localStorage.getItem("unishare_emergency_contact");
      if (singleRaw) {
        setSosContact(JSON.parse(singleRaw));
      }
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    loadEmergencyContact();
    fetch("/api/emergency-contacts")
      .then((r) => r.json())
      .then((d) => {
        if (d?.contacts?.[0]) {
          setSosContact(d.contacts[0]);
        }
      })
      .catch(() => {});

    const handleStorage = () => loadEmergencyContact();
    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, []);

  const triggerSosEmergency = async () => {
    setIsTriggering(true);
    try {
      let activeContact = sosContact;
      if (!activeContact) {
        try {
          const raw = localStorage.getItem("unishare_emergency_contacts");
          if (raw) {
            const parsed = JSON.parse(raw);
            if (Array.isArray(parsed) && parsed.length > 0) activeContact = parsed[0];
          }
          if (!activeContact) {
            const s = localStorage.getItem("unishare_emergency_contact");
            if (s) activeContact = JSON.parse(s);
          }
        } catch {}
      }

      if (!activeContact || !activeContact.phoneNumber) {
        setSosToast("⚠️ No emergency contact configured! Opening setup page...");
        setTimeout(() => {
          setSosToast(null);
          router.push("/sos");
        }, 1200);
        setIsTriggering(false);
        return;
      }

      // 1. Fetch current GPS coordinates
      let lat: number | undefined;
      let lng: number | undefined;
      let accuracy: number | undefined;

      if (typeof window !== "undefined" && "geolocation" in navigator) {
        try {
          const pos = await new Promise<GeolocationPosition>((resolve, reject) => {
            navigator.geolocation.getCurrentPosition(resolve, reject, {
              enableHighAccuracy: true,
              timeout: 4000,
              maximumAge: 10000,
            });
          }).catch(() => null);

          if (pos) {
            lat = pos.coords.latitude;
            lng = pos.coords.longitude;
            accuracy = pos.coords.accuracy;
          }
        } catch {}
      }

      // 2. Dispatch to /api/sos/session (which automatically triggers UltraMsg WhatsApp alert)
      const studentName = resolvedUser.name || "Campus Student";
      const studentEmail = resolvedUser.email || "student@unishare.online";

      await fetch("/api/sos/session", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-user-email": studentEmail,
        },
        body: JSON.stringify({
          action: "START",
          notes: "Triggered from top navbar SOS button (2-second hold)",
          latitude: lat,
          longitude: lng,
          accuracy,
        }),
      });

      // 3. Open phone dialer immediately with saved contact number
      const dialNumber = activeContact.phoneNumber.replace(/[^\d+]/g, "");
      setTimeout(() => {
        window.location.href = `tel:${dialNumber}`;
      }, 350);

      setSosToast(`🚨 SOS DISPATCHED: WhatsApp alert sent to ${activeContact.name} (${activeContact.phoneNumber}) & dialpad opened!`);
      setTimeout(() => setSosToast(null), 5000);
    } catch (err) {
      console.error("SOS trigger error:", err);
      if (sosContact?.phoneNumber) {
        const dialNumber = sosContact.phoneNumber.replace(/[^\d+]/g, "");
        window.location.href = `tel:${dialNumber}`;
      }
    } finally {
      setIsTriggering(false);
    }
  };

  const HOLD_DURATION_MS = 2000;

  const handleHoldStart = (e: React.SyntheticEvent) => {
    if ("button" in e && (e as React.MouseEvent).button !== 0) return;
    triggeredRef.current = false;
    setIsHolding(true);
    setHoldProgress(0);

    const startTime = Date.now();
    if (progressIntervalRef.current) clearInterval(progressIntervalRef.current);
    progressIntervalRef.current = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(100, Math.round((elapsed / HOLD_DURATION_MS) * 100));
      setHoldProgress(progress);
    }, 40);

    if (holdTimerRef.current) clearTimeout(holdTimerRef.current);
    holdTimerRef.current = setTimeout(() => {
      triggeredRef.current = true;
      if (progressIntervalRef.current) clearInterval(progressIntervalRef.current);
      setIsHolding(false);
      setHoldProgress(100);

      if (typeof navigator !== "undefined" && navigator.vibrate) {
        try {
          navigator.vibrate([200, 100, 200]);
        } catch {}
      }

      triggerSosEmergency();
    }, HOLD_DURATION_MS);
  };

  const handleHoldCancel = () => {
    if (holdTimerRef.current) {
      clearTimeout(holdTimerRef.current);
      holdTimerRef.current = null;
    }
    if (progressIntervalRef.current) {
      clearInterval(progressIntervalRef.current);
      progressIntervalRef.current = null;
    }
    setIsHolding(false);
    setHoldProgress(0);
  };

  const handleSosButtonClick = (e: React.MouseEvent) => {
    e.preventDefault();
    if (triggeredRef.current) {
      triggeredRef.current = false;
      return;
    }
    handleHoldCancel();
    // 1-click simply navigates to /sos
    router.push("/sos");
  };


  return (
    <header className="unishare-topbar">
      <div className="ut-inner">
        <Link
          href={mode === "guest" ? "/" : "/home"}
          className="ut-logo"
          onClick={() => setMobileOpen(false)}
        >
          <svg viewBox="0 0 22 14" strokeWidth="2.3" aria-hidden="true">
            <circle cx="6.5" cy="7" r="4.5" />
            <circle cx="15.5" cy="7" r="4.5" />
          </svg>
          <span>UniShare</span>
        </Link>

        {mode === "app" && (
          <nav className="ut-nav" aria-label="Main">
            {NAV_ITEMS.map((item) => (
              <Link
                key={item.key}
                href={item.href}
                className={`ut-nav-link ${activeNav === item.key ? "active" : ""}`}
                aria-current={activeNav === item.key ? "page" : undefined}
              >
                <NavIcon name={item.key} />
                <span>{item.label}</span>
              </Link>
            ))}
          </nav>
        )}

        <div className="ut-actions">
          {mode === "guest" ? (
            <>
              <Link
                href={
                  redirectPath
                    ? `/login?redirect=${encodeURIComponent(redirectPath)}`
                    : "/login"
                }
                className="ut-guest-login"
              >
                Log in
              </Link>
              <Link href="/register" className="ut-guest-cta">
                Create account
              </Link>
            </>
          ) : (
            <>
              <Link
                href="/favorites"
                className={`ut-bell-link ${activeNav === "favorites" ? "active" : ""}`}
                aria-label="Favorites"
                title="Favorites"
              >
                <NavIcon name="heart" />
              </Link>

              <Link
                href="/notifications"
                className={`ut-bell-link ${activeNav === "notifications" ? "active" : ""}`}
                aria-label="Notifications"
                title="Notifications"
              >
                <NavIcon name="bell" />
                {unreadCount > 0 && <span className="ut-bell-dot" />}
              </Link>

              <button
                type="button"
                className={`ut-sos-btn ${isHolding ? "holding" : ""} ${isTriggering ? "triggering" : ""}`}
                aria-label="Campus Safety SOS"
                title="1-click: Open SOS Setup. Press & hold 2 seconds: Trigger Emergency Alert."
                onMouseDown={handleHoldStart}
                onMouseUp={handleHoldCancel}
                onMouseLeave={handleHoldCancel}
                onTouchStart={handleHoldStart}
                onTouchEnd={handleHoldCancel}
                onTouchCancel={handleHoldCancel}
                onContextMenu={(e) => e.preventDefault()}
                onClick={handleSosButtonClick}
                style={{
                  position: "relative",
                  overflow: "hidden",
                  textDecoration: "none",
                  userSelect: "none",
                  WebkitUserSelect: "none",
                }}
              >
                {isHolding && (
                  <span
                    className="ut-sos-progress-fill"
                    style={{
                      position: "absolute",
                      left: 0,
                      top: 0,
                      bottom: 0,
                      width: `${holdProgress}%`,
                      background: "rgba(220, 38, 38, 0.35)",
                      pointerEvents: "none",
                      zIndex: 1,
                    }}
                  />
                )}
                <span
                  style={{
                    position: "relative",
                    zIndex: 2,
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "6px",
                  }}
                >
                  <NavIcon name="shield" />
                  <span className="ut-sos-text">
                    {isTriggering
                      ? "Sending..."
                      : isHolding
                      ? `Hold (${Math.max(1, Math.ceil((2000 - (holdProgress / 100) * 2000) / 1000))}s)`
                      : "SOS"}
                  </span>
                </span>
              </button>

              <div className="ut-anchor-wrap" ref={profileRef}>
                <button
                  type="button"
                  className="ut-profile-btn"
                  aria-expanded={profileOpen}
                  aria-label="Account menu"
                  onClick={() => {
                    setProfileOpen((prev) => !prev);
                    setMobileOpen(false);
                  }}
                >
                  <span className="ut-avatar">{resolvedUser.initials}</span>
                  <span className="ut-user-name">{resolvedUser.name}</span>
                  <svg className="ut-chev" viewBox="0 0 24 24" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M6 9l6 6 6-6" />
                  </svg>
                </button>

                {profileOpen && (
                  <div className="ut-popover" role="menu">
                    <div className="ut-popover-head">
                      <div className="ut-popover-name">{resolvedUser.name}</div>
                      <div className="ut-popover-email">{resolvedUser.email}</div>
                      <span className="ut-popover-meta">
                        {resolvedUser.tokenBalance} tokens available
                      </span>
                    </div>

                    {onOpenProfile && (
                      <button
                        type="button"
                        className="ut-menu-item"
                        role="menuitem"
                        onClick={() => {
                          setProfileOpen(false);
                          onOpenProfile();
                        }}
                      >
                        <NavIcon name="user" />
                        <span>Student profile</span>
                      </button>
                    )}

                    <Link
                      href="/my-products"
                      className="ut-menu-item"
                      role="menuitem"
                      onClick={() => setProfileOpen(false)}
                    >
                      <NavIcon name="box" />
                      <span>My products</span>
                    </Link>

                    <Link
                      href="/home#rentals"
                      className="ut-menu-item"
                      role="menuitem"
                      onClick={() => setProfileOpen(false)}
                    >
                      <NavIcon name="clock" />
                      <span>My rentals</span>
                    </Link>

                    <Link
                      href="/favorites"
                      className="ut-menu-item"
                      role="menuitem"
                      onClick={() => setProfileOpen(false)}
                    >
                      <NavIcon name="heart" />
                      <span>Favorites</span>
                    </Link>

                    <Link
                      href="/buy-tokens"
                      className="ut-menu-item"
                      role="menuitem"
                      onClick={() => setProfileOpen(false)}
                    >
                      <NavIcon name="coin" />
                      <span>Buy tokens</span>
                    </Link>

                    <Link
                      href="/sos"
                      className="ut-menu-item"
                      role="menuitem"
                      onClick={() => setProfileOpen(false)}
                    >
                      <NavIcon name="shield" />
                      <span>Emergency SOS</span>
                    </Link>

                    <div className="ut-divider" />

                    <button
                      type="button"
                      className="ut-menu-item danger"
                      role="menuitem"
                      onClick={handleSignOut}
                    >
                      <NavIcon name="logout" />
                      <span>Log out</span>
                    </button>
                  </div>
                )}
              </div>

              <button
                type="button"
                className="ut-mobile-btn"
                aria-expanded={mobileOpen}
                aria-label="Toggle navigation menu"
                onClick={() => {
                  setMobileOpen((prev) => !prev);
                  setProfileOpen(false);
                }}
              >
                <svg viewBox="0 0 24 24" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
                  {mobileOpen ? (
                    <path d="M18 6 6 18M6 6l12 12" />
                  ) : (
                    <path d="M4 7h16M4 12h16M4 17h16" />
                  )}
                </svg>
              </button>
            </>
          )}
        </div>
      </div>

      {mode === "app" && mobileOpen && (
        <div className="ut-mobile-drawer" role="navigation" aria-label="Mobile Navigation">
          {[
            ...NAV_ITEMS,
            { key: "my-products" as ActiveNavKey, label: "My products", href: "/my-products" },
            { key: "favorites" as ActiveNavKey, label: "Favorites", href: "/favorites" },
            { key: "sos" as ActiveNavKey, label: "Emergency SOS", href: "/sos" },
          ].map((item) => (
            <Link
              key={item.key}
              href={item.href}
              className={`ut-mobile-link ${activeNav === item.key ? "active" : ""}`}
              onClick={() => setMobileOpen(false)}
            >
              <NavIcon name={item.key === "my-products" ? "box" : item.key === "favorites" ? "heart" : item.key === "sos" ? "shield" : item.key} />
              <span>{item.label}</span>
            </Link>
          ))}
        </div>
      )}

      {sosToast && (
        <div
          role="status"
          aria-live="polite"
          style={{
            position: "fixed",
            top: "72px",
            right: "20px",
            zIndex: 99999,
            backgroundColor: "#12201f",
            color: "#ffffff",
            padding: "14px 20px",
            borderRadius: "12px",
            boxShadow: "0 10px 25px rgba(0, 0, 0, 0.25)",
            fontSize: "14px",
            fontWeight: 600,
            display: "flex",
            alignItems: "center",
            gap: "12px",
            borderLeft: "5px solid #dc2626",
            maxWidth: "420px",
            lineHeight: 1.4,
          }}
        >
          <span style={{ flex: 1 }}>{sosToast}</span>
          <button
            type="button"
            onClick={() => setSosToast(null)}
            style={{
              background: "transparent",
              border: "none",
              color: "#94a3b8",
              cursor: "pointer",
              fontSize: "18px",
              lineHeight: 1,
              padding: "4px",
            }}
            aria-label="Close notification"
          >
            ✕
          </button>
        </div>
      )}
    </header>
  );
}
