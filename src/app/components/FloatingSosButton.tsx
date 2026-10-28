"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

interface EmergencyContact {
  id: string;
  userId: string;
  name: string;
  phoneNumber: string;
  relationship: string;
  priority: number;
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

export default function FloatingSosButton() {
  const router = useRouter();
  const [contact, setContact] = useState<EmergencyContact | null>(null);
  const [isTriggering, setIsTriggering] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Load verified emergency contact
  const loadContact = async () => {
    try {
      let email = "farhana@std.du.ac.bd";
      try {
        const raw = localStorage.getItem("unishare_user");
        if (raw) {
          const parsed = JSON.parse(raw);
          if (parsed.email) email = parsed.email;
        }
      } catch {
        // ignore
      }

      const res = await fetch(`/api/emergency-contacts?email=${encodeURIComponent(email)}`);
      const data = await res.json();
      if (data.success && Array.isArray(data.contacts) && data.contacts.length > 0) {
        setContact(data.contacts[0]);
      } else {
        setContact(null);
      }
    } catch {
      // Ignore network errors on initial contact fetch
    }
  };

  useEffect(() => {
    loadContact();

    // Reload contact when storage or focus changes
    window.addEventListener("focus", loadContact);
    window.addEventListener("storage", loadContact);
    return () => {
      window.removeEventListener("focus", loadContact);
      window.removeEventListener("storage", loadContact);
    };
  }, []);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(null);
    }, 4000);
  };

  const handleSosClick = async () => {
    if (isTriggering) return;

    // If no emergency contact has been configured, alert and guide user to /sos setup
    if (!contact || !contact.phoneNumber) {
      showToast("⚠️ No emergency contact configured! Redirecting to setup...");
      setTimeout(() => {
        router.push("/sos");
      }, 1200);
      return;
    }

    setIsTriggering(true);

    try {
      // 1. Resolve current user name
      let studentName = "Campus Student";
      let studentEmail = "farhana@std.du.ac.bd";
      try {
        const raw = localStorage.getItem("unishare_user");
        if (raw) {
          const parsed = JSON.parse(raw);
          if (parsed.name) studentName = parsed.name;
          if (parsed.email) studentEmail = parsed.email;
        }
      } catch {
        // ignore
      }

      // 2. Obtain current GPS Coordinates if available
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
        } catch {
          // ignore GPS errors
        }
      }

      // 3. Create or attach active emergency session on backend
      const res = await fetch("/api/sos/session", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-user-email": studentEmail,
        },
        body: JSON.stringify({
          action: "START",
          notes: "Triggered from universal floating SOS button",
          latitude: lat,
          longitude: lng,
          accuracy,
        }),
      });

      const data = await res.json();
      const trackToken = data?.session?.trackingToken || "live";
      const finalTrackUrl = data?.trackingUrl || `${window.location.origin}/sos/track/${trackToken}`;

      // 4. Server automatically dispatches the WhatsApp alert via UltraMsg Cloud Gateway
      // 5. Open phone dialpad immediately with the saved emergency contact's number
      const dialNumber = contact.phoneNumber.replace(/[^\d+]/g, "");
      setTimeout(() => {
        window.location.href = `tel:${dialNumber}`;
      }, 300);

      showToast(`🚨 SOS DISPATCHED: WhatsApp alert sent automatically to ${contact.name} (${contact.phoneNumber}) & dialpad opened!`);
    } catch (err) {
      console.error("SOS trigger error:", err);
      const dialNumber = contact.phoneNumber.replace(/[^\d+]/g, "");
      window.location.href = `tel:${dialNumber}`;
      showToast(`⚠️ Emergency: Dialpad opened for ${contact.name} (${contact.phoneNumber})`);
    } finally {
      setTimeout(() => {
        setIsTriggering(false);
      }, 2000);
    }
  };

  return (
    <>
      {/* Toast Notification */}
      {toastMessage && (
        <div
          role="status"
          style={{
            position: "fixed",
            bottom: "94px",
            right: "24px",
            background: "#161b1a",
            color: "#ffffff",
            padding: "12px 18px",
            borderRadius: "10px",
            fontSize: "13px",
            fontWeight: 600,
            boxShadow: "0 10px 30px rgba(0,0,0,0.3)",
            zIndex: 10000,
            maxWidth: "340px",
            lineHeight: "1.4",
            borderLeft: "4px solid #ef4444",
            animation: "fadeIn 0.2s ease-out",
          }}
        >
          {toastMessage}
        </div>
      )}

      {/* Floating Red SOS Button */}
      <div
        style={{
          position: "fixed",
          bottom: "24px",
          right: "24px",
          zIndex: 9999,
          display: "flex",
          alignItems: "center",
          gap: "8px",
        }}
      >
        <button
          type="button"
          onClick={handleSosClick}
          aria-label="Emergency SOS - Send instant alert & dial contact"
          title={
            contact
              ? `Instant SOS: Send WhatsApp alert to ${contact.name} (${contact.phoneNumber}) & open dialpad`
              : "Emergency SOS: Configure contact & send instant alert"
          }
          style={{
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            gap: "7px",
            height: "52px",
            padding: "0 20px",
            borderRadius: "26px",
            background: "linear-gradient(135deg, #ef4444 0%, #b91c1c 100%)",
            color: "#ffffff",
            border: "2px solid #ffffff",
            boxShadow: "0 8px 24px rgba(185, 28, 28, 0.45), 0 2px 6px rgba(0,0,0,0.2)",
            cursor: "pointer",
            fontWeight: 800,
            fontSize: "15px",
            letterSpacing: "0.04em",
            transition: "transform 0.15s ease, box-shadow 0.15s ease",
            transform: isTriggering ? "scale(0.94)" : "scale(1)",
            userSelect: "none",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = "scale(1.05)";
            e.currentTarget.style.boxShadow = "0 12px 28px rgba(185, 28, 28, 0.6)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = "scale(1)";
            e.currentTarget.style.boxShadow = "0 8px 24px rgba(185, 28, 28, 0.45)";
          }}
        >
          {/* Subtle pulsating white ring icon */}
          <span
            style={{
              position: "relative",
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              width: "22px",
              height: "22px",
            }}
          >
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#ffffff"
              strokeWidth="2.6"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
            </svg>
          </span>

          <span>SOS</span>
        </button>
      </div>
    </>
  );
}

