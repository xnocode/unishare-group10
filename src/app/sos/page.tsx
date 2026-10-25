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

  // Emergency dialer entry state
  const [emergencyNumber, setEmergencyNumber] = useState("");
  const [showGuidanceModal, setShowGuidanceModal] = useState(false);

  // Contacts state
  const [contacts, setContacts] = useState<EmergencyContact[]>([]);
  const [isLoadingContacts, setIsLoadingContacts] = useState(true);
  const [openContactId, setOpenContactId] = useState<string | null>(null);

  // Contact modal state (Add / Edit / Manage)
  const [showManageModal, setShowManageModal] = useState(false);
  const [editingContact, setEditingContact] = useState<EmergencyContact | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);

  // Form states
  const [formName, setFormName] = useState("");
  const [formPhone, setFormPhone] = useState("");
  const [formRelationship, setFormRelationship] = useState("Family contact");
  const [formPriority, setFormPriority] = useState<number>(1);
  const [formError, setFormError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

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
    provider: "MOCK_SIMULATOR",
    isLive: false,
    hasVoice: false,
    hasSms: false,
    message: "Using simulated mock provider",
  });

  // Emergency Session & Escalation States
  const [activeSession, setActiveSession] = useState<EmergencySessionRecord | null>(null);
  const [sessionHistory, setSessionHistory] = useState<EmergencySessionRecord[]>([]);
  const [showCountdownModal, setShowCountdownModal] = useState(false);
  const [countdownSeconds, setCountdownSeconds] = useState(5);
  const countdownTimerRef = useRef<NodeJS.Timeout | null>(null);

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
  const [smsLog, setSmsLog] = useState<EmergencySmsRecord[]>([]);
  const [isResendingSms, setIsResendingSms] = useState(false);
  const [copiedUrl, setCopiedUrl] = useState(false);
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [selectedHistorySession, setSelectedHistorySession] = useState<EmergencySessionRecord | null>(null);

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

  // Fetch contacts and telephony status
  const fetchContactsAndSession = async () => {
    setIsLoadingContacts(true);
    try {
      const res = await fetch(`/api/sos/session?email=${encodeURIComponent(currentUser.email)}`, {
        headers: { "x-user-email": currentUser.email },
      });
      const data = await res.json();
      if (data.success) {
        if (Array.isArray(data.contacts)) {
          setContacts(data.contacts);
        }
        if (data.telephony) {
          setTelephonyInfo(data.telephony);
        }
        if (data.trackingUrl) {
          setTrackingUrl(data.trackingUrl);
        }
        if (data.sessionHistory) {
          setSessionHistory(data.sessionHistory);
        }
        if (data.activeSession) {
          setActiveSession(data.activeSession);
          if (Array.isArray(data.activeSession.smsDispatches)) {
            setSmsLog(data.activeSession.smsDispatches);
          }
          if (data.activeSession.latestLatitude && data.activeSession.latestLongitude) {
            setGpsCoords({
              latitude: data.activeSession.latestLatitude,
              longitude: data.activeSession.latestLongitude,
              accuracy: data.activeSession.latestAccuracy || null,
              timestamp: new Date(data.activeSession.latestLocationAt || Date.now()),
            });
            setGpsStatus("CONNECTED");
          }
          if (data.activeSession.status === "ACTIVE") {
            setIsCallingActive(true);
            startLocationTracking(data.activeSession.id);
          }
          if (data.activeSession.callAttempts) {
            setCallLog(data.activeSession.callAttempts);
          }
        } else {
          setActiveSession(null);
          setIsCallingActive(false);
          stopLocationTracking();
        }
      }
    } catch (err) {
      console.error("Error fetching emergency data:", err);
      showToast("Unable to connect to emergency assistance service.");
    } finally {
      setIsLoadingContacts(false);
    }
  };

  useEffect(() => {
    fetchContactsAndSession();
    return () => {
      stopLocationTracking();
      if (countdownTimerRef.current) {
        clearInterval(countdownTimerRef.current);
      }
    };
  }, [currentUser.email]);

  // Live Browser GPS Location Tracking
  const startLocationTracking = (sessionId: string) => {
    if (typeof window === "undefined" || !navigator.geolocation) {
      setGpsStatus("UNAVAILABLE");
      return;
    }

    setGpsStatus("REQUESTING");

    const sendCoordsToServer = async (position: GeolocationPosition) => {
      const { latitude, longitude, accuracy, heading, speed } = position.coords;
      setGpsCoords({
        latitude,
        longitude,
        accuracy,
        timestamp: new Date(position.timestamp),
      });
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
    };

    const handleGpsError = async (err: GeolocationPositionError) => {
      console.warn("Geolocation watch error:", err);
      if (err.code === err.PERMISSION_DENIED) {
        setGpsStatus("DENIED");
      } else {
        setGpsStatus("UNAVAILABLE");
      }

      try {
        await fetch("/api/sos/session", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-user-email": currentUser.email,
          },
          body: JSON.stringify({
            action: "GPS_STATUS_UPDATE",
            sessionId,
            gpsStatus: err.code === err.PERMISSION_DENIED ? "DENIED" : "UNAVAILABLE",
          }),
        });
      } catch (e) {
        console.error(e);
      }
    };

    navigator.geolocation.getCurrentPosition(sendCoordsToServer, handleGpsError, {
      enableHighAccuracy: true,
      timeout: 10000,
      maximumAge: 0,
    });

    try {
      geolocationWatchIdRef.current = navigator.geolocation.watchPosition(
        sendCoordsToServer,
        handleGpsError,
        {
          enableHighAccuracy: true,
          maximumAge: 4000,
          timeout: 12000,
        }
      );
    } catch (e) {
      console.error("watchPosition error:", e);
    }
  };

  const stopLocationTracking = () => {
    if (geolocationWatchIdRef.current !== null && typeof window !== "undefined" && navigator.geolocation) {
      navigator.geolocation.clearWatch(geolocationWatchIdRef.current);
      geolocationWatchIdRef.current = null;
    }
  };

  // 1-Click Instant SOS Emergency Activation
  const handleTriggerSOS = () => {
    if (activeSession && activeSession.status === "ACTIVE") {
      setIsCallingActive(true);
      showToast("Emergency session is already active.");
      return;
    }

    if (contacts.length === 0) {
      showToast("Please add at least 1 emergency contact before triggering SOS.");
      setShowManageModal(true);
      setShowAddForm(true);
      return;
    }

    // Immediate 1-click execution: Directly dispatches emergency call and live tracking link
    handleConfirmSOS();
  };

  const handleCancelCountdown = () => {
    if (countdownTimerRef.current) {
      clearInterval(countdownTimerRef.current);
      countdownTimerRef.current = null;
    }
    setShowCountdownModal(false);
    showToast("SOS activation cancelled.");
  };

  // Confirm SOS: create active session, dispatch SMS, initiate calling
  const handleConfirmSOS = async () => {
    if (countdownTimerRef.current) {
      clearInterval(countdownTimerRef.current);
      countdownTimerRef.current = null;
    }
    setShowCountdownModal(false);

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
        if (Array.isArray(data.smsDispatches)) {
          setSmsLog(data.smsDispatches);
        }
        if (data.trackingUrl) {
          setTrackingUrl(data.trackingUrl);
        }
        setIsCallingActive(true);
        startLocationTracking(data.session.id);
        showToast("EMERGENCY ACTIVATED: Auto SMS sent. Starting priority calls.");

        // Begin priority calling escalation at Priority 1
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
      setCurrentCallStatusText("All emergency contacts called without answer. Calling exhausted.");
      return;
    }

    const contact = contactList[contactIdx];
    setCurrentContactIndex(contactIdx);
    setCurrentAttemptNumber(attemptNumber);
    setIsStepProcessing(true);
    setCurrentCallStatusText(
      `Initiating call to Priority #${contact.priority}: ${contact.name} (${contact.phoneNumber}) [Attempt ${attemptNumber}/2]...`
    );

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

        // Condition: Stop escalation when contact answers
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
          setCurrentCallStatusText("All contacts called twice without answer. Emergency session remains active.");
          setIsStepProcessing(false);
          return;
        }

        // Retry once or escalate to next contact
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

  // Manual Escalation Simulation Trigger (for development/testing)
  const handleSimulateCallResult = async (simulatedOutcome: "answered" | "unanswered" | "busy" | "failed") => {
    if (!activeSession || activeSession.status !== "ACTIVE") return;
    const currentContact = contacts[currentContactIndex] || contacts[0];
    if (!currentContact) return;

    setIsStepProcessing(true);
    setCurrentCallStatusText(`Simulating call result: ${simulatedOutcome.toUpperCase()}...`);

    try {
      const res = await fetch("/api/sos/session", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-user-email": currentUser.email,
        },
        body: JSON.stringify({
          action: "STEP_CALL",
          sessionId: activeSession.id,
          contactId: currentContact.id,
          attemptNumber: currentAttemptNumber,
          simulatedOutcome,
        }),
      });

      const data = await res.json();
      if (data.success) {
        if (data.allAttempts) {
          setCallLog(data.allAttempts);
        }
        if (data.session) {
          setActiveSession(data.session);
        }

        const next = data.nextStep;
        if (next.escalationStopped || data.session?.callingStatus === "CONTACT_REACHED") {
          setCurrentCallStatusText(
            `Contact Reached: ${currentContact.name} answered. Escalation stopped. Emergency remains ACTIVE until you click End Emergency.`
          );
          showToast(`Call answered by ${currentContact.name}. Escalation stopped.`);
          return;
        }

        if (next.nextContactId) {
          const nextIdx = contacts.findIndex((c) => c.id === next.nextContactId);
          const nextAttempt = next.nextAttemptNumber || 1;
          setCurrentCallStatusText(next.reason);
          await new Promise((resolve) => setTimeout(resolve, 1800));
          if (nextIdx !== -1) {
            runEscalationLoop(activeSession.id, contacts, nextIdx, nextAttempt);
          }
        }
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsStepProcessing(false);
    }
  };

  // End Emergency: Student manually clicks "End Emergency" (marks safe)
  const handleResolveSession = async (reason?: string) => {
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
          reason: reason || "Emergency officially ended by student. Safety confirmed.",
        }),
      });

      const data = await res.json();
      if (data.success) {
        setActiveSession(null);
        setIsCallingActive(false);
        stopLocationTracking();
        showToast("Emergency session ended. All pending calls cancelled. You are marked SAFE.");
        fetchContactsAndSession();
      } else {
        showToast(data.error || "Could not end emergency session.");
      }
    } catch (e) {
      console.error(e);
      showToast("Error ending emergency session.");
    }
  };

  // Re-send SMS alerts
  const handleResendSms = async () => {
    if (!activeSession) return;
    setIsResendingSms(true);
    try {
      const res = await fetch("/api/sos/session", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-user-email": currentUser.email,
        },
        body: JSON.stringify({
          action: "RESEND_SMS",
          sessionId: activeSession.id,
        }),
      });
      const data = await res.json();
      if (data.success && Array.isArray(data.smsDispatches)) {
        setSmsLog(data.smsDispatches);
        showToast(`Emergency SMS alerts re-sent to ${data.smsDispatches.length} contacts.`);
      }
    } catch (err) {
      console.error(err);
      showToast("Error re-sending emergency SMS.");
    } finally {
      setIsResendingSms(false);
    }
  };

  // Copy tracking URL to clipboard
  const handleCopyTrackingUrl = () => {
    if (!trackingUrl) return;
    navigator.clipboard.writeText(trackingUrl);
    setCopiedUrl(true);
    showToast("Live emergency tracking URL copied to clipboard.");
    setTimeout(() => setCopiedUrl(false), 2400);
  };

  // Contact CRUD Handlers
  const handleOpenAdd = () => {
    if (contacts.length >= 5) {
      showToast("Maximum of 5 emergency contacts permitted.");
      return;
    }
    setEditingContact(null);
    setFormName("");
    setFormPhone("");
    setFormRelationship("Family contact");
    setFormPriority(contacts.length + 1);
    setFormError("");
    setShowAddForm(true);
    setShowManageModal(true);
  };

  const handleOpenEdit = (contact: EmergencyContact) => {
    setEditingContact(contact);
    setFormName(contact.name);
    setFormPhone(contact.phoneNumber);
    setFormRelationship(contact.relationship);
    setFormPriority(contact.priority);
    setFormError("");
    setShowAddForm(true);
    setShowManageModal(true);
  };

  const handleSaveContact = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError("");

    if (!formName.trim()) {
      setFormError("Contact name is required.");
      return;
    }
    if (!formPhone.trim()) {
      setFormError("Phone number is required.");
      return;
    }

    setIsSubmitting(true);
    try {
      const url = "/api/emergency-contacts";
      const method = editingContact ? "PUT" : "POST";
      const payload = {
        id: editingContact ? editingContact.id : undefined,
        email: currentUser.email,
        name: formName.trim(),
        phoneNumber: formPhone.trim(),
        relationship: formRelationship,
        priority: formPriority,
      };

      const res = await fetch(url, {
        method,
        headers: {
          "Content-Type": "application/json",
          "x-user-email": currentUser.email,
        },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (data.success) {
        showToast(editingContact ? "Emergency contact updated." : "Emergency contact added.");
        setShowAddForm(false);
        setEditingContact(null);
        await fetchContactsAndSession();
      } else {
        setFormError(data.error || "Failed to save emergency contact.");
      }
    } catch (err) {
      console.error(err);
      setFormError("Network error. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteContact = async (contactId: string, contactName: string) => {
    if (!window.confirm(`Are you sure you want to delete ${contactName}?`)) {
      return;
    }

    try {
      const res = await fetch(`/api/emergency-contacts?id=${contactId}&email=${encodeURIComponent(currentUser.email)}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (data.success) {
        showToast("Emergency contact removed.");
        await fetchContactsAndSession();
      } else {
        showToast(data.error || "Could not delete contact.");
      }
    } catch (err) {
      console.error(err);
      showToast("Error deleting contact.");
    }
  };

  const handleMovePriority = async (index: number, direction: "up" | "down") => {
    const targetIndex = direction === "up" ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= contacts.length) return;

    const updated = [...contacts];
    const temp = updated[index];
    updated[index] = updated[targetIndex];
    updated[targetIndex] = temp;

    const ordered = updated.map((c, i) => ({ ...c, priority: i + 1 }));
    setContacts(ordered);

    try {
      const res = await fetch("/api/emergency-contacts", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: currentUser.email,
          orderedIds: ordered.map((c) => c.id),
        }),
      });
      const data = await res.json();
      if (data.success) {
        showToast("Contact priorities reordered.");
        await fetchContactsAndSession();
      }
    } catch (err) {
      console.error(err);
      showToast("Error updating priority order.");
    }
  };

  // Open external dialer fallback
  const handleOpenDialer = () => {
    const target = emergencyNumber.trim() || "999";
    showToast(`Opening phone dialer for ${target}...`);
    window.location.href = `tel:${encodeURIComponent(target)}`;
  };

  return (
    <div className="unishare-campus-home unishare-sos-page">
      {/* Unified Top Navigation matching /home */}
      <AppNavbar
        activeNav="sos"
        onLogout={() => router.push("/login")}
        onOpenProfile={() => router.push("/home")}
        onSos={() => {
          showToast("You are currently in the SOS & Emergency Assistance Center.");
        }}
      />

      {/* Main Container */}
      <main className="wrap">
        <div className="eyebrow">Campus Safety & Emergency Assistance</div>

        {/* Hero Section matching /home */}
        <div className="hero">
          <div>
            <h1>Emergency Assistance & SOS</h1>
            <p className="sub">
              Direct priority calling escalation, continuous live GPS location tracking, and automatic emergency SMS alerts.
            </p>
          </div>
          <div className="acts">
            {activeSession && activeSession.status === "ACTIVE" ? (
              <button
                type="button"
                className="btn solid"
                style={{ background: "#b3261e", borderColor: "#b3261e" }}
                onClick={() => handleResolveSession("Emergency ended by student")}
              >
                End Emergency (I Am Safe)
              </button>
            ) : (
              <button
                type="button"
                className="btn solid"
                style={{ background: "#b3261e", borderColor: "#b3261e" }}
                onClick={handleTriggerSOS}
              >
                Activate Emergency SOS
              </button>
            )}

            <button
              type="button"
              className="btn"
              onClick={handleOpenAdd}
              disabled={contacts.length >= 5}
            >
              + Add Contact ({contacts.length}/5)
            </button>
          </div>
        </div>

        {/* University Verification & Security Band matching /home */}
        <div className="band">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ flexShrink: 0 }}>
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
            <path d="M9 12l2 2 4-4" />
          </svg>
          <div>
            <b>University of Dhaka · Proctorial Emergency Protocol</b>
            <p>
              Official campus safety protocol. Activates automatic phone escalation to your saved emergency contacts & DU Proctor office.
            </p>
          </div>
          <span>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <polyline points="20 6 9 17 4 12" />
            </svg>
            Verified Protection
          </span>
        </div>

        {/* Overview Stats Bar matching /home stats grid */}
        <div className="stats">
          <div className="stat">
            <small>Emergency status</small>
            <strong style={{ color: activeSession?.status === "ACTIVE" ? "#b3261e" : "#0d6b63" }}>
              {activeSession?.status === "ACTIVE" ? "ACTIVE SOS" : "Standby"}
            </strong>
            <p>{activeSession?.status === "ACTIVE" ? "Escalation in progress" : "Ready when you need it"}</p>
          </div>

          <div className="stat">
            <small>Trusted contacts</small>
            <strong>{contacts.length} / 5</strong>
            <p>{contacts.length > 0 ? `Priority 1: ${contacts[0]?.name}` : "No contacts saved"}</p>
          </div>

          <div className="stat">
            <small>Live GPS Tracking</small>
            <strong>{gpsStatus === "CONNECTED" ? "Locked" : gpsStatus}</strong>
            <p>{gpsCoords ? `±${Math.round(gpsCoords.accuracy || 10)}m accuracy` : "Streams on activation"}</p>
          </div>

          <div className="stat">
            <small>Emergency SMS alerts</small>
            <strong>{smsLog.length > 0 ? `${smsLog.length} Sent` : "Automated"}</strong>
            <p>Dispatched with secure map link</p>
          </div>
        </div>

        {/* ACTIVE EMERGENCY BANNER (If SOS is Active) */}
        {activeSession && activeSession.status === "ACTIVE" && (
          <div className="sos-active-session-wrap" style={{ marginTop: "24px" }}>
            <div className="sos-active-header">
              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <span className="sos-pulse-dot" />
                <div>
                  <h3 style={{ fontSize: "16px", fontWeight: 700, margin: 0, color: "#12201f" }}>
                    Active Emergency SOS in Progress
                  </h3>
                  <p style={{ fontSize: "12px", color: "var(--muted)", margin: "2px 0 0" }}>
                    Session ID: {activeSession.id.slice(0, 14)}... · Started: {new Date(activeSession.createdAt).toLocaleTimeString()}
                  </p>
                </div>
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <span className={`sos-card-badge ${activeSession.callingStatus === "CONTACT_REACHED" ? "badge-mint" : "badge-red"}`}>
                  {activeSession.callingStatus === "CONTACT_REACHED"
                    ? "✓ Contact Reached"
                    : activeSession.callingStatus === "ESCALATING"
                      ? "Escalating Calls"
                      : activeSession.callingStatus}
                </span>

                <button
                  type="button"
                  className="btn solid"
                  style={{ background: "#b3261e", borderColor: "#b3261e", padding: "6px 14px", fontSize: "12.5px" }}
                  onClick={() => handleResolveSession("Emergency resolved by student (safe)")}
                >
                  End Emergency (I Am Safe)
                </button>
              </div>
            </div>

            {/* Answered Contact Banner */}
            {activeSession.callingStatus === "CONTACT_REACHED" && (
              <div
                style={{
                  background: "#e6f0ef",
                  border: "1.5px solid #0d6b63",
                  borderRadius: "8px",
                  padding: "10px 14px",
                  fontSize: "13px",
                  color: "#0d6b63",
                  fontWeight: 600,
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                }}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                  <polyline points="22 4 12 14.01 9 11.01" />
                </svg>
                <span>
                  Emergency contact answered the call! Automatic escalation stopped. Emergency session remains ACTIVE until ended by you.
                </span>
              </div>
            )}

            {/* Calling Status Text */}
            {currentCallStatusText && (
              <div style={{ fontSize: "13px", color: "#12201f", fontWeight: 600 }}>
                {currentCallStatusText}
              </div>
            )}
          </div>
        )}

        {/* MAIN SOS GRID: PHONE SOS & LOCATION SHARE */}
        <div className="sos-grid" style={{ marginTop: "24px" }}>
          {/* ================= COLUMN 1: PHONE SOS ================= */}
          <div className="sos-col">
            {/* Card 1: Emergency SOS Calling Activation */}
            <div className="sos-card">
              <div className="sos-card-header">
                <h2 className="sos-card-title">Priority Phone SOS Escalation</h2>
                <span className="sos-card-badge">Automated Telephony</span>
              </div>
              <p className="sos-card-desc">
                When activated, UniShare calls your Priority 1 contact first. If unanswered after 2 attempts, it automatically escalates to Priority 2 and so on.
              </p>

              {/* Big SOS Trigger Box */}
              <div
                style={{
                  background: activeSession?.status === "ACTIVE" ? "#fff1f2" : "#fafcfb",
                  border: activeSession?.status === "ACTIVE" ? "2px solid #e11d48" : "1.5px solid var(--border-subtle)",
                  borderRadius: "12px",
                  padding: "20px",
                  textAlign: "center",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  gap: "12px",
                }}
              >
                <button
                  type="button"
                  onClick={activeSession?.status === "ACTIVE" ? () => handleResolveSession("Emergency ended") : handleTriggerSOS}
                  style={{
                    width: "100px",
                    height: "100px",
                    borderRadius: "50%",
                    background: activeSession?.status === "ACTIVE" ? "#0d6b63" : "#b3261e",
                    color: "#ffffff",
                    border: "none",
                    boxShadow: "0 4px 16px rgba(179, 38, 30, 0.35)",
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
                >
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4">
                    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                    <path d="M9 12l2 2 4-4" />
                  </svg>
                  <span>{activeSession?.status === "ACTIVE" ? "I AM SAFE" : "SOS"}</span>
                </button>

                <div style={{ fontSize: "13px", fontWeight: 700, color: "var(--ink)" }}>
                  {activeSession?.status === "ACTIVE"
                    ? "Tap button above to end emergency and mark safe"
                    : "1-Click Instant SOS: Call Priority 1 & Send Live Location"}
                </div>
                <div style={{ fontSize: "12px", color: "var(--muted)", maxWidth: "340px" }}>
                  Instantly calls Priority 1 contact and dispatches live GPS tracking link with a single tap.
                </div>
              </div>

              {/* Priority Escalation Workflow Steps */}
              <div style={{ marginTop: "16px", display: "flex", flexDirection: "column", gap: "8px" }}>
                <div style={{ fontSize: "12.5px", fontWeight: 700, color: "var(--ink)", marginBottom: "2px" }}>
                  Automatic Priority Calling Sequence:
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "12px", color: "var(--muted)" }}>
                  <span style={{ width: "20px", height: "20px", borderRadius: "50%", background: "var(--tint)", color: "var(--brand)", display: "grid", placeItems: "center", fontWeight: 700, flexShrink: 0 }}>1</span>
                  <span>Calls <b>Priority 1</b> contact. Retries once if unanswered.</span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "12px", color: "var(--muted)" }}>
                  <span style={{ width: "20px", height: "20px", borderRadius: "50%", background: "var(--tint)", color: "var(--brand)", display: "grid", placeItems: "center", fontWeight: 700, flexShrink: 0 }}>2</span>
                  <span>If both attempts fail, automatically escalates to <b>Priority 2</b>.</span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "12px", color: "var(--muted)" }}>
                  <span style={{ width: "20px", height: "20px", borderRadius: "50%", background: "var(--tint)", color: "var(--brand)", display: "grid", placeItems: "center", fontWeight: 700, flexShrink: 0 }}>3</span>
                  <span>Escalation stops immediately when any contact answers.</span>
                </div>
              </div>

              {/* Manual dialer fallback */}
              <div style={{ marginTop: "18px", paddingTop: "14px", borderTop: "1px solid var(--border-subtle)" }}>
                <div className="sos-form-group" style={{ marginBottom: "10px" }}>
                  <label className="sos-label" htmlFor="emergency-number-input">
                    Manual dialer entry fallback
                  </label>
                  <input
                    id="emergency-number-input"
                    type="text"
                    className="sos-input"
                    placeholder="Enter verified emergency phone number (default 999)"
                    value={emergencyNumber}
                    onChange={(e) => setEmergencyNumber(e.target.value)}
                  />
                </div>
                <div style={{ display: "flex", gap: "10px" }}>
                  <button
                    type="button"
                    className="btn solid"
                    style={{ flex: 1, padding: "8px 14px", fontSize: "13px" }}
                    onClick={handleOpenDialer}
                  >
                    Open phone dialer
                  </button>
                  <button
                    type="button"
                    className="btn"
                    style={{ padding: "8px 14px", fontSize: "13px" }}
                    onClick={() => setShowGuidanceModal(true)}
                  >
                    Safety guidance
                  </button>
                </div>
              </div>
            </div>

            {/* Card 2: Trusted Emergency Contacts (Priority 1–5) */}
            <div className="sos-card">
              <div className="sos-card-header">
                <div>
                  <h2 className="sos-card-title">Saved Emergency Contacts (1–5)</h2>
                  <p className="sos-card-desc" style={{ marginBottom: 0 }}>
                    Connected to your authenticated student account. Reordered by calling priority.
                  </p>
                </div>
                <span className="sos-card-badge">{contacts.length} / 5</span>
              </div>

              {/* Contacts List */}
              <div className="sos-contacts-list" style={{ marginTop: "14px" }}>
                {isLoadingContacts ? (
                  <div style={{ padding: "18px 0", textAlign: "center", color: "var(--muted)", fontSize: "13px" }}>
                    Loading trusted contacts...
                  </div>
                ) : contacts.length === 0 ? (
                  <div style={{ padding: "18px 0", textAlign: "center", color: "var(--muted)", fontSize: "13px" }}>
                    No emergency contacts saved yet. Add up to 5 contacts below.
                  </div>
                ) : (
                  contacts.map((contact, index) => {
                    const isOpened = openContactId === contact.id;
                    return (
                      <div key={contact.id} style={{ display: "flex", flexDirection: "column" }}>
                        <div className="sos-contact-item">
                          <div className="sos-contact-left">
                            <div className="sos-contact-avatar" title={`Priority ${contact.priority}`}>
                              #{contact.priority}
                            </div>
                            <div className="sos-contact-info">
                              <div className="sos-contact-name-row">
                                <span className="sos-contact-name">{contact.name}</span>
                                <span className="sos-contact-priority-tag">
                                  Priority #{contact.priority}
                                </span>
                              </div>
                              <div className="sos-contact-sub">
                                {contact.relationship} · {contact.phoneNumber}
                              </div>
                            </div>
                          </div>

                          <div className="sos-contact-actions">
                            <button
                              type="button"
                              className="sos-btn sos-btn-outline sos-btn-sm"
                              onClick={() => setOpenContactId(isOpened ? null : contact.id)}
                            >
                              {isOpened ? "Hide" : "Details"}
                            </button>

                            {/* Priority Reordering Buttons */}
                            <button
                              type="button"
                              className="sos-icon-btn"
                              title="Move priority up"
                              disabled={index === 0}
                              onClick={() => handleMovePriority(index, "up")}
                            >
                              ▲
                            </button>
                            <button
                              type="button"
                              className="sos-icon-btn"
                              title="Move priority down"
                              disabled={index === contacts.length - 1}
                              onClick={() => handleMovePriority(index, "down")}
                            >
                              ▼
                            </button>

                            {/* Edit Button */}
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

                            {/* Delete Button */}
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

                        {/* Expanded actions view */}
                        {isOpened && (
                          <div className="sos-contact-expanded">
                            <div className="sos-contact-details-grid">
                              <div>
                                <b>Phone Number</b>
                                <span>{contact.phoneNumber}</span>
                              </div>
                              <div>
                                <b>Relationship</b>
                                <span>{contact.relationship}</span>
                              </div>
                              <div>
                                <b>Priority Escalation</b>
                                <span>Called at Step #{contact.priority}</span>
                              </div>
                            </div>
                            <div className="sos-contact-expanded-actions">
                              <a
                                href={`tel:${encodeURIComponent(contact.phoneNumber)}`}
                                className="btn solid"
                                style={{ padding: "6px 14px", fontSize: "12px" }}
                                onClick={() => showToast(`Calling ${contact.name}...`)}
                              >
                                Direct Call
                              </a>
                              <a
                                href={`sms:${encodeURIComponent(contact.phoneNumber)}`}
                                className="btn"
                                style={{ padding: "6px 14px", fontSize: "12px" }}
                                onClick={() => showToast(`Opening SMS to ${contact.name}...`)}
                              >
                                Send SMS
                              </a>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>

              {/* Add contact footer button */}
              <div style={{ marginTop: "14px", display: "flex", justifyContent: "flex-end" }}>
                <button
                  type="button"
                  className="btn solid"
                  disabled={contacts.length >= 5}
                  onClick={handleOpenAdd}
                >
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <line x1="12" y1="5" x2="12" y2="19" />
                    <line x1="5" y1="12" x2="19" y2="12" />
                  </svg>
                  <span>{contacts.length >= 5 ? "Max 5 Contacts Saved" : `+ Add Emergency Contact (${contacts.length}/5)`}</span>
                </button>
              </div>
            </div>
          </div>

          {/* ================= COLUMN 2: LOCATION SHARE & SMS ================= */}
          <div className="sos-col">
            {/* Card 1: Live GPS Location Sharing */}
            <div className="sos-card">
              <div className="sos-card-header">
                <div>
                  <h2 className="sos-card-title">Live GPS Location Sharing</h2>
                  <p className="sos-card-desc" style={{ marginBottom: 0 }}>
                    Continuously streams real-time coordinates while emergency is active.
                  </p>
                </div>
                <span className={`sos-card-badge ${gpsStatus === "CONNECTED" ? "badge-mint" : "badge-amber"}`}>
                  {gpsStatus === "CONNECTED" ? "✓ GPS Signal Locked" : gpsStatus}
                </span>
              </div>

              {/* GPS Coordinates Box */}
              <div
                style={{
                  background: "var(--field)",
                  border: "1.5px solid var(--border-subtle)",
                  borderRadius: "10px",
                  padding: "16px",
                  marginTop: "14px",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "8px" }}>
                  <span style={{ fontSize: "13px", fontWeight: 700, color: "var(--ink)" }}>
                    Device Coordinates
                  </span>
                  <span style={{ fontSize: "12px", color: "var(--muted)" }}>
                    {gpsCoords ? `Updated ${gpsCoords.timestamp.toLocaleTimeString()}` : "Waiting for activation"}
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
                      <small style={{ color: "var(--muted)", display: "block" }}>Tracking Protocol</small>
                      <b style={{ color: "var(--brand)" }}>Active Streaming</b>
                    </div>
                  </div>
                ) : (
                  <p style={{ fontSize: "12.5px", color: "var(--muted)", margin: 0 }}>
                    GPS coordinates will be captured via browser Geolocation API when emergency SOS is triggered.
                  </p>
                )}
              </div>

              {/* Secure Tracking Link Box */}
              <div style={{ marginTop: "16px" }}>
                <label className="sos-label">Secure Emergency Tracking Link</label>
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
                    value={trackingUrl || (activeSession?.trackingToken ? `${typeof window !== "undefined" ? window.location.origin : ""}/sos/track/${activeSession.trackingToken}` : "Generated automatically upon SOS trigger")}
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
                  Protected by cryptographic 48-hex random token. Access immediately expires when emergency is ended.
                </div>
              </div>

              {/* Preview Tracking Page Action */}
              {(trackingUrl || activeSession?.trackingToken) && (
                <div style={{ marginTop: "12px" }}>
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

            {/* Card 2: Automated Emergency SMS Alerts */}
            <div className="sos-card">
              <div className="sos-card-header">
                <div>
                  <h2 className="sos-card-title">Automated Emergency SMS</h2>
                  <p className="sos-card-desc" style={{ marginBottom: 0 }}>
                    Instant SMS dispatches with student name, alert text, time, and live map URL.
                  </p>
                </div>
                <span className="sos-card-badge">{smsLog.length} Sent</span>
              </div>

              <div style={{ marginTop: "14px" }}>
                {smsLog.length === 0 ? (
                  <div style={{ padding: "16px", background: "var(--field)", borderRadius: "8px", fontSize: "12.5px", color: "var(--muted)", textAlign: "center" }}>
                    Emergency SMS alerts will be dispatched to all {contacts.length} saved contacts simultaneously upon SOS activation.
                  </div>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                    {smsLog.map((sms) => (
                      <div
                        key={sms.id}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          padding: "10px 12px",
                          background: "#ffffff",
                          border: "1px solid var(--border-subtle)",
                          borderRadius: "8px",
                          fontSize: "12.5px",
                        }}
                      >
                        <div>
                          <b>{sms.recipientName}</b> ({sms.phoneNumber})
                          <div style={{ fontSize: "11px", color: "var(--muted)" }}>
                            {sms.sentAt ? new Date(sms.sentAt).toLocaleTimeString() : "Pending delivery"}
                          </div>
                        </div>
                        <span className={`sos-card-badge ${sms.status === "DELIVERED" || sms.status === "SENT" || sms.status === "MOCK_SENT" ? "badge-mint" : "badge-amber"}`}>
                          {sms.status === "MOCK_SENT" ? "✓ Mock Sent" : sms.status}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {activeSession && activeSession.status === "ACTIVE" && (
                <div style={{ marginTop: "14px", display: "flex", justifyContent: "flex-end" }}>
                  <button
                    type="button"
                    className="btn"
                    disabled={isResendingSms}
                    onClick={handleResendSms}
                  >
                    {isResendingSms ? "Resending alerts..." : "Resend SMS Alerts"}
                  </button>
                </div>
              )}
            </div>

            {/* Card 3: Campus & National Emergency Hotlines */}
            <div className="sos-card">
              <div className="sos-card-header">
                <h2 className="sos-card-title">Direct Emergency Hotlines</h2>
              </div>
              <p className="sos-card-desc">
                Verified Dhaka University campus security and government emergency services available 24/7.
              </p>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px", marginTop: "12px" }}>
                <a
                  href="tel:999"
                  className="btn solid"
                  style={{ background: "#b3261e", borderColor: "#b3261e", textAlign: "center", textDecoration: "none" }}
                >
                  Dial 999 (National)
                </a>
                <a
                  href="tel:01700000000"
                  className="btn solid"
                  style={{ textAlign: "center", textDecoration: "none" }}
                >
                  DU Proctor Desk
                </a>
                <a
                  href="tel:0255165088"
                  className="btn"
                  style={{ textAlign: "center", textDecoration: "none" }}
                >
                  DMCH Medical
                </a>
                <a
                  href="tel:01713373127"
                  className="btn"
                  style={{ textAlign: "center", textDecoration: "none" }}
                >
                  Shahbagh Police
                </a>
              </div>
            </div>
          </div>
        </div>

        {/* ================= SECTION: EMERGENCY ACTIVITY & AUDIT HISTORY ================= */}
        <div className="sos-card" style={{ marginTop: "24px" }}>
          <div className="sos-card-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "8px" }}>
            <div>
              <h2 className="sos-card-title">Emergency Activity & Incident History</h2>
              <p className="sos-card-desc" style={{ marginBottom: 0 }}>
                Verified audit log of past emergency activations, calling attempts, SMS alerts and GPS breadcrumbs.
              </p>
            </div>
            <span className="sos-card-badge">{sessionHistory.length} Past Incidents</span>
          </div>

          <div style={{ marginTop: "14px" }}>
            {sessionHistory.length === 0 ? (
              <div style={{ padding: "16px", textAlign: "center", color: "var(--muted)", fontSize: "13px" }}>
                No past emergency incidents recorded. Your safety record is clean.
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                {sessionHistory.slice(0, 4).map((hist) => (
                  <div
                    key={hist.id}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      padding: "12px 14px",
                      background: "#ffffff",
                      border: "1.5px solid var(--border-subtle)",
                      borderRadius: "10px",
                      flexWrap: "wrap",
                      gap: "10px",
                    }}
                  >
                    <div>
                      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                        <b>Incident #{hist.id.slice(0, 10)}</b>
                        <span className={`sos-card-badge ${hist.status === "RESOLVED" ? "badge-mint" : "badge-amber"}`}>
                          {hist.status}
                        </span>
                      </div>
                      <div style={{ fontSize: "12px", color: "var(--muted)", marginTop: "3px" }}>
                        Activated: {new Date(hist.createdAt).toLocaleDateString()} at {new Date(hist.createdAt).toLocaleTimeString()} ·
                        Calls: {hist.callAttempts?.length || 0} · SMS: {hist.smsDispatches?.length || 0} · GPS: {hist.locationUpdates?.length || 0} points
                      </div>
                    </div>

                    <button
                      type="button"
                      className="btn"
                      style={{ padding: "6px 12px", fontSize: "12px" }}
                      onClick={() => {
                        setSelectedHistorySession(hist);
                        setShowHistoryModal(true);
                      }}
                    >
                      Inspect Audit Trail →
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </main>

      {/* ================= MODAL: 5-SECOND CANCELLATION COUNTDOWN ================= */}
      {showCountdownModal && (
        <div className="sos-escalation-overlay">
          <div className="sos-escalation-modal" style={{ textAlign: "center", maxWidth: "460px" }}>
            <div className="sos-countdown-header">
              <div className="sos-countdown-circle">{countdownSeconds}</div>
              <h2 style={{ fontSize: "20px", fontWeight: 700, margin: "14px 0 6px" }}>
                Confirming Emergency SOS
              </h2>
              <p style={{ fontSize: "13px", color: "rgba(255,255,255,0.9)", margin: 0 }}>
                Calling Priority 1 contact in {countdownSeconds}s... Tap cancel below if triggered accidentally.
              </p>
            </div>

            <div style={{ padding: "20px" }}>
              <div style={{ background: "var(--field)", padding: "12px", borderRadius: "8px", fontSize: "13px", textAlign: "left", marginBottom: "18px" }}>
                <b>Automatic actions in {countdownSeconds}s:</b>
                <ul style={{ paddingLeft: "18px", marginTop: "6px", fontSize: "12.5px", color: "var(--muted)" }}>
                  <li>Send SMS with live tracking map to all {contacts.length} saved contacts.</li>
                  <li>Call Priority 1: {contacts[0]?.name} ({contacts[0]?.phoneNumber}).</li>
                  <li>Escalate to Priority 2 if unanswered after 2 attempts.</li>
                </ul>
              </div>

              <div style={{ display: "flex", gap: "10px" }}>
                <button
                  type="button"
                  className="btn"
                  style={{ flex: 1, padding: "12px", fontSize: "14px", fontWeight: 700 }}
                  onClick={handleCancelCountdown}
                >
                  Cancel (Accidental)
                </button>
                <button
                  type="button"
                  className="btn solid"
                  style={{ flex: 1, padding: "12px", fontSize: "14px", fontWeight: 700, background: "#b3261e", borderColor: "#b3261e" }}
                  onClick={handleConfirmSOS}
                >
                  Call Now (Instant)
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ================= MODAL: ADD / EDIT CONTACT ================= */}
      {showManageModal && (
        <div className="sos-escalation-overlay">
          <div className="sos-escalation-modal" style={{ maxWidth: "480px" }}>
            <div style={{ padding: "18px 20px", borderBottom: "1.5px solid var(--border-subtle)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <h3 style={{ fontSize: "17px", fontWeight: 700, margin: 0 }}>
                {editingContact ? "Edit Emergency Contact" : "Add Emergency Contact"}
              </h3>
              <button
                type="button"
                onClick={() => {
                  setShowManageModal(false);
                  setShowAddForm(false);
                }}
                style={{ background: "none", border: "none", fontSize: "20px", cursor: "pointer", color: "var(--muted)" }}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveContact} style={{ padding: "20px" }}>
              {formError && (
                <div style={{ padding: "10px", background: "#fee2e2", border: "1px solid #ef4444", borderRadius: "8px", color: "#b91c1c", fontSize: "13px", marginBottom: "14px" }}>
                  {formError}
                </div>
              )}

              <div className="sos-form-group">
                <label className="sos-label">Contact Full Name *</label>
                <input
                  type="text"
                  className="sos-input"
                  placeholder="e.g. Farida Rahman (Mother)"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  required
                />
              </div>

              <div className="sos-form-group">
                <label className="sos-label">Phone Number *</label>
                <input
                  type="tel"
                  className="sos-input"
                  placeholder="e.g. +8801711223344"
                  value={formPhone}
                  onChange={(e) => setFormPhone(e.target.value)}
                  required
                />
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
                  <option value="Roommate">Roommate</option>
                  <option value="Close Friend">Close Friend</option>
                  <option value="Hall Provost">Hall Provost</option>
                  <option value="Campus Proctor">Campus Proctor</option>
                </select>
              </div>

              <div className="sos-form-group">
                <label className="sos-label">Calling Priority (1–5)</label>
                <select
                  className="sos-input"
                  value={formPriority}
                  onChange={(e) => setFormPriority(Number(e.target.value))}
                >
                  <option value={1}>Priority 1 (Called First)</option>
                  <option value={2}>Priority 2 (Second Escalation)</option>
                  <option value={3}>Priority 3 (Third Escalation)</option>
                  <option value={4}>Priority 4 (Fourth Escalation)</option>
                  <option value={5}>Priority 5 (Fifth Escalation)</option>
                </select>
                <div className="sos-help-text">
                  Priority 1 will always receive the first emergency telephone call.
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
                  style={{ flex: 1 }}
                  disabled={isSubmitting}
                >
                  {isSubmitting ? "Saving..." : editingContact ? "Update Contact" : "Save Contact"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ================= MODAL: AUDIT TRAIL INSPECTOR ================= */}
      {showHistoryModal && selectedHistorySession && (
        <div className="sos-escalation-overlay">
          <div className="sos-escalation-modal" style={{ maxWidth: "560px" }}>
            <div style={{ padding: "18px 20px", borderBottom: "1.5px solid var(--border-subtle)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <h3 style={{ fontSize: "17px", fontWeight: 700, margin: 0 }}>
                  Incident Audit Trail #{selectedHistorySession.id.slice(0, 12)}
                </h3>
                <small style={{ color: "var(--muted)", fontSize: "12px" }}>
                  Status: {selectedHistorySession.status} · Resolved: {selectedHistorySession.resolvedAt ? new Date(selectedHistorySession.resolvedAt).toLocaleString() : "Active"}
                </small>
              </div>
              <button
                type="button"
                onClick={() => setShowHistoryModal(false)}
                style={{ background: "none", border: "none", fontSize: "20px", cursor: "pointer", color: "var(--muted)" }}
              >
                ✕
              </button>
            </div>

            <div style={{ padding: "20px", maxHeight: "70vh", overflowY: "auto" }}>
              <div style={{ marginBottom: "16px" }}>
                <b>Resolution Reason:</b>
                <p style={{ fontSize: "13px", color: "var(--muted)", margin: "4px 0 0" }}>
                  {selectedHistorySession.resolvedReason || "Student ended emergency session."}
                </p>
              </div>

              <div style={{ marginBottom: "16px" }}>
                <b>Call Attempts Log ({selectedHistorySession.callAttempts?.length || 0}):</b>
                {selectedHistorySession.callAttempts && selectedHistorySession.callAttempts.length > 0 ? (
                  <div style={{ display: "flex", flexDirection: "column", gap: "6px", marginTop: "8px" }}>
                    {selectedHistorySession.callAttempts.map((attempt) => (
                      <div
                        key={attempt.id}
                        style={{
                          padding: "8px 10px",
                          background: "var(--field)",
                          borderRadius: "6px",
                          fontSize: "12px",
                          display: "flex",
                          justifyContent: "space-between",
                        }}
                      >
                        <span>Attempt #{attempt.attemptNumber} · Priority #{attempt.priority} ({attempt.contactName})</span>
                        <span style={{ fontWeight: 700 }}>{attempt.status}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p style={{ fontSize: "12px", color: "var(--muted)", margin: "4px 0 0" }}>No calls placed.</p>
                )}
              </div>

              <div>
                <b>SMS Notifications Log ({selectedHistorySession.smsDispatches?.length || 0}):</b>
                {selectedHistorySession.smsDispatches && selectedHistorySession.smsDispatches.length > 0 ? (
                  <div style={{ display: "flex", flexDirection: "column", gap: "6px", marginTop: "8px" }}>
                    {selectedHistorySession.smsDispatches.map((sms) => (
                      <div
                        key={sms.id}
                        style={{
                          padding: "8px 10px",
                          background: "var(--field)",
                          borderRadius: "6px",
                          fontSize: "12px",
                          display: "flex",
                          justifyContent: "space-between",
                        }}
                      >
                        <span>To {sms.recipientName} ({sms.phoneNumber})</span>
                        <span style={{ fontWeight: 700 }}>{sms.status}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p style={{ fontSize: "12px", color: "var(--muted)", margin: "4px 0 0" }}>No SMS dispatched.</p>
                )}
              </div>
            </div>

            <div style={{ padding: "14px 20px", borderTop: "1.5px solid var(--border-subtle)", textAlign: "right" }}>
              <button
                type="button"
                className="btn solid"
                onClick={() => setShowHistoryModal(false)}
              >
                Close Audit Trail
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ================= MODAL: SAFETY GUIDANCE ================= */}
      {showGuidanceModal && (
        <div className="sos-escalation-overlay">
          <div className="sos-escalation-modal" style={{ maxWidth: "480px" }}>
            <div style={{ padding: "18px 20px", borderBottom: "1.5px solid var(--border-subtle)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <h3 style={{ fontSize: "17px", fontWeight: 700, margin: 0 }}>
                Official Campus Emergency Guidance
              </h3>
              <button
                type="button"
                onClick={() => setShowGuidanceModal(false)}
                style={{ background: "none", border: "none", fontSize: "20px", cursor: "pointer", color: "var(--muted)" }}
              >
                ✕
              </button>
            </div>

            <div style={{ padding: "20px", fontSize: "13px", lineHeight: "1.6", color: "var(--ink)" }}>
              <p><b>1. Immediate Personal Danger:</b></p>
              <p style={{ color: "var(--muted)", marginBottom: "12px" }}>
                If you are in immediate danger, dial <b>999</b> immediately or move toward the nearest illuminated university building (TSC, Curzon Hall, Arts Faculty).
              </p>

              <p><b>2. Medical Emergency on Campus:</b></p>
              <p style={{ color: "var(--muted)", marginBottom: "12px" }}>
                Contact DU Medical Center or Dhaka Medical College Hospital (DMCH) emergency desk at <b>02-55165088</b>.
              </p>

              <p><b>3. Harassment or Campus Security:</b></p>
              <p style={{ color: "var(--muted)", marginBottom: "12px" }}>
                Report immediately to the DU Proctorial team at <b>01700-000000</b> or notify your resident Hall Provost.
              </p>
            </div>

            <div style={{ padding: "14px 20px", borderTop: "1.5px solid var(--border-subtle)", textAlign: "right" }}>
              <button
                type="button"
                className="btn solid"
                onClick={() => setShowGuidanceModal(false)}
              >
                Understood
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast Notification */}
      <div className={`toast ${toastVisible ? "on" : ""}`} role="status">
        {toastMessage}
      </div>
    </div>
  );
}
