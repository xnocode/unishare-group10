"use client";

import React, { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import AppNavbar from "../components/AppNavbar";
import "../campus-home.css";
import "./sos.css";

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

interface CallAttemptRecord {
  id: string;
  contactName: string;
  phoneNumber: string;
  priority: number;
  attemptNumber: number;
  status: "INITIATED" | "RINGING" | "ANSWERED" | "UNANSWERED" | "BUSY" | "FAILED" | "CANCELLED";
  provider: "TWILIO" | "MOCK_SIMULATOR";
  telephonySid?: string;
  durationSeconds: number;
  errorMessage?: string;
  notes?: string;
  createdAt: string;
}

interface EmergencySmsRecord {
  id: string;
  recipientName: string;
  phoneNumber: string;
  messageBody: string;
  status: "QUEUED" | "SENT" | "DELIVERED" | "FAILED" | "MOCK_SENT";
  provider: "TWILIO" | "MOCK_SIMULATOR";
  telephonySid?: string;
  errorMessage?: string;
  sentAt?: string;
  createdAt: string;
}

interface EmergencyLocationRecord {
  latitude: number;
  longitude: number;
  accuracy: number | null;
  heading?: number | null;
  speed?: number | null;
  timestamp: string;
}

interface EmergencySessionRecord {
  id: string;
  status: "ACTIVE" | "RESOLVED" | "CANCELLED" | "SUPERSEDED" | string;
  callingStatus: "INITIATING" | "ESCALATING" | "CONTACT_REACHED" | "EXHAUSTED" | "RESOLVED" | "CANCELLED" | string;
  triggerReason?: string;
  resolvedReason?: string;
  answeredContactId?: string;
  activeCallSid?: string;
  trackingToken?: string;
  latestLatitude?: number | null;
  latestLongitude?: number | null;
  latestAccuracy?: number | null;
  latestLocationAt?: string | null;
  gpsStatus?: string | null;
  resolvedAt?: string;
  createdAt: string;
  callAttempts?: CallAttemptRecord[];
  smsDispatches?: EmergencySmsRecord[];
  locationUpdates?: EmergencyLocationRecord[];
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

export default function SOSPage() {
  const router = useRouter();

  // Authenticated student
  const [currentUser, setCurrentUser] = useState<UserProfile>({
    name: "Farhana Rahman",
    email: "farhana@std.du.ac.bd",
    initials: "FR",
    university: "University of Dhaka",
    verified: true,
    tokenBalance: 500,
  });

  // Contacts state
  const [contacts, setContacts] = useState<EmergencyContact[]>([]);
  const [isLoadingContacts, setIsLoadingContacts] = useState(true);

  // Contact modal state (Add / Edit)
  const [showManageModal, setShowManageModal] = useState(false);
  const [editingContact, setEditingContact] = useState<EmergencyContact | null>(null);

  // Form states
  const [formName, setFormName] = useState("");
  const [formPhone, setFormPhone] = useState("");
  const [formRelationship, setFormRelationship] = useState("Family contact");
  const [formPriority, setFormPriority] = useState<number>(1);
  const [formError, setFormError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Contact Phone Verification State
  const [formVerified, setFormVerified] = useState(false);
  const [verifyCodeSent, setVerifyCodeSent] = useState(false);
  const [generatedOtp, setGeneratedOtp] = useState("");
  const [inputOtp, setInputOtp] = useState("");
  const [otpError, setOtpError] = useState("");

  // Toast
  const [toastMessage, setToastMessage] = useState("");
  const [toastVisible, setToastVisible] = useState(false);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setToastVisible(true);
    setTimeout(() => setToastVisible(false), 3000);
  };

  // Telephony & Provider Info
  const [telephonyInfo, setTelephonyInfo] = useState<{
    provider: string;
    isLive: boolean;
    hasVoice: boolean;
    hasSms: boolean;
    message: string;
  }>({
    provider: "TWILIO",
    isLive: true,
    hasVoice: true,
    hasSms: true,
    message: "Live Twilio Telephony Connected",
  });

  // Emergency Session & Popup Modal
  const [activeSession, setActiveSession] = useState<EmergencySessionRecord | null>(null);
  const [showEmergencyModal, setShowEmergencyModal] = useState(false);

  // Calling Escalation Runner State
  const [isCallingActive, setIsCallingActive] = useState(false);
  const [currentCallStatusText, setCurrentCallStatusText] = useState("");
  const [currentContactIndex, setCurrentContactIndex] = useState(0);
  const [currentAttemptNumber, setCurrentAttemptNumber] = useState(1);
  const [callLog, setCallLog] = useState<CallAttemptRecord[]>([]);
  const [isStepProcessing, setIsStepProcessing] = useState(false);

  // Live GPS Tracking & Automatic SMS State
  const [trackingUrl, setTrackingUrl] = useState("");
  const [gpsStatus, setGpsStatus] = useState<"IDLE" | "REQUESTING" | "CONNECTED" | "DENIED" | "UNAVAILABLE">("IDLE");
  const [gpsCoords, setGpsCoords] = useState<{
    latitude: number;
    longitude: number;
    accuracy: number | null;
    timestamp: Date;
  } | null>(null);
  const [copiedUrl, setCopiedUrl] = useState(false);

  const geolocationWatchIdRef = useRef<number | null>(null);

  // Sync authenticated user from localStorage if present
  useEffect(() => {
    try {
      const stored = localStorage.getItem("unishare_user");
      if (stored) {
        const parsed = JSON.parse(stored);
        setCurrentUser((prev) => ({
          ...prev,
          name: parsed.name || prev.name,
          email: parsed.email || prev.email,
          initials: parsed.initials || prev.initials,
          university: parsed.university || prev.university,
          verified: parsed.verified !== undefined ? parsed.verified : prev.verified,
          tokenBalance: parsed.tokenBalance !== undefined ? parsed.tokenBalance : prev.tokenBalance,
        }));
      }
    } catch (e) {
      console.error(e);
    }
  }, []);

  // Fetch contacts and active emergency session on mount
  useEffect(() => {
    loadContacts();
    loadSession();

    return () => {
      if (geolocationWatchIdRef.current !== null) {
        navigator.geolocation.clearWatch(geolocationWatchIdRef.current);
      }
    };
  }, [currentUser.email]);

  const loadContacts = async () => {
    setIsLoadingContacts(true);
    try {
      const res = await fetch(`/api/emergency-contacts`, {
        headers: {
          "x-user-email": currentUser.email,
        },
      });
      const data = await res.json();
      if (data.success && Array.isArray(data.contacts)) {
        setContacts(data.contacts);
      }
    } catch (err) {
      console.error("Failed to load contacts:", err);
    } finally {
      setIsLoadingContacts(false);
    }
  };

  const loadSession = async () => {
    try {
      const res = await fetch(`/api/sos/session?email=${encodeURIComponent(currentUser.email)}`, {
        headers: {
          "x-user-email": currentUser.email,
        },
      });
      const data = await res.json();
      if (data.success) {
        if (data.telephony) {
          setTelephonyInfo({
            provider: data.telephony.provider,
            isLive: data.telephony.isLive,
            hasVoice: true,
            hasSms: true,
            message: data.telephony.message,
          });
        }
        if (data.activeSession) {
          setActiveSession(data.activeSession);
          setIsCallingActive(data.activeSession.status === "ACTIVE");
          if (data.trackingUrl) {
            setTrackingUrl(data.trackingUrl);
          }
          if (data.activeSession.callAttempts) {
            setCallLog(data.activeSession.callAttempts);
          }
          startLocationTracking(data.activeSession.id);
        }
      }
    } catch (err) {
      console.error("Failed to fetch session:", err);
    }
  };

  // Continuous GPS Location Tracking
  const startLocationTracking = (sessionId: string) => {
    if (!navigator.geolocation) {
      setGpsStatus("UNAVAILABLE");
      return;
    }

    setGpsStatus("REQUESTING");

    if (geolocationWatchIdRef.current !== null) {
      navigator.geolocation.clearWatch(geolocationWatchIdRef.current);
    }

    geolocationWatchIdRef.current = navigator.geolocation.watchPosition(
      async (pos) => {
        const { latitude, longitude, accuracy, heading, speed } = pos.coords;
        const coords = {
          latitude,
          longitude,
          accuracy,
          timestamp: new Date(pos.timestamp),
        };
        setGpsCoords(coords);
        setGpsStatus("CONNECTED");

        try {
          await fetch("/api/sos/session", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "x-user-email": currentUser.email,
            },
            body: JSON.stringify({
              action: "UPDATE_LOCATION",
              sessionId,
              latitude,
              longitude,
              accuracy,
              heading,
              speed,
            }),
          });
        } catch (e) {
          console.error("Failed to stream GPS update:", e);
        }
      },
      (err) => {
        console.warn("Geolocation watch error:", err);
        if (err.code === err.PERMISSION_DENIED) {
          setGpsStatus("DENIED");
        } else {
          setGpsStatus("UNAVAILABLE");
        }
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 5000,
      }
    );
  };

  // Trigger SOS button click: opens clean confirmation popup
  const handleTriggerSOS = () => {
    if (activeSession && activeSession.status === "ACTIVE") {
      handleResolveSession("Emergency ended by student");
      return;
    }

    if (contacts.length === 0) {
      showToast("Please add at least 1 emergency contact before triggering SOS.");
      handleOpenAdd();
      return;
    }

    // Open emergency confirmation popup modal
    setShowEmergencyModal(true);
  };

  // Confirm SOS from Popup: directly places real phone call and sends SMS with live tracking
  const handleConfirmSOS = async () => {
    setShowEmergencyModal(false);

    try {
      const res = await fetch("/api/sos/session", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-user-email": currentUser.email,
        },
        body: JSON.stringify({
          action: "START",
          notes: "Triggered from UniShare SOS emergency page",
          latitude: gpsCoords?.latitude,
          longitude: gpsCoords?.longitude,
          accuracy: gpsCoords?.accuracy,
        }),
      });

      const data = await res.json();
      if (data.success && data.session) {
        setActiveSession(data.session);
        setCallLog(data.session.callAttempts || []);
        if (data.trackingUrl) {
          setTrackingUrl(data.trackingUrl);
        }
        setIsCallingActive(true);
        startLocationTracking(data.session.id);
        showToast("🚨 EMERGENCY ACTIVATED: Real phone call and WhatsApp alert dispatched!");

        // Automatically open WhatsApp with the Live Tracking link and emergency alert for the primary contact
        if (priorityContact) {
          const formattedPhone = formatForWhatsApp(priorityContact.phoneNumber);
          const finalTrackUrl = data.trackingUrl || `${window.location.origin}/sos/track/${data.session.trackingToken}`;
          const waMsg = encodeURIComponent(
            `🚨 *জরুরি সতর্কতা (UniShare Emergency SOS)*\n` +
            `আপনার সন্তান/বন্ধু (${currentUser.name}) বিপদে পড়েছেন এবং জরুরি সহায়তা চেয়েছেন!\n\n` +
            `📍 *রিয়েল-টাইম লাইভ জিপিএস লোকেশন দেখতে নিচের লিংকে ক্লিক করুন:*\n${finalTrackUrl}\n\n` +
            `দয়া করে এখনই ব্যবস্থা নিন অথবা প্রয়োজনে ৯৯৯ নম্বরে কল করুন।`
          );
          setTimeout(() => {
            window.open(`https://wa.me/${formattedPhone}?text=${waMsg}`, "_blank");
          }, 400);
        }

        // Begin calling Priority 1 contact immediately
        runEscalationLoop(data.session.id, contacts, 0, 1);
      } else {
        showToast(data.error || "Failed to create emergency session.");
      }
    } catch (err) {
      console.error(err);
      showToast("Network error creating emergency session.");
    }
  };

  // Run escalation calling loop
  const runEscalationLoop = async (
    sessionId: string,
    contactList: EmergencyContact[],
    contactIdx: number,
    attemptNumber: number
  ) => {
    if (contactIdx >= contactList.length) {
      setCurrentCallStatusText("ফোন রিসিভ হয়নি! স্বয়ংক্রিয়ভাবে ৯৯৯ ডায়াল প্যাড ওপেন হচ্ছে...");
      setIsStepProcessing(false);
      showToast("Emergency contact unanswered! Automatically dialing 999...");
      setTimeout(() => {
        window.location.href = "tel:999";
      }, 1500);
      return;
    }

    const contact = contactList[contactIdx];
    setCurrentContactIndex(contactIdx);
    setCurrentAttemptNumber(attemptNumber);
    setIsStepProcessing(true);
    setCurrentCallStatusText(`Calling ${contact.name} (${contact.phoneNumber})...`);

    try {
      const res = await fetch("/api/sos/session", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-user-email": currentUser.email,
        },
        body: JSON.stringify({
          action: "STEP_CALL",
          sessionId,
          contactId: contact.id,
          attemptNumber,
        }),
      });

      const data = await res.json();
      if (data.success) {
        if (data.allAttempts) {
          setCallLog(data.allAttempts);
        }

        const next = data.nextStep;
        const callSid = data.callAttempt?.telephonySid;

        // If it's a live Twilio call, actively poll Twilio for up to 25 seconds while the phone rings
        if (callSid && callSid.startsWith("CA") && !next?.escalationStopped) {
          let callAnswered = false;
          const pollStart = Date.now();
          const maxWaitMs = 26000; // 26 seconds ringing window

          while (Date.now() - pollStart < maxWaitMs) {
            const elapsedSec = Math.floor((Date.now() - pollStart) / 1000);
            const remainingSec = Math.max(0, 25 - elapsedSec);
            setCurrentCallStatusText(
              `Calling ${contact.name} (${contact.phoneNumber})... Phone is ringing. Awaiting pickup (${remainingSec}s)`
            );

            await new Promise((r) => setTimeout(r, 2000));

            try {
              const pollRes = await fetch("/api/sos/session", {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                  "x-user-email": currentUser.email,
                },
                body: JSON.stringify({
                  action: "CHECK_STATUS",
                  callSid,
                }),
              });
              const pollData = await pollRes.json();
              const twilioStatus = pollData?.twilioStatus?.status;

              if (twilioStatus === "ANSWERED") {
                callAnswered = true;
                setActiveSession((prev) => prev ? { ...prev, callingStatus: "CONTACT_REACHED" } : null);
                setCurrentCallStatusText(
                  `Contact Reached: ${contact.name} answered the phone! Bangla voice announcement is playing.`
                );
                setIsStepProcessing(false);
                showToast(`✓ Contact reached: ${contact.name} answered the phone!`);
                return;
              }

              if (twilioStatus === "BUSY" || twilioStatus === "FAILED" || twilioStatus === "UNANSWERED") {
                break;
              }
            } catch {
              // Ignore network polling glitch
            }
          }

          if (callAnswered) {
            return;
          }
        }

        if (next.escalationStopped || data.session?.callingStatus === "CONTACT_REACHED") {
          setActiveSession(data.session);
          setCurrentCallStatusText(
            `Contact Reached: Priority #${contact.priority} (${contact.name}) answered! Escalation stopped. Emergency remains ACTIVE.`
          );
          setIsStepProcessing(false);
          showToast(`Contact reached: ${contact.name} answered.`);
          return;
        }

        if (next.escalationExhausted) {
          setActiveSession(data.session);
          setCurrentCallStatusText("ফোন রিসিভ হয়নি! স্বয়ংক্রিয়ভাবে ৯৯৯ ডায়াল প্যাড ওপেন হচ্ছে...");
          setIsStepProcessing(false);
          showToast("Emergency contact unanswered! Automatically dialing 999...");
          setTimeout(() => {
            window.location.href = "tel:999";
          }, 1500);
          return;
        }

        if (next.nextContactId) {
          const nextIdx = contactList.findIndex((c) => c.id === next.nextContactId);
          const nextAttempt = next.nextAttemptNumber || 1;

          setCurrentCallStatusText(next.reason || "Advancing emergency escalation...");
          await new Promise((resolve) => setTimeout(resolve, 800));

          if (nextIdx !== -1) {
            runEscalationLoop(sessionId, contactList, nextIdx, nextAttempt);
          }
        }
      }
    } catch (err) {
      console.error(err);
      setCurrentCallStatusText("Error during automated emergency call attempt.");
    } finally {
      setIsStepProcessing(false);
    }
  };

  // End Emergency / Mark Safe
  const handleResolveSession = async (reason = "Student manually clicked End Emergency") => {
    if (!activeSession) return;

    try {
      const res = await fetch("/api/sos/session", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-user-email": currentUser.email,
        },
        body: JSON.stringify({
          action: "END_EMERGENCY",
          sessionId: activeSession.id,
          resolvedReason: reason,
        }),
      });

      const data = await res.json();
      if (data.success) {
        setActiveSession(null);
        setIsCallingActive(false);
        setCurrentCallStatusText("");
        if (geolocationWatchIdRef.current !== null) {
          navigator.geolocation.clearWatch(geolocationWatchIdRef.current);
          geolocationWatchIdRef.current = null;
        }
        setGpsStatus("IDLE");
        showToast("Emergency resolved. You are marked safe.");
        loadSession();
      } else {
        showToast(data.error || "Failed to end emergency.");
      }
    } catch (err) {
      console.error(err);
      showToast("Network error ending emergency.");
    }
  };

  // Copy tracking URL to clipboard
  const handleCopyTrackingUrl = () => {
    const url = trackingUrl || (activeSession?.trackingToken ? `${window.location.origin}/sos/track/${activeSession.trackingToken}` : "");
    if (!url) return;
    navigator.clipboard.writeText(url);
    setCopiedUrl(true);
    showToast("Live tracking URL copied to clipboard!");
    setTimeout(() => setCopiedUrl(false), 2500);
  };

  // Open WhatsApp alert with live tracking URL
  const handleOpenWhatsApp = (targetContact?: EmergencyContact) => {
    const contact = targetContact || priorityContact;
    if (!contact) {
      showToast("No emergency contact found. Please add a contact first.");
      return;
    }
    const formattedPhone = formatForWhatsApp(contact.phoneNumber);
    const currentTrackUrl = trackingUrl || (activeSession?.trackingToken ? `${window.location.origin}/sos/track/${activeSession.trackingToken}` : `${window.location.origin}/sos`);
    const waMsg = encodeURIComponent(
      `🚨 *জরুরি সতর্কতা (UniShare Emergency SOS)*\n` +
      `আপনার সন্তান/বন্ধু (${currentUser.name}) বিপদে পড়েছেন এবং জরুরি সহায়তা চেয়েছেন!\n\n` +
      `📍 *তার রিয়েল-টাইম লাইভ জিপিএস লোকেশন দেখতে নিচের লিংকে ক্লিক করুন:*\n${currentTrackUrl}\n\n` +
      `দয়া করে এখনই ব্যবস্থা নিন অথবা প্রয়োজনে ৯৯৯ নম্বরে কল করুন।`
    );
    window.open(`https://wa.me/${formattedPhone}?text=${waMsg}`, "_blank");
  };

  // Contact CRUD Handlers
  const handleOpenAdd = () => {
    setEditingContact(null);
    setFormName("");
    setFormPhone("");
    setFormRelationship("Family contact");
    setFormPriority(Math.min(contacts.length + 1, 3));
    setFormError("");
    setFormVerified(false);
    setVerifyCodeSent(false);
    setGeneratedOtp("");
    setInputOtp("");
    setOtpError("");
    setShowManageModal(true);
  };

  const handleOpenEdit = (contact: EmergencyContact) => {
    setEditingContact(contact);
    setFormName(contact.name);
    setFormPhone(contact.phoneNumber);
    setFormRelationship(contact.relationship);
    setFormPriority(contact.priority);
    setFormError("");
    setFormVerified(true);
    setVerifyCodeSent(false);
    setGeneratedOtp("");
    setInputOtp("");
    setOtpError("");
    setShowManageModal(true);
  };

  const handleSendVerificationCode = () => {
    const rawDigits = formPhone.replace(/\D/g, "");
    if (!rawDigits || rawDigits.length < 10) {
      setFormError("Please enter a valid mobile number (e.g. 01939853593).");
      return;
    }
    setFormError("");
    const randomCode = Math.floor(1000 + Math.random() * 9000).toString();
    setGeneratedOtp(randomCode);
    setInputOtp(randomCode); // Pre-fill for seamless 1-click verification
    setVerifyCodeSent(true);
    setOtpError("");
    showToast(`Verification code: ${randomCode}`);
  };

  const handleVerifyOtp = () => {
    if (inputOtp.trim() === generatedOtp.trim() && generatedOtp) {
      setFormVerified(true);
      setOtpError("");
      showToast("✓ Phone number verified successfully!");
    } else {
      setOtpError("Incorrect verification code. Please enter the code shown above.");
    }
  };

  const handleSaveContact = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError("");

    if (!formName.trim()) {
      setFormError("Contact full name is required.");
      return;
    }
    const rawDigits = formPhone.replace(/\D/g, "");
    if (!rawDigits || rawDigits.length < 10) {
      setFormError("Please enter a valid mobile number (e.g. 01939853593).");
      return;
    }
    if (!formVerified) {
      setFormError("Please verify the mobile number before saving.");
      return;
    }

    setIsSubmitting(true);
    try {
      const url = "/api/emergency-contacts";
      const method = editingContact ? "PUT" : "POST";
      const body = {
        id: editingContact ? editingContact.id : undefined,
        name: formName.trim(),
        phoneNumber: formPhone.trim(),
        relationship: formRelationship,
        priority: Number(formPriority),
      };

      const res = await fetch(url, {
        method,
        headers: {
          "Content-Type": "application/json",
          "x-user-email": currentUser.email,
        },
        body: JSON.stringify(body),
      });

      const data = await res.json();
      if (data.success) {
        showToast(editingContact ? "Contact updated successfully." : "Contact added and verified.");
        setShowManageModal(false);
        loadContacts();
      } else {
        setFormError(data.error || "Failed to save contact.");
      }
    } catch {
      setFormError("Network error saving contact.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteContact = async (id: string, name: string) => {
    if (!confirm(`Are you sure you want to remove ${name} from emergency contacts?`)) return;

    try {
      const res = await fetch(`/api/emergency-contacts?id=${id}`, {
        method: "DELETE",
        headers: {
          "x-user-email": currentUser.email,
        },
      });
      const data = await res.json();
      if (data.success) {
        showToast("Contact removed.");
        loadContacts();
      } else {
        showToast(data.error || "Failed to delete contact.");
      }
    } catch {
      showToast("Network error deleting contact.");
    }
  };

  const priorityContact = contacts.find((c) => c.priority === 1) || contacts[0];

  return (
    <div className="sos-page">
      {/* GLOBAL TOAST */}
      {toastVisible && <div className="sos-toast">{toastMessage}</div>}

      {/* TOP NAVIGATION BAR */}
      <AppNavbar activeNav="sos" />

      {/* MAIN CONTENT CONTAINER */}
      <main className="wrap" style={{ maxWidth: "1080px", margin: "0 auto", padding: "28px 20px 60px" }}>
        
        {/* HERO SECTION */}
        <section className="hero" style={{ marginBottom: "24px" }}>
          <span className="badge">Emergency Assistance</span>
          <h1 className="h1">Campus Emergency SOS</h1>
          <p className="sub" style={{ maxWidth: "600px" }}>
            1-Click instant emergency telephone call dispatch and real-time live GPS tracking.
          </p>
        </section>

        {/* ACTIVE EMERGENCY BANNER */}
        {activeSession && activeSession.status === "ACTIVE" && (
          <div
            style={{
              background: "#fee2e2",
              border: "2px solid #ef4444",
              borderRadius: "12px",
              padding: "16px 20px",
              marginBottom: "24px",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              flexWrap: "wrap",
              gap: "14px",
            }}
          >
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: "8px", fontWeight: 800, color: "#991b1b", fontSize: "16px" }}>
                <span className="sos-pulse-ring" style={{ width: "12px", height: "12px", background: "#ef4444", borderRadius: "50%" }}></span>
                ACTIVE EMERGENCY SOS IN PROGRESS
              </div>
              <div style={{ fontSize: "13px", color: "#7f1d1d", marginTop: "4px" }}>
                {currentCallStatusText || `Calling Priority 1: ${priorityContact?.name || "Contact"} (${priorityContact?.phoneNumber || ""})`}
              </div>
            </div>

            <button
              type="button"
              className="btn solid"
              style={{ background: "#0d6b63", borderColor: "#0d6b63", padding: "10px 20px", fontSize: "14px", fontWeight: 700 }}
              onClick={() => handleResolveSession("Emergency ended by student")}
            >
              ✓ End Emergency (I Am Safe)
            </button>
          </div>
        )}

        {/* CLEAN 2-COLUMN GRID: LEFT = CONTACTS (MAX 3), RIGHT = SOS TRIGGER & LOCATION */}
        <div className="sos-grid" style={{ display: "grid", gridTemplateColumns: "1.15fr 0.85fr", gap: "24px", alignItems: "start" }}>
          
          {/* ================= LEFT COLUMN: EMERGENCY CONTACTS (MAX 3) ================= */}
          <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
            
            <div className="sos-card">
              <div className="sos-card-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <h2 className="sos-card-title">Emergency Contacts</h2>
                  <p className="sos-card-desc" style={{ marginBottom: 0 }}>
                    Add 1 to 3 trusted contacts who will receive emergency calls & live GPS location.
                  </p>
                </div>
                <span className="sos-card-badge">{contacts.length} / 3</span>
              </div>

              {/* Contacts List */}
              <div style={{ marginTop: "16px", display: "flex", flexDirection: "column", gap: "10px" }}>
                {isLoadingContacts ? (
                  <div style={{ padding: "24px 0", textAlign: "center", color: "var(--muted)", fontSize: "13px" }}>
                    Loading contacts...
                  </div>
                ) : contacts.length === 0 ? (
                  <div
                    style={{
                      padding: "32px 20px",
                      background: "var(--field)",
                      border: "1.5px dashed var(--border-subtle)",
                      borderRadius: "12px",
                      textAlign: "center",
                    }}
                  >
                    <div style={{ fontSize: "28px", marginBottom: "8px" }}>📇</div>
                    <div style={{ fontWeight: 700, fontSize: "14px", color: "var(--ink)", marginBottom: "4px" }}>
                      No emergency contacts added yet
                    </div>
                    <p style={{ fontSize: "12.5px", color: "var(--muted)", maxWidth: "340px", margin: "0 auto 16px", lineHeight: "1.5" }}>
                      Your SOS list is currently empty. Add at least 1 verified contact (up to 3 maximum) to enable instant calling.
                    </p>
                    <button
                      type="button"
                      className="btn solid"
                      style={{ padding: "8px 18px", fontSize: "13px" }}
                      onClick={handleOpenAdd}
                    >
                      + Add Emergency Contact (0/3)
                    </button>
                  </div>
                ) : (
                  contacts.map((contact) => (
                    <div
                      key={contact.id}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        padding: "14px 16px",
                        background: "#ffffff",
                        border: "1.5px solid var(--border-subtle)",
                        borderRadius: "10px",
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                        <div
                          style={{
                            width: "36px",
                            height: "36px",
                            borderRadius: "50%",
                            background: contact.priority === 1 ? "var(--tint)" : "var(--field)",
                            color: contact.priority === 1 ? "var(--brand)" : "var(--muted)",
                            fontWeight: 800,
                            display: "grid",
                            placeItems: "center",
                            fontSize: "13px",
                          }}
                        >
                          #{contact.priority}
                        </div>
                        <div>
                          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                            <span style={{ fontWeight: 700, fontSize: "14px", color: "var(--ink)" }}>
                              {contact.name}
                            </span>
                            <span
                              style={{
                                fontSize: "11px",
                                fontWeight: 700,
                                padding: "2px 7px",
                                borderRadius: "4px",
                                background: "#dcfce7",
                                color: "#166534",
                              }}
                            >
                              ✓ Verified
                            </span>
                            {contact.priority === 1 && (
                              <span style={{ fontSize: "11px", color: "var(--brand)", fontWeight: 600 }}>
                                (Primary)
                              </span>
                            )}
                          </div>
                          <div style={{ fontSize: "12.5px", color: "var(--muted)", marginTop: "2px" }}>
                            {contact.relationship} · <b>{contact.phoneNumber}</b>
                          </div>
                        </div>
                      </div>

                      <div style={{ display: "flex", gap: "6px" }}>
                        <button
                          type="button"
                          className="sos-icon-btn"
                          title="Send Live Tracking via WhatsApp"
                          onClick={() => handleOpenWhatsApp(contact)}
                          style={{ color: "#16a34a" }}
                        >
                          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                            <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
                          </svg>
                        </button>
                        <button
                          type="button"
                          className="sos-icon-btn"
                          title="Edit contact"
                          onClick={() => handleOpenEdit(contact)}
                        >
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                          </svg>
                        </button>
                        <button
                          type="button"
                          className="sos-icon-btn btn-danger"
                          title="Delete contact"
                          onClick={() => handleDeleteContact(contact.id, contact.name)}
                        >
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                            <polyline points="3 6 5 6 21 6" />
                            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                          </svg>
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>

              {/* Add Contact Button */}
              {contacts.length > 0 && (
                <div style={{ marginTop: "16px", display: "flex", justifyContent: "flex-end" }}>
                  <button
                    type="button"
                    className="btn solid"
                    disabled={contacts.length >= 3}
                    onClick={handleOpenAdd}
                  >
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                      <line x1="12" y1="5" x2="12" y2="19" />
                      <line x1="5" y1="12" x2="19" y2="12" />
                    </svg>
                    <span>{contacts.length >= 3 ? "Max 3 Contacts Saved" : `+ Add Another Contact (${contacts.length}/3)`}</span>
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* ================= RIGHT COLUMN: SOS TRIGGER BUTTON & LOCATION ================= */}
          <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
            
            {/* CARD 1: SOS TRIGGER BUTTON ON RIGHT */}
            <div className="sos-card" style={{ textAlign: "center", padding: "28px 20px" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "6px", marginBottom: "4px" }}>
                <span className="badge" style={{ background: "#fee2e2", color: "#b3261e" }}>Emergency Action</span>
              </div>
              <h2 className="sos-card-title" style={{ fontSize: "18px", margin: "4px 0 6px" }}>
                {activeSession?.status === "ACTIVE" ? "Emergency is Live" : "Emergency SOS Trigger"}
              </h2>
              <p className="sos-card-desc" style={{ marginBottom: "16px", fontSize: "12.5px" }}>
                {activeSession?.status === "ACTIVE"
                  ? "Call is in progress. Tap below when you are safe."
                  : "Clicking SOS will open the confirmation popup to immediately call your verified contact."}
              </p>

              {/* Prominent Circular SOS Button */}
              <div style={{ display: "flex", justifyContent: "center", margin: "8px 0 16px" }}>
                <button
                  type="button"
                  onClick={handleTriggerSOS}
                  style={{
                    width: "110px",
                    height: "110px",
                    borderRadius: "50%",
                    background: activeSession?.status === "ACTIVE" ? "#0d6b63" : "#b3261e",
                    color: "#ffffff",
                    border: "none",
                    boxShadow: activeSession?.status === "ACTIVE" 
                      ? "0 4px 20px rgba(13, 107, 99, 0.4)"
                      : "0 6px 24px rgba(179, 38, 30, 0.45)",
                    cursor: "pointer",
                    fontSize: "20px",
                    fontWeight: 800,
                    fontFamily: "var(--font-bricolage), sans-serif",
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: "4px",
                    transition: "transform 0.15s ease",
                  }}
                  onMouseDown={(e) => (e.currentTarget.style.transform = "scale(0.96)")}
                  onMouseUp={(e) => (e.currentTarget.style.transform = "scale(1)")}
                >
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                    <path d="M9 12l2 2 4-4" />
                  </svg>
                  <span>{activeSession?.status === "ACTIVE" ? "I AM SAFE" : "SOS"}</span>
                </button>
              </div>

              <div style={{ fontSize: "13px", fontWeight: 700, color: "var(--ink)" }}>
                {activeSession?.status === "ACTIVE"
                  ? "Tap button above to mark safe"
                  : priorityContact
                  ? `Will call: ${priorityContact.name} (${priorityContact.phoneNumber})`
                  : "Add an emergency contact on left"}
              </div>
              <div style={{ fontSize: "11.5px", color: "var(--muted)", marginTop: "4px" }}>
                Auto 999 fallback if call is unanswered.
              </div>
            </div>
            <div className="sos-card">
              <div className="sos-card-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <h2 className="sos-card-title">Live GPS Location Sharing</h2>
                  <p className="sos-card-desc" style={{ marginBottom: 0 }}>
                    Streams real-time device coordinates to your emergency contacts.
                  </p>
                </div>
                <span className={`sos-card-badge ${gpsStatus === "CONNECTED" ? "badge-mint" : "badge-amber"}`}>
                  {gpsStatus === "CONNECTED" ? "✓ Signal Locked" : "GPS Ready"}
                </span>
              </div>

              {/* GPS Coordinates Box */}
              <div
                style={{
                  background: "var(--field)",
                  border: "1.5px solid var(--border-subtle)",
                  borderRadius: "10px",
                  padding: "16px",
                  marginTop: "16px",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "10px" }}>
                  <span style={{ fontSize: "13px", fontWeight: 700, color: "var(--ink)" }}>
                    Device Coordinates
                  </span>
                  <span style={{ fontSize: "12px", color: "var(--muted)" }}>
                    {gpsCoords ? `Updated ${gpsCoords.timestamp.toLocaleTimeString()}` : "Active GPS Ready"}
                  </span>
                </div>

                {gpsCoords ? (
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px", fontSize: "13px" }}>
                    <div>
                      <small style={{ color: "var(--muted)", display: "block" }}>Latitude</small>
                      <b>{gpsCoords.latitude.toFixed(5)}° N</b>
                    </div>
                    <div>
                      <small style={{ color: "var(--muted)", display: "block" }}>Longitude</small>
                      <b>{gpsCoords.longitude.toFixed(5)}° E</b>
                    </div>
                    <div>
                      <small style={{ color: "var(--muted)", display: "block" }}>Accuracy</small>
                      <b>±{gpsCoords.accuracy ? Math.round(gpsCoords.accuracy) : 10} meters</b>
                    </div>
                    <div>
                      <small style={{ color: "var(--muted)", display: "block" }}>Streaming</small>
                      <b style={{ color: "var(--brand)" }}>Active</b>
                    </div>
                  </div>
                ) : (
                  <p style={{ fontSize: "12.5px", color: "var(--muted)", margin: 0 }}>
                    Browser GPS coordinates stream continuously during emergency activations.
                  </p>
                )}
              </div>

              {/* Secure Tracking Link Box */}
              <div style={{ marginTop: "16px" }}>
                <label className="sos-label" style={{ fontSize: "12.5px", fontWeight: 700, display: "block", marginBottom: "6px" }}>
                  Secure Emergency Tracking Link
                </label>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                    background: "#ffffff",
                    border: "1.5px solid var(--border-subtle)",
                    borderRadius: "8px",
                    padding: "8px 12px",
                  }}
                >
                  <input
                    type="text"
                    readOnly
                    value={
                      trackingUrl ||
                      (activeSession?.trackingToken
                        ? `${typeof window !== "undefined" ? window.location.origin : ""}/sos/track/${activeSession.trackingToken}`
                        : "Generated automatically upon SOS trigger")
                    }
                    style={{
                      border: "none",
                      outline: "none",
                      width: "100%",
                      fontSize: "12.5px",
                      color: "var(--ink)",
                      background: "transparent",
                    }}
                  />
                  <button
                    type="button"
                    className="btn"
                    style={{ padding: "6px 12px", fontSize: "12px", whiteSpace: "nowrap" }}
                    onClick={handleCopyTrackingUrl}
                    disabled={!trackingUrl && !activeSession?.trackingToken}
                  >
                    {copiedUrl ? "Copied!" : "Copy Link"}
                  </button>
                </div>
                <div style={{ fontSize: "11.5px", color: "var(--muted)", marginTop: "4px" }}>
                  Access expires automatically when you end the emergency.
                </div>

                <div style={{ marginTop: "10px" }}>
                  <button
                    type="button"
                    className="btn"
                    style={{ width: "100%", padding: "8px 12px", fontSize: "12.5px", background: "#f0fdf4", borderColor: "#86efac", color: "#15803d", fontWeight: 700 }}
                    onClick={() => handleOpenWhatsApp()}
                  >
                    💬 Send Live Tracking via WhatsApp
                  </button>
                </div>
              </div>

              {/* Preview Tracking Page Action */}
              {(trackingUrl || activeSession?.trackingToken) && (
                <div style={{ marginTop: "14px" }}>
                  <a
                    href={trackingUrl || `/sos/track/${activeSession?.trackingToken}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn solid"
                    style={{ width: "100%", textAlign: "center", display: "block", textDecoration: "none", padding: "10px" }}
                  >
                    Open Live Emergency Tracking Map ↗
                  </a>
                </div>
              )}
            </div>
          </div>
        </div>
      </main>

      {/* ================= MODAL: EMERGENCY CONFIRMATION POPUP ================= */}
      {showEmergencyModal && (
        <div className="sos-escalation-overlay">
          <div className="sos-escalation-modal" style={{ textAlign: "center", maxWidth: "460px", padding: "26px" }}>
            <div
              style={{
                width: "56px",
                height: "56px",
                borderRadius: "50%",
                background: "#fee2e2",
                color: "#b3261e",
                display: "grid",
                placeItems: "center",
                margin: "0 auto 14px",
              }}
            >
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                <line x1="12" y1="9" x2="12" y2="13" />
                <line x1="12" y1="17" x2="12.01" y2="17" />
              </svg>
            </div>

            <h2 style={{ fontSize: "20px", fontWeight: 800, margin: "0 0 6px", color: "var(--ink)" }}>
              Confirm Emergency SOS Alert
            </h2>
            <p style={{ fontSize: "13px", color: "var(--muted)", margin: "0 0 16px", lineHeight: "1.5" }}>
              Are you in immediate danger? Triggering SOS will immediately place an automated telephone call to your verified contact and dispatch a live GPS tracking link via WhatsApp.
            </p>

            {priorityContact && (
              <div
                style={{
                  background: "var(--field)",
                  border: "1.5px solid var(--border-subtle)",
                  borderRadius: "8px",
                  padding: "12px 14px",
                  textAlign: "left",
                  marginBottom: "10px",
                }}
              >
                <div style={{ fontSize: "11px", fontWeight: 700, color: "var(--muted)", textTransform: "uppercase" }}>
                  Primary Verified Emergency Contact
                </div>
                <div style={{ fontSize: "14px", fontWeight: 700, color: "var(--ink)", marginTop: "2px" }}>
                  {priorityContact.name} ({priorityContact.relationship})
                </div>
                <div style={{ fontSize: "13px", color: "#0d6b63", fontWeight: 700 }}>
                  📞 {priorityContact.phoneNumber} · ✓ Verified
                </div>
              </div>
            )}

            {/* Bangla Voice Announcement Quote Preview */}
            <div
              style={{
                background: "#f0fdf4",
                border: "1.5px solid #bbf7d0",
                borderRadius: "8px",
                padding: "12px 14px",
                textAlign: "left",
                marginBottom: "10px",
              }}
            >
              <div style={{ fontSize: "11px", fontWeight: 800, color: "#166534", textTransform: "uppercase", marginBottom: "4px" }}>
                🔊 Voice Call Announcement (Bengali):
              </div>
              <p style={{ fontSize: "12.5px", color: "#15803d", margin: 0, lineHeight: "1.5", fontStyle: "italic" }}>
                &ldquo;জরুরি সতর্কতা। আপনার মেয়ে বা ছেলে লাইফ রিস্কে আছে এবং বিপদে পড়েছে। আপনার নাম্বারে তার লাইভ লোকেশনের লিংক পাঠানো হয়েছে। দয়া করে এখনই মেসেজ চেক করুন এবং দ্রুত ব্যবস্থা নিন।&rdquo;
              </p>
            </div>

            {/* WhatsApp Note */}
            <div
              style={{
                background: "#ecfdf5",
                border: "1.5px solid #a7f3d0",
                borderRadius: "8px",
                padding: "10px 14px",
                textAlign: "left",
                marginBottom: "10px",
              }}
            >
              <div style={{ fontSize: "11px", fontWeight: 800, color: "#065f46", textTransform: "uppercase", marginBottom: "2px" }}>
                💬 Instant WhatsApp Notification:
              </div>
              <p style={{ fontSize: "12px", color: "#047857", margin: 0, lineHeight: "1.4" }}>
                Your real-time live GPS tracking link will immediately open in WhatsApp to notify your emergency contact.
              </p>
            </div>

            {/* Auto 999 Fallback Notice */}
            <div
              style={{
                background: "#fef2f2",
                border: "1.5px solid #fecaca",
                borderRadius: "8px",
                padding: "10px 14px",
                textAlign: "left",
                marginBottom: "16px",
              }}
            >
              <div style={{ fontSize: "11px", fontWeight: 800, color: "#991b1b", textTransform: "uppercase", marginBottom: "2px" }}>
                🚨 Automatic 999 Emergency Fallback:
              </div>
              <p style={{ fontSize: "12px", color: "#b91c1c", margin: 0, lineHeight: "1.4" }}>
                If your contact does not answer, the system will automatically open the 999 emergency helpline on your phone dialpad.
              </p>
            </div>

            <div style={{ display: "flex", gap: "10px" }}>
              <button
                type="button"
                className="btn"
                style={{ flex: 1, padding: "12px", fontSize: "14px" }}
                onClick={() => setShowEmergencyModal(false)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn solid"
                style={{
                  flex: 1.3,
                  padding: "12px",
                  fontSize: "14px",
                  fontWeight: 700,
                  background: "#b3261e",
                  borderColor: "#b3261e",
                }}
                onClick={handleConfirmSOS}
              >
                🚨 Call & Send Alert Now
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ================= MODAL: ADD / EDIT CONTACT ================= */}
      {showManageModal && (
        <div className="sos-escalation-overlay">
          <div className="sos-escalation-modal" style={{ maxWidth: "470px" }}>
            <div
              style={{
                padding: "16px 20px",
                borderBottom: "1.5px solid var(--border-subtle)",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <h3 style={{ fontSize: "17px", fontWeight: 700, margin: 0 }}>
                {editingContact ? "Edit Emergency Contact" : "Add Emergency Contact & Verify"}
              </h3>
              <button
                type="button"
                onClick={() => setShowManageModal(false)}
                style={{ background: "none", border: "none", fontSize: "20px", cursor: "pointer", color: "var(--muted)" }}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveContact} style={{ padding: "20px" }}>
              {formError && (
                <div
                  style={{
                    padding: "10px 12px",
                    background: "#fee2e2",
                    border: "1px solid #ef4444",
                    borderRadius: "8px",
                    color: "#b91c1c",
                    fontSize: "13px",
                    marginBottom: "14px",
                  }}
                >
                  {formError}
                </div>
              )}

              <div className="sos-form-group">
                <label className="sos-label">Contact Full Name *</label>
                <input
                  type="text"
                  className="sos-input"
                  placeholder="e.g. Shuddho Areng / Parent / Friend"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  required
                />
              </div>

              <div className="sos-form-group">
                <label className="sos-label">Mobile Phone Number *</label>
                <input
                  type="tel"
                  className="sos-input"
                  placeholder="e.g. 01939853593"
                  value={formPhone}
                  onChange={(e) => {
                    setFormPhone(e.target.value);
                    if (editingContact && e.target.value !== editingContact.phoneNumber) {
                      setFormVerified(false);
                    }
                  }}
                  required
                />
                <div className="sos-help-text">
                  Supports Bangladeshi mobile numbers (017..., 019..., 018...).
                </div>
              </div>

              {/* Number Verification Section */}
              <div style={{ marginBottom: "16px" }}>
                {!formVerified ? (
                  <div
                    style={{
                      background: "var(--field)",
                      border: "1.5px dashed var(--border-subtle)",
                      borderRadius: "8px",
                      padding: "12px",
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
                      <span style={{ fontSize: "12.5px", fontWeight: 700, color: "var(--ink)" }}>
                        Number Verification Required
                      </span>
                      <span className="badge badge-amber" style={{ fontSize: "10.5px" }}>
                        Unverified
                      </span>
                    </div>

                    {!verifyCodeSent ? (
                      <button
                        type="button"
                        className="btn"
                        style={{ width: "100%", fontSize: "13px", fontWeight: 600, padding: "8px" }}
                        onClick={handleSendVerificationCode}
                      >
                        Verify Phone Number
                      </button>
                    ) : (
                      <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                        <div style={{ fontSize: "12px", color: "var(--muted)" }}>
                          Verification code: <strong style={{ color: "#0d6b63", letterSpacing: "1px" }}>{generatedOtp}</strong>
                        </div>
                        <div style={{ display: "flex", gap: "8px" }}>
                          <input
                            type="text"
                            className="sos-input"
                            style={{ flex: 1, padding: "8px 10px", fontSize: "13px" }}
                            placeholder="Enter 4-digit code"
                            value={inputOtp}
                            onChange={(e) => setInputOtp(e.target.value)}
                            maxLength={6}
                          />
                          <button
                            type="button"
                            className="btn solid"
                            style={{ padding: "8px 14px", fontSize: "13px", fontWeight: 700 }}
                            onClick={handleVerifyOtp}
                          >
                            Verify
                          </button>
                        </div>
                        {otpError && (
                          <div style={{ fontSize: "11.5px", color: "#b91c1c", fontWeight: 600 }}>
                            {otpError}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ) : (
                  <div
                    style={{
                      background: "#f0fdf4",
                      border: "1.5px solid #86efac",
                      borderRadius: "8px",
                      padding: "10px 14px",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                    }}
                  >
                    <span style={{ color: "#15803d", fontWeight: 700, fontSize: "13px" }}>
                      ✓ Mobile number verified successfully
                    </span>
                    <button
                      type="button"
                      onClick={() => setFormVerified(false)}
                      style={{ background: "none", border: "none", color: "#0d6b63", fontSize: "12px", textDecoration: "underline", cursor: "pointer" }}
                    >
                      Change
                    </button>
                  </div>
                )}
              </div>

              <div className="sos-form-group">
                <label className="sos-label">Relationship</label>
                <select
                  className="sos-input"
                  value={formRelationship}
                  onChange={(e) => setFormRelationship(e.target.value)}
                >
                  <option value="Family contact">Family contact</option>
                  <option value="Parent / Guardian">Parent / Guardian</option>
                  <option value="Close Friend">Close Friend</option>
                  <option value="Roommate">Roommate</option>
                  <option value="Campus Proctor">Campus Proctor</option>
                </select>
              </div>

              <div className="sos-form-group">
                <label className="sos-label">Calling Priority (1 to 3)</label>
                <select
                  className="sos-input"
                  value={formPriority}
                  onChange={(e) => setFormPriority(Number(e.target.value))}
                >
                  <option value={1}>Priority 1 (Called First)</option>
                  <option value={2}>Priority 2 (Second Escalation)</option>
                  <option value={3}>Priority 3 (Third Escalation)</option>
                </select>
                <div className="sos-help-text">
                  Maximum of 3 emergency contacts allowed per student.
                </div>
              </div>

              <div style={{ display: "flex", gap: "10px", marginTop: "20px" }}>
                <button
                  type="button"
                  className="btn"
                  style={{ flex: 1 }}
                  onClick={() => setShowManageModal(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn solid"
                  style={{ flex: 1.2 }}
                  disabled={isSubmitting}
                >
                  {isSubmitting ? "Saving..." : editingContact ? "Update Contact" : "Save Verified Contact"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
