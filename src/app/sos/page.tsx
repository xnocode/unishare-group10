"use client";

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import AppNavbar from "../components/AppNavbar";
import {
  getUserScopedKey,
  useCurrentUser,
  useRequireAuth,
  writeUserScopedJson,
} from "../lib/user-client";
import "../campus-home.css";

interface EmergencyContact {
  id: string;
  userId: string;
  name: string;
  phoneNumber: string;
  relationship: string;
  priority: number;
  createdAt?: string;
  updatedAt?: string;
}

export default function SOSSetupPage() {
  const { resolvedUser: currentUser, isDemoUser, isHydrated } = useCurrentUser();
  const isAuthenticated = useRequireAuth("/sos");
  const contactsStorageKey = getUserScopedKey(
    "unishare_emergency_contacts",
    currentUser.email,
    isDemoUser
  );

  // Single Emergency Contact State (Max 1)
  const [contact, setContact] = useState<EmergencyContact | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [confirmRemove, setConfirmRemove] = useState(false);

  // Form Fields
  const [formName, setFormName] = useState("");
  const [formPhone, setFormPhone] = useState("");
  const [formRelationship, setFormRelationship] = useState("Family / Guardian");
  const [formError, setFormError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Toast feedback
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(null);
    }, 3500);
  };

  // Load Saved Emergency Contact
  const loadData = useCallback(async () => {
    if (!isHydrated || !currentUser.email) return;
    setIsLoading(true);

    try {
      const rawContacts = localStorage.getItem("unishare_emergency_contacts");
      if (rawContacts && rawContacts.includes("1939853593")) {
        localStorage.removeItem("unishare_emergency_contacts");
      }
      const rawContact = localStorage.getItem("unishare_emergency_contact");
      if (rawContact && rawContact.includes("1939853593")) {
        localStorage.removeItem("unishare_emergency_contact");
      }
      const res = await fetch("/api/emergency-contacts", {
        headers: { "x-user-email": currentUser.email },
      });
      const data = await res.json();
      if (data.success && Array.isArray(data.contacts) && data.contacts.length > 0) {
        setContact(data.contacts[0]);
        writeUserScopedJson(contactsStorageKey, data.contacts);
      } else {
        setContact(null);
        writeUserScopedJson(contactsStorageKey, []);
        setIsEditing(true); // Open form if empty
      }
    } catch (err) {
      console.error("Error fetching emergency contact:", err);
      showToast("Unable to load contact settings. Please refresh.");
    } finally {
      setIsLoading(false);
    }
  }, [contactsStorageKey, currentUser.email, isHydrated]);

  useEffect(() => {
    const t = setTimeout(() => {
      void loadData();
    }, 0);
    return () => clearTimeout(t);
  }, [loadData]);

  // Open Edit Form pre-filled
  const handleOpenEdit = () => {
    if (contact) {
      setFormName(contact.name);
      setFormPhone(contact.phoneNumber);
      setFormRelationship(contact.relationship || "Family / Guardian");
    }
    setFormError("");
    setIsEditing(true);
  };

  // Cancel Edit
  const handleCancelEdit = () => {
    if (contact) {
      setIsEditing(false);
    }
    setFormError("");
  };

  // Save / Update Emergency Contact (Direct 1-Click Save)
  const handleSaveContact = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError("");

    if (!formName.trim()) {
      setFormError("Please enter the contact person's name.");
      return;
    }

    const cleanPhone = formPhone.trim().replace(/[\s\-\(\)]/g, "");
    if (!cleanPhone || cleanPhone.length < 10) {
      setFormError("Please enter a valid 11-digit mobile number (e.g., 019XXXXXXXX).");
      return;
    }

    setIsSubmitting(true);

    try {
      let res;
      if (contact?.id) {
        // Update existing contact
        res = await fetch("/api/emergency-contacts", {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            "x-user-email": currentUser.email,
          },
          body: JSON.stringify({
            id: contact.id,
            name: formName.trim(),
            phoneNumber: cleanPhone,
            relationship: formRelationship,
            priority: 1,
            email: currentUser.email,
          }),
        });
      } else {
        // Create new contact
        res = await fetch("/api/emergency-contacts", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-user-email": currentUser.email,
          },
          body: JSON.stringify({
            name: formName.trim(),
            phoneNumber: cleanPhone,
            relationship: formRelationship,
            priority: 1,
            email: currentUser.email,
          }),
        });
      }

      const data = await res.json();
      if (data.success) {
        const nextContacts =
          Array.isArray(data.contacts) && data.contacts.length > 0
            ? data.contacts
            : data.contact
            ? [data.contact]
            : [];
        if (nextContacts.length > 0) {
          setContact(nextContacts[0]);
        }
        writeUserScopedJson(contactsStorageKey, nextContacts);
        setIsEditing(false);
        showToast("✓ Emergency contact saved successfully!");

        // Trigger navbar SOS listener reload
        window.dispatchEvent(new Event("storage"));
      } else {
        setFormError(data.error || "Failed to save emergency contact.");
      }
    } catch (err) {
      console.error(err);
      setFormError("Network error saving contact. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Remove Contact
  const handleRemoveContact = async () => {
    if (!contact) return;

    try {
      const res = await fetch(`/api/emergency-contacts?id=${encodeURIComponent(contact.id)}`, {
        method: "DELETE",
        headers: { "x-user-email": currentUser.email },
      });
      const data = await res.json();
      if (data.success) {
        setContact(null);
        setConfirmRemove(false);
        writeUserScopedJson(contactsStorageKey, []);
        setFormName("");
        setFormPhone("");
        setIsEditing(true);
        showToast("Emergency contact removed.");
        window.dispatchEvent(new Event("storage"));
      }
    } catch {
      showToast("Error deleting contact.");
    }
  };

  // Test WhatsApp Alert (Automated Server Dispatch via UltraMsg + Web fallback)
  const handleTestWhatsApp = async () => {
    if (!contact) return;
    showToast(`Sending automated test alert to ${contact.name}...`);

    try {
      const res = await fetch("/api/sos/send-whatsapp", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-user-email": currentUser.email,
        },
        body: JSON.stringify({
          toPhoneNumber: contact.phoneNumber,
          studentName: currentUser.name,
          trackingUrl: `${window.location.origin}/sos`,
        }),
      });
      const data = await res.json();

      if (data.success) {
        showToast(`✓ Automatic WhatsApp alert sent to ${contact.phoneNumber}!`);
      } else {
        showToast(data.error || "Failed to dispatch WhatsApp alert via gateway.");
      }
    } catch {
      showToast("Network error contacting WhatsApp gateway.");
    }
  };

  // Test Phone Dialpad
  const handleTestDialpad = () => {
    if (!contact) return;
    const clean = contact.phoneNumber.replace(/[^\d+]/g, "");
    window.location.href = `tel:${clean}`;
  };

  if (!isAuthenticated) {
    return (
      <div className="unishare-campus-home" style={{ minHeight: "100vh", background: "#ffffff" }}>
        <AppNavbar activeNav="sos" />
        <main className="wrap" style={{ paddingTop: "36px" }}>
          <div style={{ height: "42px", width: "260px", borderRadius: "8px", background: "#f5f7f6", marginBottom: "18px" }} />
          <div style={{ height: "140px", borderRadius: "12px", background: "#e9f2ef" }} />
        </main>
      </div>
    );
  }

  return (
    <div className="unishare-campus-home">
      {/* GLOBAL NAVBAR */}
      <AppNavbar
        mode="app"
        activeNav="sos"
        user={{
          name: currentUser.name,
          email: currentUser.email,
          initials: currentUser.initials,
          university: currentUser.university,
          tokenBalance: currentUser.tokenBalance,
        }}
      />

      {/* TOAST FEEDBACK */}
      {toastMessage && (
        <div
          role="status"
          style={{
            position: "fixed",
            bottom: "88px",
            right: "24px",
            background: "#161b1a",
            color: "#ffffff",
            padding: "12px 18px",
            borderRadius: "8px",
            fontSize: "13.5px",
            fontWeight: 600,
            boxShadow: "0 8px 24px rgba(0,0,0,0.25)",
            zIndex: 10000,
            borderLeft: "4px solid #0d6b63",
          }}
        >
          {toastMessage}
        </div>
      )}

      {/* MAIN CONTENT WRAPPER */}
      <main className="wrap" style={{ maxWidth: "1000px", margin: "0 auto", padding: "24px 24px 56px", flex: 1 }}>
        <nav className="crumbs" aria-label="Breadcrumb">
          <Link href="/home">Home</Link>
          <span>›</span>
          <span className="current">Emergency SOS</span>
        </nav>

        {/* HERO SECTION MATCHING CAMPUS HOME */}
        <div className="eyebrow" style={{ marginTop: "24px" }}>{currentUser.university} · Verified students only</div>
        <div className="hero" style={{ marginTop: "6px", marginBottom: "22px" }}>
          <div>
            <h1>Emergency Contact Setup</h1>
            <p className="sub" style={{ maxWidth: "680px" }}>
              Configure your trusted emergency contact number. Pressing &amp; holding the red <strong>SOS</strong> button in the top navigation bar for 2 seconds dispatches an instant alert with your GPS coordinates and opens your dialer.
            </p>
          </div>
        </div>

        {/* STATUS BAND */}
        {isLoading ? (
          <div className="band" style={{ background: "#f5f7f6", color: "#4b5553", border: "1px solid #d5dcda", marginBottom: "24px" }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <path d="M12 7v5l3 2" />
            </svg>
            <div>
              <b>Checking Emergency Contact Status...</b>
              <p>Loading your configured campus safety contact from UniShare.</p>
            </div>
            <span>Syncing...</span>
          </div>
        ) : contact ? (
          <div className="band" style={{ background: "#e9f2ef", color: "#0d6b63", marginBottom: "24px" }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
              <path d="M9 12l2 2 4-4" />
            </svg>
            <div>
              <b>Emergency Contact Active &amp; Ready</b>
              <p>Your trusted contact ({contact.name} · {contact.phoneNumber}) is verified and linked to your top-bar SOS button.</p>
            </div>
            <span>1 / 1 Configured</span>
          </div>
        ) : (
          <div className="band" style={{ background: "#fff8ee", color: "#9a3412", border: "1px solid #fcd34d", marginBottom: "24px" }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
            <div>
              <b>No Emergency Contact Configured</b>
              <p>Please add and verify your trusted contact number below so you can trigger the top-bar SOS button.</p>
            </div>
            <span>0 / 1 Configured</span>
          </div>
        )}

        {/* 2-COLUMN MAIN CONTENT: LEFT = CONTACT CARD/FORM, RIGHT = INSTRUCTIONS & HELPLINES */}
        <div className="sos-main-grid">
          
          {/* ================= LEFT: EMERGENCY CONTACT CARD OR FORM ================= */}
          <div
            style={{
              background: "#ffffff",
              border: "1.5px solid #d5dcda",
              borderRadius: "10px",
              padding: "24px",
              boxShadow: "0 2px 8px rgba(0,0,0,0.03)",
            }}
          >
            {isLoading ? (
              <div style={{ padding: "40px 0", textAlign: "center", color: "#4b5553", fontSize: "14px" }}>
                Loading contact settings...
              </div>
            ) : !isEditing && contact ? (
              /* VIEW MODE: CONFIGURED CONTACT */
              <div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "16px" }}>
                  <div>
                    <span style={{ fontSize: "11px", fontWeight: 700, color: "#0d6b63", textTransform: "uppercase", letterSpacing: "0.06em" }}>
                      Primary Emergency Contact
                    </span>
                    <h2 style={{ fontSize: "22px", fontWeight: 700, color: "#161b1a", marginTop: "4px" }}>
                      {contact.name}
                    </h2>
                    <span style={{ fontSize: "13px", color: "#4b5553" }}>
                      {contact.relationship}
                    </span>
                  </div>

                  <span
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "5px",
                      background: "#e9f2ef",
                      color: "#0d6b63",
                      fontSize: "12px",
                      fontWeight: 700,
                      padding: "4px 10px",
                      borderRadius: "6px",
                    }}
                  >
                    ✓ Verified Number
                  </span>
                </div>

                <div
                  style={{
                    background: "#f5f7f6",
                    border: "1px solid #d5dcda",
                    borderRadius: "8px",
                    padding: "16px",
                    marginBottom: "20px",
                  }}
                >
                  <div style={{ fontSize: "11.5px", fontWeight: 600, color: "#4b5553", textTransform: "uppercase", marginBottom: "4px" }}>
                    Verified Mobile Phone Number
                  </div>
                  <div style={{ fontSize: "20px", fontWeight: 700, color: "#0d6b63", letterSpacing: "0.02em" }}>
                    📞 {contact.phoneNumber}
                  </div>
                </div>

                {/* ACTION BUTTONS */}
                <div style={{ display: "flex", gap: "10px", flexWrap: "wrap", marginBottom: "18px" }}>
                  <button
                    type="button"
                    className="btn solid"
                    style={{ padding: "8px 16px", fontSize: "13.5px" }}
                    onClick={handleOpenEdit}
                  >
                    ✏️ Change / Edit Number
                  </button>

                  <button
                    type="button"
                    className="btn"
                    style={{ padding: "8px 16px", fontSize: "13.5px", borderColor: "#25D366", color: "#047857" }}
                    onClick={handleTestWhatsApp}
                    title="Test WhatsApp connection to this number"
                  >
                    💬 Test WhatsApp Alert
                  </button>

                  <button
                    type="button"
                    className="btn"
                    style={{ padding: "8px 16px", fontSize: "13.5px" }}
                    onClick={handleTestDialpad}
                    title="Test launching your phone dialpad"
                  >
                    📞 Test Dialpad
                  </button>
                </div>

                <div style={{ borderTop: "1px solid #e5eae8", paddingTop: "14px", display: "flex", justifyContent: "flex-end", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
                  {confirmRemove ? (
                    <>
                      <span style={{ fontSize: "12.5px", color: "#4b5553", fontWeight: 600 }}>
                        Remove {contact.name}?
                      </span>
                      <button
                        type="button"
                        className="btn"
                        style={{ padding: "5px 12px", fontSize: "12.5px" }}
                        onClick={() => setConfirmRemove(false)}
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        className="btn"
                        style={{ padding: "5px 12px", fontSize: "12.5px", background: "#b3261e", borderColor: "#b3261e", color: "#ffffff" }}
                        onClick={handleRemoveContact}
                      >
                        Yes, remove
                      </button>
                    </>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setConfirmRemove(true)}
                      style={{
                        background: "transparent",
                        border: "none",
                        color: "#b3261e",
                        fontSize: "13px",
                        fontWeight: 600,
                        cursor: "pointer",
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "4px",
                      }}
                    >
                      🗑️ Remove Emergency Contact
                    </button>
                  )}
                </div>
              </div>
            ) : (
              /* ADD / EDIT FORM MODE */
              <form onSubmit={handleSaveContact}>
                <div style={{ marginBottom: "16px" }}>
                  <span style={{ fontSize: "11px", fontWeight: 700, color: "#0d6b63", textTransform: "uppercase", letterSpacing: "0.06em" }}>
                    {contact ? "Edit Emergency Contact" : "Add Emergency Contact"}
                  </span>
                  <h2 style={{ fontSize: "20px", fontWeight: 700, color: "#161b1a", marginTop: "2px" }}>
                    {contact ? "Update Contact Details" : "Set Your Trusted Number"}
                  </h2>
                  <p style={{ fontSize: "13px", color: "#4b5553", marginTop: "2px" }}>
                    Enter 1 verified phone number that will receive emergency alerts when you hold the top-bar SOS button.
                  </p>
                </div>

                {formError && (
                  <div
                    style={{
                      background: "#fef2f2",
                      border: "1px solid #fecaca",
                      color: "#b91c1c",
                      borderRadius: "6px",
                      padding: "10px 14px",
                      fontSize: "13px",
                      marginBottom: "16px",
                    }}
                  >
                    ⚠️ {formError}
                  </div>
                )}

                {/* Contact Name */}
                <div style={{ marginBottom: "14px" }}>
                  <label style={{ display: "block", fontSize: "12.5px", fontWeight: 700, color: "#161b1a", marginBottom: "5px" }}>
                    Contact Person Name <span style={{ color: "#b3261e" }}>*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g., Parent, Roommate, Elder Brother"
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                    style={{
                      width: "100%",
                      padding: "10px 12px",
                      border: "1.5px solid #d5dcda",
                      borderRadius: "6px",
                      fontSize: "14px",
                      outline: "none",
                      background: "#ffffff",
                    }}
                  />
                </div>

                {/* Relationship */}
                <div style={{ marginBottom: "14px" }}>
                  <label style={{ display: "block", fontSize: "12.5px", fontWeight: 700, color: "#161b1a", marginBottom: "5px" }}>
                    Relationship
                  </label>
                  <select
                    value={formRelationship}
                    onChange={(e) => setFormRelationship(e.target.value)}
                    style={{
                      width: "100%",
                      padding: "10px 12px",
                      border: "1.5px solid #d5dcda",
                      borderRadius: "6px",
                      fontSize: "14px",
                      outline: "none",
                      background: "#ffffff",
                    }}
                  >
                    <option value="Parent / Mother">Parent / Mother</option>
                    <option value="Parent / Father">Parent / Father</option>
                    <option value="Family / Guardian">Family / Guardian</option>
                    <option value="Roommate / Hallmate">Roommate / Hallmate</option>
                    <option value="University Department Friend">University Department Friend</option>
                    <option value="Local Guardian">Local Guardian</option>
                  </select>
                </div>

                {/* Mobile Phone Number */}
                <div style={{ marginBottom: "22px" }}>
                  <label style={{ display: "block", fontSize: "12.5px", fontWeight: 700, color: "#161b1a", marginBottom: "5px" }}>
                    Mobile Phone Number <span style={{ color: "#b3261e" }}>*</span>
                  </label>
                  <input
                    type="tel"
                    required
                    placeholder="e.g., 019XXXXXXXX or +88019XXXXXXXX"
                    value={formPhone}
                    onChange={(e) => setFormPhone(e.target.value)}
                    style={{
                      width: "100%",
                      padding: "10px 12px",
                      border: "1.5px solid #d5dcda",
                      borderRadius: "6px",
                      fontSize: "15px",
                      fontWeight: 600,
                      outline: "none",
                      background: "#ffffff",
                    }}
                  />
                  <span style={{ fontSize: "12px", color: "#4b5553", marginTop: "4px", display: "block" }}>
                    WhatsApp alert and phone dialer will connect to this number when SOS is pressed.
                  </span>
                </div>

                {/* FORM ACTIONS */}
                <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="btn solid"
                    style={{
                      padding: "10px 24px",
                      fontSize: "14px",
                      fontWeight: 700,
                    }}
                  >
                    {isSubmitting ? "Saving..." : "✓ Save Emergency Contact"}
                  </button>

                  {contact && (
                    <button
                      type="button"
                      className="btn"
                      style={{ padding: "10px 18px", fontSize: "14px" }}
                      onClick={handleCancelEdit}
                    >
                      Cancel
                    </button>
                  )}
                </div>
              </form>
            )}
          </div>

          {/* ================= RIGHT: HOW IT WORKS & CAMPUS HELPLINES ================= */}
          <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
            
            {/* HOW IT WORKS */}
            <div
              style={{
                background: "#ffffff",
                border: "1.5px solid #d5dcda",
                borderRadius: "10px",
                padding: "20px",
              }}
            >
              <h3 style={{ fontSize: "16px", fontWeight: 700, color: "#161b1a", marginBottom: "12px" }}>
                How UniShare Campus SOS Works
              </h3>

              <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
                <div style={{ display: "flex", gap: "10px", alignItems: "flex-start" }}>
                  <span style={{ background: "#e9f2ef", color: "#0d6b63", width: "24px", height: "24px", borderRadius: "50%", display: "grid", placeItems: "center", fontWeight: 800, fontSize: "12px", flexShrink: 0 }}>
                    1
                  </span>
                  <div>
                    <div style={{ fontSize: "13.5px", fontWeight: 700, color: "#161b1a" }}>
                      Set Your Contact Once
                    </div>
                    <p style={{ fontSize: "12px", color: "#4b5553", margin: "2px 0 0", lineHeight: "1.4" }}>
                      Save and verify 1 trusted family member or roommate on this settings page.
                    </p>
                  </div>
                </div>

                <div style={{ display: "flex", gap: "10px", alignItems: "flex-start" }}>
                  <span style={{ background: "#fee2e2", color: "#b91c1c", width: "24px", height: "24px", borderRadius: "50%", display: "grid", placeItems: "center", fontWeight: 800, fontSize: "12px", flexShrink: 0 }}>
                    2
                  </span>
                  <div>
                    <div style={{ fontSize: "13.5px", fontWeight: 700, color: "#161b1a" }}>
                      Top-Bar SOS Everywhere
                    </div>
                    <p style={{ fontSize: "12px", color: "#4b5553", margin: "2px 0 0", lineHeight: "1.4" }}>
                      The red <strong>SOS</strong> pill stays pinned inside the top navigation bar across every UniShare page. Tap once to manage setup, or press &amp; hold for 2 seconds to trigger an alert.
                    </p>
                  </div>
                </div>

                <div style={{ display: "flex", gap: "10px", alignItems: "flex-start" }}>
                  <span style={{ background: "#e9f2ef", color: "#0d6b63", width: "24px", height: "24px", borderRadius: "50%", display: "grid", placeItems: "center", fontWeight: 800, fontSize: "12px", flexShrink: 0 }}>
                    3
                  </span>
                  <div>
                    <div style={{ fontSize: "13.5px", fontWeight: 700, color: "#161b1a" }}>
                      Instant Alert &amp; Dialpad
                    </div>
                    <p style={{ fontSize: "12px", color: "#4b5553", margin: "2px 0 0", lineHeight: "1.4" }}>
                      Holding SOS for 2 seconds dispatches your live GPS coordinates to your saved contact and opens your phone dialer automatically.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* CAMPUS & NATIONAL HELPLINES */}
            <div
              style={{
                background: "#f5f7f6",
                border: "1.5px solid #d5dcda",
                borderRadius: "10px",
                padding: "20px",
              }}
            >
              <h3 style={{ fontSize: "15px", fontWeight: 700, color: "#161b1a", marginBottom: "10px" }}>
                Emergency Helplines (24/7)
              </h3>

              <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                {currentUser.university.toLowerCase().includes("dhaka") && (
                  <a
                    href="tel:01711374747"
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      background: "#ffffff",
                      border: "1px solid #d5dcda",
                      borderRadius: "6px",
                      padding: "9px 12px",
                      fontSize: "13px",
                      fontWeight: 600,
                      color: "#161b1a",
                    }}
                  >
                    <span>DU Proctor &amp; Campus Security</span>
                    <span style={{ color: "#0d6b63", fontWeight: 700 }}>01711-374747</span>
                  </a>
                )}

                <a
                  href="tel:999"
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    background: "#ffffff",
                    border: "1px solid #fecaca",
                    borderRadius: "6px",
                    padding: "9px 12px",
                    fontSize: "13px",
                    fontWeight: 600,
                    color: "#b91c1c",
                  }}
                >
                  <span>National Emergency Helpline</span>
                  <span style={{ fontWeight: 800 }}>🚨 999</span>
                </a>

                <a
                  href="tel:199"
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    background: "#ffffff",
                    border: "1px solid #d5dcda",
                    borderRadius: "6px",
                    padding: "9px 12px",
                    fontSize: "13px",
                    fontWeight: 600,
                    color: "#161b1a",
                  }}
                >
                  <span>National Ambulance Service</span>
                  <span style={{ color: "#0d6b63", fontWeight: 700 }}>199</span>
                </a>

                <a
                  href="tel:109"
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    background: "#ffffff",
                    border: "1px solid #d5dcda",
                    borderRadius: "6px",
                    padding: "9px 12px",
                    fontSize: "13px",
                    fontWeight: 600,
                    color: "#161b1a",
                  }}
                >
                  <span>Women &amp; Children Helpline</span>
                  <span style={{ color: "#0d6b63", fontWeight: 700 }}>109</span>
                </a>
              </div>
            </div>

          </div>

        </div>

      </main>

      <footer>
        <div className="wrap">
          <span>UniShare. Made for university students in Bangladesh.</span>
          <span>
            <Link href="/privacy" style={{ marginLeft: 0 }}>Privacy</Link>
            <Link href="/terms">Terms</Link>
            <Link href="/help">Get help</Link>
            <Link href="/settings">Settings</Link>
          </span>
        </div>
      </footer>
    </div>
  );
}
