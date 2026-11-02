"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import AppNavbar from "../components/AppNavbar";
import {
  clearClientSession,
  formatMemberSince,
  getUserScopedKey,
  saveClientUser,
  useCurrentUser,
  useLocalStorageRaw,
  useRequireAuth,
  writeUserScopedJson,
  type ClientUser,
} from "../lib/user-client";
import {
  validateDepartment,
  validateFullName,
  validatePasswordChoice,
} from "../lib/validation";
import "./settings.css";

type SettingsSection = "profile" | "privacy" | "security" | "notifications";

interface ProfileDraft {
  fullName?: string;
  department?: string;
  programme?: string;
  academicSession?: string;
  gender?: string;
}

interface NotificationPrefs {
  rentals: boolean;
  rides: boolean;
  sos: boolean;
  wallet: boolean;
  defaultRidePreference: "no_preference" | "women_only" | "men_only";
}

const DEFAULT_PREFS: NotificationPrefs = {
  rentals: true,
  rides: true,
  sos: true,
  wallet: true,
  defaultRidePreference: "no_preference",
};

const PROGRAMMES = [
  "BSc (Honours)",
  "MSc",
  "BBA",
  "MBA",
  "BA (Honours)",
  "BSS (Honours)",
  "LLB",
  "BArch",
  "MBBS",
  "Other",
];

const SESSIONS = [
  "2025–2026",
  "2024–2025",
  "2023–2024",
  "2022–2023",
  "2021–2022",
  "2020–2021",
];

export default function SettingsPage() {
  const router = useRouter();
  const [isSigningOut, setIsSigningOut] = useState(false);
  const isAuthenticated = useRequireAuth("/settings", !isSigningOut);
  const { resolvedUser, isDemoUser } = useCurrentUser();

  const [activeSection, setActiveSection] = useState<SettingsSection>("profile");
  const [drafts, setDrafts] = useState<ProfileDraft>({});

  // Profile save feedback
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [profileMsg, setProfileMsg] = useState<{ type: "ok" | "err"; text: string } | null>(
    null
  );

  // Privacy / gender save feedback
  const [isSavingPrivacy, setIsSavingPrivacy] = useState(false);
  const [privacyMsg, setPrivacyMsg] = useState<{ type: "ok" | "err"; text: string } | null>(
    null
  );

  // Password change state
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmNewPassword, setConfirmNewPassword] = useState("");
  const [showCurrentPw, setShowCurrentPw] = useState(false);
  const [showNewPw, setShowNewPw] = useState(false);
  const [isChangingPw, setIsChangingPw] = useState(false);
  const [pwMsg, setPwMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);

  // Emergency SOS contacts summary
  const [sosContactsCount, setSosContactsCount] = useState<number | null>(null);

  // Toast
  const [toastMsg, setToastMsg] = useState("");
  const [showToast, setShowToast] = useState(false);

  const settingsKey = getUserScopedKey(
    "unishare_settings",
    resolvedUser.email,
    isDemoUser
  );
  const rawSettingsJson = useLocalStorageRaw(settingsKey);

  const prefs: NotificationPrefs = useMemo(() => {
    if (!rawSettingsJson) return DEFAULT_PREFS;
    try {
      const parsed = JSON.parse(rawSettingsJson) as Partial<NotificationPrefs>;
      return {
        rentals: parsed.rentals ?? true,
        rides: parsed.rides ?? true,
        sos: parsed.sos ?? true,
        wallet: parsed.wallet ?? true,
        defaultRidePreference:
          parsed.defaultRidePreference === "women_only" ||
          parsed.defaultRidePreference === "men_only"
            ? parsed.defaultRidePreference
            : "no_preference",
      };
    } catch {
      return DEFAULT_PREFS;
    }
  }, [rawSettingsJson]);

  // Derived active form fields (reset automatically when drafts is cleared)
  const fullName =
    drafts.fullName ??
    (resolvedUser.name === "Campus Student" ? "" : resolvedUser.name);
  const department = drafts.department ?? (resolvedUser.department || "");
  const programme = drafts.programme ?? (resolvedUser.programme || "BSc (Honours)");
  const academicSession =
    drafts.academicSession ?? (resolvedUser.academicSession || "2023–2024");
  const selectedGender = drafts.gender ?? (resolvedUser.gender || "");

  useEffect(() => {
    if (!isAuthenticated || !resolvedUser.email) return;
    let active = true;
    fetch("/api/emergency-contacts")
      .then((res) => (res.ok ? res.json() : null))
      .then((data: { contacts?: unknown[] } | null) => {
        if (active && Array.isArray(data?.contacts)) {
          setSosContactsCount(data.contacts.length);
        }
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [isAuthenticated, resolvedUser.email]);

  const triggerToast = (msg: string) => {
    setToastMsg(msg);
    setShowToast(true);
    setTimeout(() => setShowToast(false), 2200);
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setProfileMsg(null);

    const nameCheck = validateFullName(fullName);
    if (!nameCheck.valid) {
      setProfileMsg({
        type: "err",
        text: nameCheck.error || "Please enter your real full name.",
      });
      return;
    }

    const trimmedDept = department.trim();
    if (trimmedDept) {
      const deptCheck = validateDepartment(trimmedDept);
      if (!deptCheck.valid) {
        setProfileMsg({
          type: "err",
          text: deptCheck.error || "Please enter a valid academic department.",
        });
        return;
      }
    }

    setIsSavingProfile(true);
    try {
      const res = await fetch("/api/auth/me", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fullName: nameCheck.normalized,
          department: trimmedDept || null,
          programme,
          academicSession,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        error?: string;
        user?: ClientUser;
      };

      if (!res.ok || !data.ok || !data.user) {
        setProfileMsg({
          type: "err",
          text: data.error || "Could not save profile changes.",
        });
        return;
      }

      saveClientUser(data.user);
      setDrafts({});
      setProfileMsg({ type: "ok", text: "Profile details updated." });
      triggerToast("Profile details saved");
    } catch {
      setProfileMsg({ type: "err", text: "Network error while saving profile." });
    } finally {
      setIsSavingProfile(false);
    }
  };

  const handleSavePrivacy = async () => {
    setPrivacyMsg(null);
    setIsSavingPrivacy(true);
    try {
      const res = await fetch("/api/auth/me", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          gender: selectedGender || null,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        error?: string;
        user?: ClientUser;
      };

      if (!res.ok || !data.ok || !data.user) {
        setPrivacyMsg({
          type: "err",
          text: data.error || "Could not update safety profile.",
        });
        return;
      }

      saveClientUser(data.user);
      setDrafts((prev) => {
        const copy = { ...prev };
        delete copy.gender;
        return copy;
      });
      setPrivacyMsg({
        type: "ok",
        text: "Ride safety & gender preference settings saved.",
      });
      triggerToast("Safety preferences updated");
    } catch {
      setPrivacyMsg({ type: "err", text: "Network error saving safety settings." });
    } finally {
      setIsSavingPrivacy(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPwMsg(null);

    if (!currentPassword) {
      setPwMsg({ type: "err", text: "Please enter your current password." });
      return;
    }

    const pwCheck = validatePasswordChoice(newPassword);
    if (!pwCheck.valid) {
      setPwMsg({
        type: "err",
        text: pwCheck.error || "Choose a stronger password.",
      });
      return;
    }

    if (newPassword !== confirmNewPassword) {
      setPwMsg({ type: "err", text: "New passwords do not match." });
      return;
    }

    setIsChangingPw(true);
    try {
      const res = await fetch("/api/auth/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        error?: string;
        message?: string;
      };

      if (!res.ok || !data.ok) {
        setPwMsg({
          type: "err",
          text: data.error || "Unable to update password.",
        });
        return;
      }

      setCurrentPassword("");
      setNewPassword("");
      setConfirmNewPassword("");
      setPwMsg({ type: "ok", text: "Password updated successfully." });
      triggerToast("Password changed");
    } catch {
      setPwMsg({ type: "err", text: "Network error updating password." });
    } finally {
      setIsChangingPw(false);
    }
  };

  const updatePref = <K extends keyof NotificationPrefs>(
    key: K,
    value: NotificationPrefs[K]
  ) => {
    const updated: NotificationPrefs = { ...prefs, [key]: value };
    writeUserScopedJson(settingsKey, updated);
    triggerToast("Preference saved");
  };

  const handleSignOut = () => {
    setIsSigningOut(true);
    clearClientSession();
    router.push("/login");
  };

  if (!isAuthenticated) return null;

  const verificationLabel = resolvedUser.verified
    ? "Verified Student"
    : resolvedUser.studentId
    ? "Verification in review"
    : "Step 3 pending";

  return (
    <div className="unishare-settings">
      <AppNavbar activeNav="settings" />

      <main className="wrap">
        <nav className="crumbs" aria-label="Breadcrumb">
          <Link href="/home">Home</Link>
          <span aria-hidden="true">›</span>
          <span className="current">Settings</span>
        </nav>

        <div className="eyebrow">Account & Preferences</div>
        <div className="hero">
          <div>
            <h1>Settings</h1>
            <p className="sub">
              Manage your campus identity, ride safety preferences, account security,
              and alert controls.
            </p>
          </div>
          <span
            className={`status-badge ${resolvedUser.verified ? "" : "pending"}`}
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.4"
              aria-hidden="true"
            >
              <path d="M12 3l8 3v6c0 4.5-3.4 8-8 9-4.6-1-8-4.5-8-9V6l8-3z" />
              <path d="M9 12l2 2 4-4" />
            </svg>
            {verificationLabel}
          </span>
        </div>

        <div className="settings-layout">
          {/* Left Section Tabs */}
          <aside className="settings-nav" aria-label="Settings sections">
            <button
              type="button"
              className={`nav-tab ${activeSection === "profile" ? "active" : ""}`}
              onClick={() => setActiveSection("profile")}
            >
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="8" r="4" />
                <path d="M5 20a7 7 0 0 1 14 0" />
              </svg>
              <span>Profile &amp; Campus</span>
            </button>

            <button
              type="button"
              className={`nav-tab ${activeSection === "privacy" ? "active" : ""}`}
              onClick={() => setActiveSection("privacy")}
            >
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 3l8 3v6c0 4.5-3.4 8-8 9-4.6-1-8-4.5-8-9V6l8-3z" />
                <path d="M9 12l2 2 4-4" />
              </svg>
              <span>Ride Safety &amp; Privacy</span>
            </button>

            <button
              type="button"
              className={`nav-tab ${activeSection === "security" ? "active" : ""}`}
              onClick={() => setActiveSection("security")}
            >
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="5" y="11" width="14" height="9" rx="2" />
                <path d="M8 11V8a4 4 0 0 1 8 0v3" />
              </svg>
              <span>Password &amp; Security</span>
            </button>

            <button
              type="button"
              className={`nav-tab ${activeSection === "notifications" ? "active" : ""}`}
              onClick={() => setActiveSection("notifications")}
            >
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M6 16V11a6 6 0 0 1 12 0v5l1.5 2h-15zM10 21h4" />
              </svg>
              <span>Notifications</span>
            </button>
          </aside>

          {/* Main Section Panel */}
          <div className="settings-stack">
            {activeSection === "profile" && (
              <section className="card" aria-labelledby="profile-heading">
                <div className="card-head">
                  <div>
                    <h2 id="profile-heading">Profile &amp; Academic Identity</h2>
                    <p>
                      Update your display name and academic details shown on your{" "}
                      {resolvedUser.university} account.
                    </p>
                  </div>
                </div>

                <div className="identity-bar">
                  <div className="avatar-lg">{resolvedUser.initials}</div>
                  <div className="identity-meta">
                    <b>{resolvedUser.name}</b>
                    <span>
                      {resolvedUser.email} · {resolvedUser.university}
                    </span>
                  </div>
                  <span className="identity-pill">
                    Member since {formatMemberSince(resolvedUser.createdAt)}
                  </span>
                </div>

                <form onSubmit={handleSaveProfile} noValidate>
                  <div className="form-grid">
                    <div className="field-group full">
                      <label className="field-label" htmlFor="set-fullName">
                        <span>Full name</span>
                      </label>
                      <input
                        id="set-fullName"
                        className="input"
                        type="text"
                        value={fullName}
                        onChange={(e) => {
                          setDrafts((prev) => ({ ...prev, fullName: e.target.value }));
                          if (profileMsg) setProfileMsg(null);
                        }}
                        placeholder="e.g., Fahim Tajwar"
                      />
                    </div>

                    <div className="field-group">
                      <label className="field-label" htmlFor="set-email">
                        <span>Email address</span>
                        <span className="locked-tag">Verified</span>
                      </label>
                      <input
                        id="set-email"
                        className="input"
                        type="email"
                        value={resolvedUser.email}
                        readOnly
                      />
                    </div>

                    <div className="field-group">
                      <label className="field-label" htmlFor="set-university">
                        <span>University / Institution</span>
                        <span className="locked-tag">Locked</span>
                      </label>
                      <input
                        id="set-university"
                        className="input"
                        type="text"
                        value={resolvedUser.university}
                        readOnly
                      />
                    </div>

                    <div className="field-group">
                      <label className="field-label" htmlFor="set-studentId">
                        <span>Student ID</span>
                        <span className="locked-tag">
                          {resolvedUser.studentId ? "Submitted" : "Pending"}
                        </span>
                      </label>
                      <input
                        id="set-studentId"
                        className="input"
                        type="text"
                        value={resolvedUser.studentId || "Not submitted yet"}
                        readOnly
                      />
                    </div>

                    <div className="field-group">
                      <label className="field-label" htmlFor="set-department">
                        <span>Department</span>
                      </label>
                      <input
                        id="set-department"
                        className="input"
                        type="text"
                        value={department}
                        onChange={(e) => {
                          setDrafts((prev) => ({ ...prev, department: e.target.value }));
                          if (profileMsg) setProfileMsg(null);
                        }}
                        placeholder="e.g., CSE or Textile Engineering"
                      />
                    </div>

                    <div className="field-group">
                      <label className="field-label" htmlFor="set-programme">
                        <span>Programme</span>
                      </label>
                      <select
                        id="set-programme"
                        className="select"
                        value={PROGRAMMES.includes(programme) ? programme : "Other"}
                        onChange={(e) =>
                          setDrafts((prev) => ({ ...prev, programme: e.target.value }))
                        }
                      >
                        {PROGRAMMES.map((p) => (
                          <option key={p} value={p}>
                            {p}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="field-group">
                      <label className="field-label" htmlFor="set-session">
                        <span>Academic session</span>
                      </label>
                      <select
                        id="set-session"
                        className="select"
                        value={SESSIONS.includes(academicSession) ? academicSession : academicSession}
                        onChange={(e) =>
                          setDrafts((prev) => ({
                            ...prev,
                            academicSession: e.target.value,
                          }))
                        }
                      >
                        {!SESSIONS.includes(academicSession) && academicSession && (
                          <option value={academicSession}>{academicSession}</option>
                        )}
                        {SESSIONS.map((s) => (
                          <option key={s} value={s}>
                            {s}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {profileMsg && (
                    <div
                      className={`alert ${profileMsg.type}`}
                      role={profileMsg.type === "err" ? "alert" : "status"}
                    >
                      {profileMsg.text}
                    </div>
                  )}

                  <div className="card-actions">
                    {!resolvedUser.studentId && (
                      <Link href="/student-verification" className="btn">
                        Complete Student Verification
                      </Link>
                    )}
                    <button
                      type="submit"
                      className="btn solid"
                      disabled={isSavingProfile}
                    >
                      {isSavingProfile ? "Saving..." : "Save Profile"}
                    </button>
                  </div>
                </form>
              </section>
            )}

            {activeSection === "privacy" && (
              <>
                <section className="card" aria-labelledby="safety-heading">
                  <div className="card-head">
                    <div>
                      <h2 id="safety-heading">Ride Companion Safety Profile</h2>
                      <p>
                        Your self-declared gender is kept private and only used to enforce{" "}
                        <strong>Women Only</strong> / <strong>Men Only</strong> campus
                        travel matching.
                      </p>
                    </div>
                  </div>

                  <div className="field-group">
                    <span className="field-label">Private profile gender</span>
                    <div className="seg-grid" role="radiogroup" aria-label="Profile gender">
                      {[
                        { value: "female", label: "Female" },
                        { value: "male", label: "Male" },
                        { value: "other", label: "Other" },
                        { value: "", label: "Not specified" },
                      ].map((opt) => (
                        <button
                          key={opt.label}
                          type="button"
                          role="radio"
                          aria-checked={selectedGender === opt.value}
                          className={`seg-btn ${selectedGender === opt.value ? "active" : ""}`}
                          onClick={() => {
                            setDrafts((prev) => ({ ...prev, gender: opt.value }));
                            if (privacyMsg) setPrivacyMsg(null);
                          }}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>
                    <p className="hint">
                      Never displayed publicly on marketplace listings or public ride cards.
                    </p>
                  </div>

                  <div className="field-group" style={{ marginTop: "18px" }}>
                    <label className="field-label" htmlFor="set-ride-pref">
                      <span>Default travel companion filter</span>
                    </label>
                    <select
                      id="set-ride-pref"
                      className="select"
                      value={prefs.defaultRidePreference}
                      onChange={(e) =>
                        updatePref(
                          "defaultRidePreference",
                          e.target.value as NotificationPrefs["defaultRidePreference"]
                        )
                      }
                    >
                      <option value="no_preference">
                        No Preference (All verified peers)
                      </option>
                      <option value="women_only">Women Only (Verified female peers)</option>
                      <option value="men_only">Men Only (Verified male peers)</option>
                    </select>
                  </div>

                  {privacyMsg && (
                    <div
                      className={`alert ${privacyMsg.type}`}
                      role={privacyMsg.type === "err" ? "alert" : "status"}
                    >
                      {privacyMsg.text}
                    </div>
                  )}

                  <div className="card-actions">
                    <button
                      type="button"
                      className="btn solid"
                      onClick={handleSavePrivacy}
                      disabled={isSavingPrivacy}
                    >
                      {isSavingPrivacy ? "Saving..." : "Save Safety Settings"}
                    </button>
                  </div>
                </section>

                <section className="card" aria-labelledby="campus-links-heading">
                  <div className="card-head">
                    <div>
                      <h2 id="campus-links-heading">Campus Safety &amp; Account Shortcuts</h2>
                      <p>Quick access to your verified safety contacts, wallet, and listings.</p>
                    </div>
                  </div>
                  <div className="link-grid">
                    <Link href="/sos" className="quick-card">
                      <b>Emergency SOS</b>
                      <span>
                        {sosContactsCount === null
                          ? "Manage emergency WhatsApp & call contacts."
                          : `${sosContactsCount} trusted contact${
                              sosContactsCount === 1 ? "" : "s"
                            } configured.`}
                      </span>
                      <em>Open SOS Setup →</em>
                    </Link>
                    <Link href="/wallet" className="quick-card">
                      <b>Campus Wallet</b>
                      <span>Current balance: {resolvedUser.tokenBalance} tokens.</span>
                      <em>Manage Wallet →</em>
                    </Link>
                    <Link href="/my-products" className="quick-card">
                      <b>My Products</b>
                      <span>Edit active listings, rates, and availability.</span>
                      <em>View Listings →</em>
                    </Link>
                  </div>
                </section>
              </>
            )}

            {activeSection === "security" && (
              <>
                <section className="card" aria-labelledby="pw-heading">
                  <div className="card-head">
                    <div>
                      <h2 id="pw-heading">Change Password</h2>
                      <p>
                        Use at least 8 characters with letters, numbers, and no repeating
                        patterns.
                      </p>
                    </div>
                  </div>

                  <form onSubmit={handleChangePassword} noValidate>
                    <div className="form-grid">
                      <div className="field-group full">
                        <label className="field-label" htmlFor="set-curr-pw">
                          <span>Current password</span>
                        </label>
                        <div className="pw-wrap">
                          <input
                            id="set-curr-pw"
                            className="input"
                            type={showCurrentPw ? "text" : "password"}
                            value={currentPassword}
                            onChange={(e) => {
                              setCurrentPassword(e.target.value);
                              if (pwMsg) setPwMsg(null);
                            }}
                            autoComplete="current-password"
                            placeholder="Enter current password"
                          />
                          <button
                            type="button"
                            className="pw-eye"
                            aria-label={showCurrentPw ? "Hide password" : "Show password"}
                            onClick={() => setShowCurrentPw((v) => !v)}
                          >
                            {showCurrentPw ? "Hide" : "Show"}
                          </button>
                        </div>
                      </div>

                      <div className="field-group">
                        <label className="field-label" htmlFor="set-new-pw">
                          <span>New password</span>
                        </label>
                        <div className="pw-wrap">
                          <input
                            id="set-new-pw"
                            className="input"
                            type={showNewPw ? "text" : "password"}
                            value={newPassword}
                            onChange={(e) => {
                              setNewPassword(e.target.value);
                              if (pwMsg) setPwMsg(null);
                            }}
                            autoComplete="new-password"
                            placeholder="At least 8 characters"
                          />
                          <button
                            type="button"
                            className="pw-eye"
                            aria-label={showNewPw ? "Hide password" : "Show password"}
                            onClick={() => setShowNewPw((v) => !v)}
                          >
                            {showNewPw ? "Hide" : "Show"}
                          </button>
                        </div>
                      </div>

                      <div className="field-group">
                        <label className="field-label" htmlFor="set-confirm-pw">
                          <span>Confirm new password</span>
                        </label>
                        <input
                          id="set-confirm-pw"
                          className="input"
                          type={showNewPw ? "text" : "password"}
                          value={confirmNewPassword}
                          onChange={(e) => {
                            setConfirmNewPassword(e.target.value);
                            if (pwMsg) setPwMsg(null);
                          }}
                          autoComplete="new-password"
                          placeholder="Re-enter new password"
                        />
                      </div>
                    </div>

                    {pwMsg && (
                      <div
                        className={`alert ${pwMsg.type}`}
                        role={pwMsg.type === "err" ? "alert" : "status"}
                      >
                        {pwMsg.text}
                      </div>
                    )}

                    <div className="card-actions">
                      <Link href="/forgot-password" className="btn">
                        Reset via Email OTP
                      </Link>
                      <button
                        type="submit"
                        className="btn solid"
                        disabled={isChangingPw}
                      >
                        {isChangingPw ? "Updating..." : "Update Password"}
                      </button>
                    </div>
                  </form>
                </section>

                <section className="card" aria-labelledby="session-heading">
                  <div className="card-head">
                    <div>
                      <h2 id="session-heading">Account Session &amp; Verification</h2>
                      <p>
                        Signed in as <strong>{resolvedUser.email}</strong> (
                        {resolvedUser.university}).
                      </p>
                    </div>
                  </div>
                  <div className="card-actions" style={{ marginTop: 0 }}>
                    {!resolvedUser.verified && (
                      <Link
                        href={
                          resolvedUser.studentId
                            ? "/verification-pending"
                            : "/student-verification"
                        }
                        className="btn"
                      >
                        {resolvedUser.studentId
                          ? "Check Verification Status"
                          : "Verify Student ID"}
                      </Link>
                    )}
                    <button
                      type="button"
                      className="btn danger"
                      onClick={handleSignOut}
                    >
                      Log out of UniShare
                    </button>
                  </div>
                </section>
              </>
            )}

            {activeSection === "notifications" && (
              <section className="card" aria-labelledby="notif-heading">
                <div className="card-head">
                  <div>
                    <h2 id="notif-heading">Notification &amp; Alert Preferences</h2>
                    <p>
                      Control which campus updates appear for {resolvedUser.email}.
                    </p>
                  </div>
                </div>

                <div className="pref-list">
                  {[
                    {
                      key: "rentals" as const,
                      title: "Rental requests & pickup reminders",
                      desc: "Alerts for incoming borrow requests, approved handoffs, and due times.",
                    },
                    {
                      key: "rides" as const,
                      title: "Ride companion matches & arrival alerts",
                      desc: "Live updates when verified peers match your route or accept travel invites.",
                    },
                    {
                      key: "sos" as const,
                      title: "Campus SOS & safety confirmations",
                      desc: "Instant confirmation when emergency contacts receive your tracking link.",
                    },
                    {
                      key: "wallet" as const,
                      title: "Wallet tokens & deposit releases",
                      desc: "Receipts for token purchases, transfers, and refundable deposit returns.",
                    },
                  ].map((item) => {
                    const enabled = prefs[item.key];
                    return (
                      <div className="pref-row" key={item.key}>
                        <div className="pref-info">
                          <b>{item.title}</b>
                          <p>{item.desc}</p>
                        </div>
                        <button
                          type="button"
                          role="switch"
                          aria-checked={enabled}
                          aria-label={item.title}
                          className={`toggle-switch ${enabled ? "on" : ""}`}
                          onClick={() => updatePref(item.key, !enabled)}
                        />
                      </div>
                    );
                  })}
                </div>
              </section>
            )}
          </div>
        </div>
      </main>

      <footer>
        <div className="wrap">
          <span>UniShare. Made for university students in Bangladesh.</span>
          <div style={{ display: "flex", gap: "16px" }}>
            <Link href="/home">Dashboard</Link>
            <Link href="/sos">Emergency SOS</Link>
            <Link href="/wallet">Wallet</Link>
          </div>
        </div>
      </footer>

      <div
        className={`toast ${showToast ? "on" : ""}`}
        role="status"
        aria-live="polite"
      >
        {toastMsg}
      </div>
    </div>
  );
}

