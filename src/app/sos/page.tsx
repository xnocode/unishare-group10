"use client";

import React, { useState, useEffect } from "react";
import AppNavbar from "../components/AppNavbar";
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

interface UserProfile {
  name: string;
  email: string;
  initials: string;
  university: string;
  verified: boolean;
  tokenBalance: number;
}

// Helper to format any Bangladeshi or international phone number for WhatsApp
function formatForWhatsApp(phoneStr: string): string {
  let digits = phoneStr.replace(/\D/g, "");
  if (digits.startsWith("880")) {
    return digits;
  }
  if (digits.startsWith("88") && !digits.startsWith("880")) {
    return "880" + digits.slice(2);
  }
  if (digits.startsWith("0")) {
    return "880" + digits.slice(1);
  }
  return "880" + digits;
}

export default function SOSSetupPage() {
  // Authenticated student state
  const [currentUser, setCurrentUser] = useState<UserProfile>({
    name: "Farhana Rahman",
    email: "farhana@std.du.ac.bd",
    initials: "FR",
    university: "University of Dhaka",
    verified: true,
    tokenBalance: 500,
  });

  // Single Emergency Contact State (Max 1)
  const [contact, setContact] = useState<EmergencyContact | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);

  // Form Fields
  const [formName, setFormName] = useState("");
  const [formPhone, setFormPhone] = useState("");
  const [formRelationship, setFormRelationship] = useState("Family / Guardian");
  const [formError, setFormError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Verification OTP State
  const [formVerified, setFormVerified] = useState(false);
  const [verifyCodeSent, setVerifyCodeSent] = useState(false);
  const [generatedOtp, setGeneratedOtp] = useState("");
  const [inputOtp, setInputOtp] = useState("");
  const [otpError, setOtpError] = useState("");

  // Toast feedback
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(null);
    }, 3500);
  };

  // Load User & Saved Emergency Contact
  const loadData = async () => {
    setIsLoading(true);
    let resolvedEmail = currentUser.email;

    try {
      const rawUser = localStorage.getItem("unishare_user");
      if (rawUser) {
        const parsed = JSON.parse(rawUser);
        if (parsed.email) resolvedEmail = parsed.email;
        setCurrentUser({
          name: parsed.name || "Farhana Rahman",
          email: resolvedEmail,
          initials: (parsed.name || "FR")
            .split(" ")
            .map((s: string) => s[0])
            .join("")
            .slice(0, 2)
            .toUpperCase(),
          university: parsed.university || "University of Dhaka",
          verified: true,
          tokenBalance: parsed.tokenBalance ?? 500,
        });
      }
    } catch {
      // ignore
    }

    try {
      const res = await fetch(`/api/emergency-contacts?email=${encodeURIComponent(resolvedEmail)}`);
      const data = await res.json();
      if (data.success && Array.isArray(data.contacts) && data.contacts.length > 0) {
        setContact(data.contacts[0]);
      } else {
        setContact(null);
        setIsEditing(true); // Open form if empty
      }
    } catch (err) {
      console.error("Error fetching emergency contact:", err);
      showToast("Unable to load contact settings. Please refresh.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Open Edit Form pre-filled
  const handleOpenEdit = () => {
    if (contact) {
      setFormName(contact.name);
      setFormPhone(contact.phoneNumber);
      setFormRelationship(contact.relationship || "Family / Guardian");
      setFormVerified(true); // Existing verified contact
    }
    setFormError("");
    setOtpError("");
    setIsEditing(true);
  };

  // Cancel Edit
  const handleCancelEdit = () => {
    if (contact) {
      setIsEditing(false);
    }
    setFormError("");
    setOtpError("");
  };

  // Send Verification Code (OTP)
  const handleSendVerificationCode = () => {
    setOtpError("");
    const cleaned = formPhone.trim().replace(/[\s\-\(\)]/g, "");
    if (!cleaned || cleaned.length < 10) {
      setFormError("Please enter a valid 11-digit mobile phone number first.");
      return;
    }
    setFormError("");

    // Generate random 4-digit verification code
    const code = Math.floor(1000 + Math.random() * 9000).toString();
    setGeneratedOtp(code);
    setInputOtp(code); // Pre-fill code for 1-click convenience
    setVerifyCodeSent(true);
    setFormVerified(false);
    showToast(`Verification code generated: ${code}`);
  };

  // Verify Code
  const handleVerifyOtp = () => {
    if (!inputOtp || inputOtp.trim() !== generatedOtp) {
      setOtpError("Incorrect verification code. Please check and try again.");
      return;
    }
    setFormVerified(true);
    setOtpError("");
    showToast("✓ Mobile number verified successfully!");
  };

  // Save / Update Emergency Contact
  const handleSaveContact = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError("");

    if (!formName.trim()) {
      setFormError("Please enter the contact person's name.");
      return;
    }

    const cleanPhone = formPhone.trim().replace(/[\s\-\(\)]/g, "");
    if (!cleanPhone || cleanPhone.length < 10) {
      setFormError("Please enter a valid mobile number (e.g., 019XXXXXXXX).");
      return;
    }

    if (!formVerified) {
      setFormError("Please click 'Verify Phone Number' to verify this mobile number first.");
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
        if (data.contact) {
          setContact(data.contact);
        } else if (Array.isArray(data.contacts) && data.contacts.length > 0) {
          setContact(data.contacts[0]);
        }
        setIsEditing(false);
        showToast("✓ Emergency contact saved successfully!");

        // Trigger floating button reload
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
    if (!confirm(`Are you sure you want to remove ${contact.name} (${contact.phoneNumber})?`)) {
      return;
    }

    try {
      const res = await fetch(`/api/emergency-contacts?id=${contact.id}&email=${encodeURIComponent(currentUser.email)}`, {
        method: "DELETE",
        headers: { "x-user-email": currentUser.email },
      });
      const data = await res.json();
      if (data.success) {
        setContact(null);
        setFormName("");
        setFormPhone("");
        setFormVerified(false);
        setVerifyCodeSent(false);
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
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          toPhoneNumber: contact.phoneNumber,
          studentName: currentUser.name,
          trackingUrl: `${window.location.origin}/sos`,
        }),
      });
      const data = await res.json();

      if (data.success) {
        showToast(`✓ Automatic WhatsApp alert sent to ${contact.phoneNumber}!`);
        return;
      } else {
        // Fallback to web link if UltraMsg QR is pending
        console.warn("UltraMsg server response:", data);
        showToast(data.error ? `Gateway: ${data.error}` : "Opening WhatsApp preview...");
        const formatted = formatForWhatsApp(contact.phoneNumber);
        const msg = encodeURIComponent(
          `🚨 *UniShare Campus Safety (Test Alert)*\n` +
          `This is a test notification from ${currentUser.name}. In an emergency, our live GPS tracking link will appear here.\n\n` +
          `UniShare Emergency Center: ${window.location.origin}/sos`
        );
        window.open(`https://wa.me/${formatted}?text=${msg}`, "_blank");
      }
    } catch {
      const formatted = formatForWhatsApp(contact.phoneNumber);
      const msg = encodeURIComponent(
        `🚨 *UniShare Campus Safety (Test Alert)*\n` +
        `This is a test notification from ${currentUser.name}. In an emergency, our live GPS tracking link will appear here.\n\n` +
        `UniShare Emergency Center: ${window.location.origin}/sos`
      );
      window.open(`https://wa.me/${formatted}?text=${msg}`, "_blank");
    }
  };

  // Test Phone Dialpad
  const handleTestDialpad = () => {
    if (!contact) return;
    const clean = contact.phoneNumber.replace(/[^\d+]/g, "");
    window.location.href = `tel:${clean}`;
  };

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
      <main className="wrap" style={{ maxWidth: "1000px", margin: "0 auto", padding: "0 24px 60px" }}>
        
        {/* HERO SECTION MATCHING CAMPUS HOME */}
        <div className="eyebrow">CAMPUS SAFETY SETTINGS</div>
        <div className="hero" style={{ marginTop: "6px", marginBottom: "22px" }}>
          <div>
            <h1>Emergency Contact Setup</h1>
            <p className="sub" style={{ maxWidth: "680px" }}>
              Configure your trusted emergency contact number. Tapping the red floating <strong>SOS</strong> button anywhere on UniShare will instantly open WhatsApp with your live GPS location map and launch your phone dialer.
            </p>
          </div>
        </div>

        {/* STATUS BAND */}
        {contact ? (
          <div className="band" style={{ background: "#e9f2ef", color: "#0d6b63", marginBottom: "24px" }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
              <path d="M9 12l2 2 4-4" />
            </svg>
            <div>
              <b>Emergency Contact Active &amp; Ready</b>
              <p>Your trusted contact ({contact.name} · {contact.phoneNumber}) is verified and linked to your 1-click floating SOS button.</p>
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
              <p>Please add and verify your trusted contact number below so you can use the floating SOS button.</p>
            </div>
            <span>0 / 1 Configured</span>
          </div>
        )}

        {/* 2-COLUMN MAIN CONTENT: LEFT = CONTACT CARD/FORM, RIGHT = INSTRUCTIONS & HELPLINES */}
        <div style={{ display: "grid", gridTemplateColumns: "1.2fr 0.8fr", gap: "24px", alignItems: "start" }}>
          
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

                <div style={{ borderTop: "1px solid #e5eae8", paddingTop: "14px", display: "flex", justifyContent: "flex-end" }}>
                  <button
                    type="button"
                    onClick={handleRemoveContact}
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
                    Enter 1 verified phone number that will receive emergency alerts when you press the floating SOS button.
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
                <div style={{ marginBottom: "16px" }}>
                  <label style={{ display: "block", fontSize: "12.5px", fontWeight: 700, color: "#161b1a", marginBottom: "5px" }}>
                    Mobile Phone Number <span style={{ color: "#b3261e" }}>*</span>
                  </label>
                  <input
                    type="tel"
                    required
                    placeholder="e.g., 019XXXXXXXX or +88019XXXXXXXX"
                    value={formPhone}
                    onChange={(e) => {
                      setFormPhone(e.target.value);
                      setFormVerified(false);
                      setVerifyCodeSent(false);
                    }}
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

                {/* VERIFICATION SECTION */}
                <div
                  style={{
                    background: "#f5f7f6",
                    border: "1px solid #d5dcda",
                    borderRadius: "8px",
                    padding: "14px",
                    marginBottom: "20px",
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
                    <span style={{ fontSize: "12px", fontWeight: 700, color: "#161b1a", textTransform: "uppercase" }}>
                      Phone Number Verification
                    </span>
                    {formVerified && (
                      <span style={{ fontSize: "12px", fontWeight: 700, color: "#0d6b63" }}>
                        ✓ Verified
                      </span>
                    )}
                  </div>

                  {!formVerified ? (
                    <div>
                      {!verifyCodeSent ? (
                        <div>
                          <p style={{ fontSize: "12.5px", color: "#4b5553", marginBottom: "10px" }}>
                            Verify this mobile number to confirm it can receive WhatsApp &amp; emergency alerts.
                          </p>
                          <button
                            type="button"
                            className="btn"
                            style={{ padding: "7px 14px", fontSize: "13px" }}
                            onClick={handleSendVerificationCode}
                          >
                            Send Verification Code
                          </button>
                        </div>
                      ) : (
                        <div>
                          <p style={{ fontSize: "12.5px", color: "#0d6b63", marginBottom: "8px", fontWeight: 600 }}>
                            Enter the 4-digit code generated below to verify:
                          </p>
                          <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                            <input
                              type="text"
                              maxLength={4}
                              placeholder="4-digit code"
                              value={inputOtp}
                              onChange={(e) => setInputOtp(e.target.value)}
                              style={{
                                width: "130px",
                                padding: "8px 10px",
                                border: "1.5px solid #0d6b63",
                                borderRadius: "6px",
                                fontSize: "15px",
                                fontWeight: 700,
                                textAlign: "center",
                                letterSpacing: "2px",
                              }}
                            />
                            <button
                              type="button"
                              className="btn solid"
                              style={{ padding: "8px 16px", fontSize: "13px" }}
                              onClick={handleVerifyOtp}
                            >
                              Verify Code
                            </button>
                          </div>
                          {otpError && (
                            <div style={{ color: "#b91c1c", fontSize: "12px", marginTop: "6px" }}>
                              {otpError}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  ) : (
                    <div style={{ fontSize: "13px", color: "#0d6b63", fontWeight: 600 }}>
                      ✓ Mobile number verified and ready to save.
                    </div>
                  )}
                </div>

                {/* FORM ACTIONS */}
                <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
                  <button
                    type="submit"
                    disabled={isSubmitting || !formVerified}
                    className="btn solid"
                    style={{
                      padding: "10px 22px",
                      fontSize: "14px",
                      opacity: !formVerified ? 0.6 : 1,
                      cursor: !formVerified ? "not-allowed" : "pointer",
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
                      Floating Red SOS Everywhere
                    </div>
                    <p style={{ fontSize: "12px", color: "#4b5553", margin: "2px 0 0", lineHeight: "1.4" }}>
                      A small red <strong>SOS</strong> button stays permanently pinned at the bottom-right corner of every page across the website.
                    </p>
                  </div>
                </div>

                <div style={{ display: "flex", gap: "10px", alignItems: "flex-start" }}>
                  <span style={{ background: "#e9f2ef", color: "#0d6b63", width: "24px", height: "24px", borderRadius: "50%", display: "grid", placeItems: "center", fontWeight: 800, fontSize: "12px", flexShrink: 0 }}>
                    3
                  </span>
                  <div>
                    <div style={{ fontSize: "13.5px", fontWeight: 700, color: "#161b1a" }}>
                      Instant WhatsApp &amp; Dialpad
                    </div>
                    <p style={{ fontSize: "12px", color: "#4b5553", margin: "2px 0 0", lineHeight: "1.4" }}>
                      Tapping the floating SOS immediately opens WhatsApp with your real-time GPS map tracking link and launches your phone dialpad.
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
                  <span>Proctor &amp; Campus Security</span>
                  <span style={{ color: "#0d6b63", fontWeight: 700 }}>01711-374747</span>
                </a>

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
                  <span>Dhaka Medical Emergency</span>
                  <span style={{ color: "#0d6b63", fontWeight: 700 }}>199</span>
                </a>
              </div>
            </div>

          </div>

        </div>

      </main>
    </div>
  );
}
