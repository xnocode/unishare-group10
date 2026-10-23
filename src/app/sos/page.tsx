"use client";

import React, { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
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

  // Support alert form state
  const [concern, setConcern] = useState("Safety concern at rental pickup");
  const [relatedActivity, setRelatedActivity] = useState("Scientific calculator · Active rental");
  const [locationToShare, setLocationToShare] = useState("Science Library, University of Dhaka");
  const [messageToSupport, setMessageToSupport] = useState(
    "I would like support to contact me about a concern at the rental pickup point."
  );
  const [consentLocation, setConsentLocation] = useState(true);
  const [notifyContactsAuto, setNotifyContactsAuto] = useState(false);
  const [alertStatus, setAlertStatus] = useState<"not_sent" | "submitting" | "submitted">("not_sent");
  const [supportReferenceId, setSupportReferenceId] = useState("");

  // Toast
  const [toastMessage, setToastMessage] = useState("");
  const [toastVisible, setToastVisible] = useState(false);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setToastVisible(true);
    setTimeout(() => setToastVisible(false), 3000);
  };

  // =========================================================================
  // SOS ACTIVATION & AUTOMATIC ESCALATION CALLING ENGINE
  // =========================================================================
  const [isCountdownActive, setIsCountdownActive] = useState(false);
  const [countdownSeconds, setCountdownSeconds] = useState(5);
  const countdownIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const [activeSession, setActiveSession] = useState<EmergencySessionRecord | null>(null);
  const [isCallingActive, setIsCallingActive] = useState(false);
  const [callLog, setCallLog] = useState<CallAttemptRecord[]>([]);
  const [telephonyInfo, setTelephonyInfo] = useState<{
    provider: "TWILIO" | "MOCK_SIMULATOR";
    isLive: boolean;
    fromNumber: string;
    message: string;
  }>({
    provider: "MOCK_SIMULATOR",
    isLive: false,
    fromNumber: "Campus Gateway",
    message: "Mock Telephony Mode active.",
  });

  // Active call progress tracking
  const [currentlyCallingContact, setCurrentlyCallingContact] = useState<EmergencyContact | null>(null);
  const [currentAttemptNumber, setCurrentAttemptNumber] = useState<number>(1);
  const [currentCallStatusText, setCurrentCallStatusText] = useState<string>("");
  const [isStepProcessing, setIsStepProcessing] = useState(false);
  const [escalationResolutionNote, setEscalationResolutionNote] = useState<string>("");

  // =========================================================================
  // STEP 3: LIVE GPS LOCATION TRACKING & AUTOMATIC EMERGENCY SMS
  // =========================================================================
  const [trackingUrl, setTrackingUrl] = useState<string>("");
  const [gpsStatus, setGpsStatus] = useState<"PENDING" | "CONNECTED" | "DENIED" | "UNAVAILABLE" | "TIMEOUT">("PENDING");
  const [gpsCoords, setGpsCoords] = useState<{
    latitude: number;
    longitude: number;
    accuracy: number | null;
    timestamp: Date;
  } | null>(null);
  const [gpsErrorMsg, setGpsErrorMsg] = useState<string>("");
  const watchPositionRef = useRef<number | null>(null);
  const lastLocationSendTimeRef = useRef<number>(0);

  // SMS dispatch list
  const [smsLog, setSmsLog] = useState<EmergencySmsRecord[]>([]);
  const [isResendingSms, setIsResendingSms] = useState(false);

  // Requirement 2: Emergency activity history state
  const [sessionHistory, setSessionHistory] = useState<EmergencySessionRecord[]>([]);
  const [selectedHistorySession, setSelectedHistorySession] = useState<EmergencySessionRecord | null>(null);
  const [showHistoryModal, setShowHistoryModal] = useState(false);

  // Stop GPS watch position
  const stopLocationTracking = () => {
    if (watchPositionRef.current !== null && typeof navigator !== "undefined" && navigator.geolocation) {
      navigator.geolocation.clearWatch(watchPositionRef.current);
      watchPositionRef.current = null;
    }
  };

  // Start continuous GPS watch position
  const startLocationTracking = (sessionId: string) => {
    if (typeof window === "undefined" || !navigator.geolocation) {
      setGpsStatus("UNAVAILABLE");
      setGpsErrorMsg("Geolocation is not supported by your browser.");
      return;
    }

    stopLocationTracking();
    setGpsStatus("PENDING");
    setGpsErrorMsg("");

    const handleSuccess = (position: GeolocationPosition) => {
      const { latitude, longitude, accuracy, heading, speed } = position.coords;
      const now = Date.now();

      setGpsStatus("CONNECTED");
      setGpsCoords({
        latitude,
        longitude,
        accuracy: accuracy || null,
        timestamp: new Date(position.timestamp || now),
      });

      // Throttle server uploads to once every 4 seconds to conserve battery and bandwidth
      if (now - lastLocationSendTimeRef.current >= 4000) {
        lastLocationSendTimeRef.current = now;
        fetch("/api/sos/session", {
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
            gpsStatus: "CONNECTED",
          }),
        }).catch((err) => console.error("Error sending GPS update:", err));
      }
    };

    const handleError = (error: GeolocationPositionError) => {
      let statusStr: "DENIED" | "UNAVAILABLE" | "TIMEOUT" = "UNAVAILABLE";
      let msg = "Unable to retrieve device GPS position.";

      if (error.code === error.PERMISSION_DENIED) {
        statusStr = "DENIED";
        msg = "GPS location permission was denied. Please allow location access in your browser settings to share your real-time position with emergency contacts.";
      } else if (error.code === error.POSITION_UNAVAILABLE) {
        statusStr = "UNAVAILABLE";
        msg = "GPS position is currently unavailable. Retrying satellite lock...";
      } else if (error.code === error.TIMEOUT) {
        statusStr = "TIMEOUT";
        msg = "GPS location request timed out. Retrying...";
      }

      setGpsStatus(statusStr);
      setGpsErrorMsg(msg);

      fetch("/api/sos/session", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-user-email": currentUser.email,
        },
        body: JSON.stringify({
          action: "GPS_STATUS_UPDATE",
          sessionId,
          gpsStatus: statusStr,
          errorMessage: msg,
        }),
      }).catch((err) => console.error(err));
    };

    // Watch position with high accuracy
    watchPositionRef.current = navigator.geolocation.watchPosition(
      handleSuccess,
      handleError,
      {
        enableHighAccuracy: true,
        timeout: 12000,
        maximumAge: 4000,
      }
    );
  };

  // Re-dispatch emergency SMS to all contacts
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

  // 1. Sync authenticated user from localStorage if present
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

  // 2. Fetch contacts and telephony status
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
            if (data.activeSession.callingStatus === "CONTACT_REACHED") {
              const loaded = data.contacts || [];
              const reached = loaded.find((c: EmergencyContact) => c.id === data.activeSession.answeredContactId);
              if (reached) {
                setCurrentlyCallingContact(reached);
                setCurrentCallStatusText(`Contact reached: ${reached.name} answered. Escalation stopped.`);
                setEscalationResolutionNote(
                  `Priority ${reached.priority} contact (${reached.name}) answered. Emergency session remains ACTIVE until ended by student.`
                );
              }
            }
          }
          if (Array.isArray(data.activeSession.callAttempts)) {
            setCallLog(data.activeSession.callAttempts);
          }
        }
        if (Array.isArray(data.sessionHistory)) {
          setSessionHistory(data.sessionHistory);
        }
      }
    } catch (err) {
      console.error("Failed to load contacts/session:", err);
    } finally {
      setIsLoadingContacts(false);
    }
  };

  useEffect(() => {
    if (currentUser.email) {
      fetchContactsAndSession();
    }
  }, [currentUser.email]);

  // =========================================================================
  // SOS BUTTON ACTIVATION & 5-SECOND COUNTDOWN
  // =========================================================================

  // Step 1: User clicks SOS button -> Open confirmation interface with 5-second countdown
  const handleTriggerSOS = () => {
    // Requirement 9: Prevent duplicate SOS requests if an emergency is already active
    if (activeSession && activeSession.status === "ACTIVE") {
      setIsCallingActive(true);
      showToast("Emergency session is already ACTIVE. Opening current session.");
      return;
    }

    if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
    setCountdownSeconds(5);
    setIsCountdownActive(true);

    countdownIntervalRef.current = setInterval(() => {
      setCountdownSeconds((prev) => {
        if (prev <= 1) {
          if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
          // Countdown reached 0: automatically confirm and start emergency calling
          executeSOSConfirmation();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  // Step 2: Cancel SOS countdown
  const handleCancelCountdown = () => {
    if (countdownIntervalRef.current) {
      clearInterval(countdownIntervalRef.current);
      countdownIntervalRef.current = null;
    }
    setIsCountdownActive(false);
    setCountdownSeconds(5);
    showToast("SOS activation cancelled. You are safe.");
  };

  // Step 3: Confirmation (after 5s or instant confirmation button)
  const executeSOSConfirmation = async () => {
    if (countdownIntervalRef.current) {
      clearInterval(countdownIntervalRef.current);
      countdownIntervalRef.current = null;
    }
    setIsCountdownActive(false);

    try {
      showToast("SOS Confirmed! Initializing emergency calling session...");
      const res = await fetch("/api/sos/session", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-user-email": currentUser.email,
        },
        body: JSON.stringify({
          action: "START",
          triggerReason: "Emergency SOS Activated by student",
        }),
      });

      const data = await res.json();
      if (data.success && data.session) {
        setActiveSession(data.session);
        setCallLog([]);
        setEscalationResolutionNote("");
        setIsCallingActive(true);

        if (data.trackingUrl) {
          setTrackingUrl(data.trackingUrl);
        }
        if (Array.isArray(data.smsDispatches)) {
          setSmsLog(data.smsDispatches);
        }

        if (data.alreadyActive) {
          showToast("Re-attached to current active emergency session.");
        } else if (Array.isArray(data.smsDispatches)) {
          showToast(`Emergency SOS activated! Alert SMS dispatched to ${data.smsDispatches.length} contacts.`);
        }

        // Start Live GPS tracking (Requirement 1, 2, 3)
        startLocationTracking(data.session.id);

        const loadedContacts: EmergencyContact[] = data.contacts || contacts;
        setContacts(loadedContacts);

        // Start priority 1 calling
        if (loadedContacts.length > 0) {
          startCallStep(data.session.id, loadedContacts[0], 1, loadedContacts);
        } else {
          showToast("Warning: No emergency contacts saved. Dialing 999 recommended.");
        }
      }
    } catch (err) {
      console.error("Failed to start emergency session:", err);
      showToast("Error creating emergency session.");
    }
  };

  // Step 4: Priority Call Step (1 -> Retry 1 -> 2 -> Retry 2 ... Stop on Answer)
  const startCallStep = async (
    sessionId: string,
    contact: EmergencyContact,
    attemptNumber: number,
    contactList: EmergencyContact[],
    simulatedOutcome?: "ANSWERED" | "UNANSWERED" | "BUSY" | "FAILED"
  ) => {
    setCurrentlyCallingContact(contact);
    setCurrentAttemptNumber(attemptNumber);
    setIsStepProcessing(true);
    setCurrentCallStatusText(
      `Initiating call to Priority #${contact.priority}: ${contact.name} (${contact.phoneNumber}) [Attempt ${attemptNumber}/2]...`
    );

    // Realistic dial / ring delay
    await new Promise((resolve) => setTimeout(resolve, 1400));
    setCurrentCallStatusText(`Ringing ${contact.name}...`);

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
          simulatedOutcome,
        }),
      });

      const data = await res.json();
      if (data.success) {
        if (data.allAttempts) {
          setCallLog(data.allAttempts);
        }

        const next = data.nextStep;

        // Condition 8: Stop escalation when contact answers
        if (next.escalationStopped || data.session?.callingStatus === "CONTACT_REACHED") {
          setIsStepProcessing(false);
          setCurrentCallStatusText(`Contact Answered! Call connected with ${contact.name}.`);
          setEscalationResolutionNote(
            next.reason || `Priority ${contact.priority} contact (${contact.name}) answered. Escalation stopped. Emergency session remains ACTIVE.`
          );
          setActiveSession(data.session);
          showToast(`Emergency answered by ${contact.name}! Escalation stopped.`);
          return;
        }

        // Condition 5: Retry once if unanswered (Attempt 1 -> Attempt 2)
        if (next.nextAttemptNumber === 2 && next.nextContactId === contact.id) {
          setCurrentCallStatusText(next.reason);
          await new Promise((resolve) => setTimeout(resolve, 1800));
          // Automatic retry
          startCallStep(sessionId, contact, 2, contactList);
          return;
        }

        // Condition 6 & 7: Both attempts failed -> call next priority contact
        if (next.nextContactId && next.nextContactId !== contact.id) {
          const nextContact = contactList.find((c) => c.id === next.nextContactId);
          if (nextContact) {
            setCurrentCallStatusText(next.reason);
            await new Promise((resolve) => setTimeout(resolve, 2000));
            // Escalate to next priority
            startCallStep(sessionId, nextContact, 1, contactList);
            return;
          }
        }

        // All contacts exhausted without answer
        if (next.escalationExhausted) {
          setIsStepProcessing(false);
          setCurrentCallStatusText("All emergency contacts called without answer.");
          setEscalationResolutionNote(next.reason);
          setActiveSession(data.session);
          showToast("All contacts called. Please dial 999 or DU Proctor Office immediately.");
        }
      }
    } catch (err) {
      console.error("Step call error:", err);
      setCurrentCallStatusText("Connection error during emergency calling step.");
    } finally {
      setIsStepProcessing(false);
    }
  };

  // End and resolve active emergency session (manual student confirmation)
  const handleResolveSession = async (reason: string = "Marked safe by student") => {
    if (!activeSession) return;
    try {
      // Requirement 11: Stop GPS updates and further location notifications when emergency ends
      stopLocationTracking();

      const res = await fetch("/api/sos/session", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-user-email": currentUser.email,
        },
        body: JSON.stringify({
          action: "END_EMERGENCY",
          sessionId: activeSession.id,
          reason,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setIsCallingActive(false);
        setActiveSession(data.session);
        setCurrentlyCallingContact(null);
        setEscalationResolutionNote("");
        showToast("Emergency session officially ended. All calls & GPS tracking stopped.");
        fetchContactsAndSession();
      }
    } catch (e) {
      console.error(e);
      stopLocationTracking();
      setIsCallingActive(false);
    }
  };

  // Open dialer directly
  const handleOpenDialer = () => {
    const num = emergencyNumber.trim() || "999";
    showToast(`Opening phone dialer with verified number: ${num}`);
    window.location.href = `tel:${encodeURIComponent(num)}`;
  };

  // Add Contact
  const handleOpenAdd = () => {
    if (contacts.length >= 5) {
      showToast("Maximum of 5 emergency contacts reached.");
      return;
    }
    setEditingContact(null);
    setFormName("");
    setFormPhone("");
    setFormRelationship("Family contact");
    setFormPriority(contacts.length + 1);
    setFormError("");
    setShowAddForm(true);
  };

  // Edit Contact
  const handleOpenEdit = (contact: EmergencyContact) => {
    setEditingContact(contact);
    setFormName(contact.name);
    setFormPhone(contact.phoneNumber);
    setFormRelationship(contact.relationship);
    setFormPriority(contact.priority);
    setFormError("");
    setShowAddForm(true);
  };

  // Save Contact (Create or Update)
  const handleSaveContact = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError("");

    if (!formName.trim()) {
      setFormError("Please enter contact name.");
      return;
    }
    if (!formPhone.trim()) {
      setFormError("Please enter contact phone number.");
      return;
    }

    setIsSubmitting(true);
    try {
      if (editingContact) {
        const res = await fetch("/api/emergency-contacts", {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            "x-user-email": currentUser.email,
          },
          body: JSON.stringify({
            id: editingContact.id,
            name: formName.trim(),
            phoneNumber: formPhone.trim(),
            relationship: formRelationship,
            priority: Number(formPriority),
          }),
        });
        const data = await res.json();
        if (data.success) {
          setContacts(data.contacts);
          setShowAddForm(false);
          setEditingContact(null);
          showToast(`Updated contact: ${formName.trim()}`);
        } else {
          setFormError(data.error || "Failed to update contact.");
        }
      } else {
        const res = await fetch("/api/emergency-contacts", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-user-email": currentUser.email,
          },
          body: JSON.stringify({
            name: formName.trim(),
            phoneNumber: formPhone.trim(),
            relationship: formRelationship,
            priority: Number(formPriority),
          }),
        });
        const data = await res.json();
        if (data.success) {
          setContacts(data.contacts);
          setShowAddForm(false);
          showToast(`Saved new emergency contact: ${formName.trim()}`);
        } else {
          setFormError(data.error || "Failed to create contact.");
        }
      }
    } catch (err) {
      console.error(err);
      setFormError("Connection error while saving contact.");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Delete Contact
  const handleDeleteContact = async (contactId: string, contactName: string) => {
    if (!confirm(`Are you sure you want to remove "${contactName}" from your emergency contacts?`)) {
      return;
    }

    try {
      const res = await fetch(`/api/emergency-contacts?id=${encodeURIComponent(contactId)}`, {
        method: "DELETE",
        headers: { "x-user-email": currentUser.email },
      });
      const data = await res.json();
      if (data.success) {
        setContacts(data.contacts);
        if (openContactId === contactId) setOpenContactId(null);
        showToast(`Removed contact: ${contactName}`);
      } else {
        showToast(data.error || "Failed to delete contact.");
      }
    } catch (err) {
      console.error(err);
      showToast("Error connecting to server to delete contact.");
    }
  };

  // Reorder Priority: Move Up or Move Down
  const handleMovePriority = async (contactIndex: number, direction: "up" | "down") => {
    const targetIndex = direction === "up" ? contactIndex - 1 : contactIndex + 1;
    if (targetIndex < 0 || targetIndex >= contacts.length) return;

    const updated = [...contacts];
    const temp = updated[contactIndex];
    updated[contactIndex] = updated[targetIndex];
    updated[targetIndex] = temp;

    const reorderPayload = updated.map((c, i) => ({
      id: c.id,
      priority: i + 1,
    }));

    setContacts(
      updated.map((c, i) => ({
        ...c,
        priority: i + 1,
      }))
    );

    try {
      const res = await fetch("/api/emergency-contacts", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "x-user-email": currentUser.email,
        },
        body: JSON.stringify({ reorder: reorderPayload }),
      });
      const data = await res.json();
      if (data.success) {
        setContacts(data.contacts);
        showToast("Updated emergency contact priority order.");
      } else {
        fetchContactsAndSession();
        showToast(data.error || "Failed to reorder contacts.");
      }
    } catch (err) {
      console.error(err);
      fetchContactsAndSession();
      showToast("Error updating priority.");
    }
  };

  // Support alert confirmation
  const handleConfirmSupport = () => {
    if (!consentLocation) {
      showToast("Please provide consent to share location with UniShare safety team.");
      return;
    }

    setAlertStatus("submitting");
    setTimeout(() => {
      const ref = `SOS-DU-${Math.floor(100000 + Math.random() * 900000)}`;
      setSupportReferenceId(ref);
      setAlertStatus("submitted");
      showToast(`Support alert confirmed! Reference: ${ref}`);
    }, 800);
  };

  return (
    <div className="unishare-sos-page">
      {/* 1. Unified Navigation Bar */}
      <header className="top">
        <div className="wrap">
          <Link href="/home" className="logo">
            <svg
              width="20"
              height="14"
              viewBox="0 0 20 14"
              fill="none"
              stroke="#0d6b63"
              strokeWidth="2"
              aria-hidden="true"
            >
              <circle cx="6" cy="7" r="4.5" />
              <circle cx="14" cy="7" r="4.5" />
            </svg>
            <span>UniShare</span>
          </Link>

          <nav className="menu" aria-label="Main navigation">
            <Link href="/home">Home</Link>
            <Link href="/marketplace">Marketplace</Link>
            <Link href="/my-products">My products</Link>
            <a href="/marketplace">My rentals</a>
            <Link href="/rides">Rides</Link>
            <Link href="/wallet">Wallet</Link>
            <Link href="/favorites">Favorites</Link>
          </nav>

          <div className="rt">
            <Link className="bell" aria-label="Notifications" href="/notifications">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                <path d="M6 16V11a6 6 0 0 1 12 0v5l1.5 2h-15zM10 21h4" />
              </svg>
              <i />
            </Link>

            {/* Clicking SOS triggers the 5-second emergency confirmation */}
            <button
              type="button"
              className="sos"
              title="Click to trigger emergency SOS activation"
              onClick={handleTriggerSOS}
              style={{ cursor: "pointer", border: "1px solid var(--mint-border)" }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                <path d="M9 12l2 2 4-4" />
              </svg>
              <span>SOS</span>
            </button>

            <div
              className="me"
              onClick={() => showToast(`Signed in: ${currentUser.name} (${currentUser.university})`)}
              title="Click to view profile & options"
            >
              <span className="av">{currentUser.initials}</span>
              <div>
                <b>{currentUser.name}</b>
                <small>My profile ▾</small>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* 2. Main Page Content */}
      <main className="wrap">
        {/* Eyebrow & Title */}
        <div className="sos-eyebrow">YOUR SAFETY COMES FIRST</div>
        <h1 className="sos-title">SOS & emergency assistance</h1>
        <p className="sos-subtitle">
          Find emergency help, reach someone you trust, or ask UniShare to review a campus safety concern.
        </p>

        {/* Verified Student Band */}
        <div className="sos-band">
          <div className="sos-band-left">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
              <path d="M9 12l2 2 4-4" />
            </svg>
            <span>
              {currentUser.name} · {currentUser.university}
            </span>
          </div>
          <span className="sos-band-badge">Verified student</span>
        </div>

        {/* Active Emergency Alert Bar (when calling modal is minimized) */}
        {activeSession && activeSession.status === "ACTIVE" && !isCallingActive && (
          <div className={`sos-active-alert-bar ${activeSession.callingStatus === "CONTACT_REACHED" ? "contact-reached" : ""}`}>
            <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
              <div className={`sos-pulsing-dot ${activeSession.callingStatus === "CONTACT_REACHED" ? "reached" : ""}`} />
              <div>
                <div style={{ fontWeight: 700, fontSize: "14.5px", color: "var(--ink)" }}>
                  {activeSession.callingStatus === "CONTACT_REACHED"
                    ? "Emergency Session ACTIVE — Contact Reached"
                    : "Emergency Session ACTIVE — Escalation in progress"}
                </div>
                <div style={{ fontSize: "12px", color: "var(--muted)", marginTop: "2px" }}>
                  {activeSession.callingStatus === "CONTACT_REACHED"
                    ? "Your emergency contact answered. Emergency session remains ACTIVE until you manually end it."
                    : "Calling sequence is active. Escalating through saved priority contacts."}
                </div>
              </div>
            </div>
            <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
              <button
                type="button"
                className="sos-btn sos-btn-outline sos-btn-sm"
                onClick={() => setIsCallingActive(true)}
              >
                View Calling Session
              </button>
              <button
                type="button"
                className="sos-btn sos-btn-sm"
                style={{ background: "#0d6b63", color: "#ffffff", fontWeight: 700 }}
                onClick={() => handleResolveSession("Emergency ended by student (safe)")}
              >
                End Emergency (I Am Safe)
              </button>
            </div>
          </div>
        )}

        {/* Immediate Danger Warning Banner with Trigger Button */}
        <div className="sos-alert-box" style={{ justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "14px" }}>
          <div style={{ display: "flex", alignItems: "flex-start", gap: "12px", flex: 1, minWidth: "280px" }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
              <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
              <line x1="12" y1="9" x2="12" y2="13" />
              <line x1="12" y1="17" x2="12.01" y2="17" />
            </svg>
            <div>
              <div className="sos-alert-title">
                In immediate danger? Contact local emergency services first.
              </div>
              <div className="sos-alert-desc">
                Move to a safer public place if you can. UniShare support is not emergency services and cannot guarantee emergency response or dispatch.
              </div>
            </div>
          </div>

          <button
            type="button"
            className="sos-btn"
            style={{ background: "#e11d48", color: "#ffffff", border: "1.5px solid #e11d48", fontWeight: 700 }}
            onClick={handleTriggerSOS}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
              <path d="M9 12l2 2 4-4" />
            </svg>
            <span>Activate Emergency SOS</span>
          </button>
        </div>

        {/* Two-Column Grid Layout */}
        <div className="sos-grid">
          {/* ================= LEFT COLUMN ================= */}
          <div className="sos-col">
            {/* Card 1: Call for emergency help */}
            <div className="sos-card">
              <div className="sos-card-header">
                <h2 className="sos-card-title">Call for emergency help</h2>
              </div>
              <p className="sos-card-desc">
                Use a local emergency number you have verified. This page does not place a call automatically.
              </p>

              <div className="sos-form-group">
                <label className="sos-label" htmlFor="emergency-number-input">
                  Emergency-call entry
                </label>
                <input
                  id="emergency-number-input"
                  type="text"
                  className="sos-input"
                  placeholder="Enter a verified local emergency number"
                  value={emergencyNumber}
                  onChange={(e) => setEmergencyNumber(e.target.value)}
                />
                <div className="sos-help-text">
                  No emergency number is prefilled. Check an official local source.
                </div>
              </div>

              <div className="sos-btn-row">
                <button
                  type="button"
                  className="sos-btn sos-btn-primary"
                  onClick={handleOpenDialer}
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                    <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
                  </svg>
                  <span>Open phone dialer</span>
                </button>

                <button
                  type="button"
                  className="sos-btn sos-btn-outline"
                  onClick={() => setShowGuidanceModal(true)}
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                    <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                    <polyline points="15 3 21 3 21 9" />
                    <line x1="10" y1="14" x2="21" y2="3" />
                  </svg>
                  <span>Find official guidance</span>
                </button>
              </div>
            </div>

            {/* Card 2: Your trusted contacts (Emergency Contact Management) */}
            <div className="sos-card">
              <div className="sos-card-header">
                <h2 className="sos-card-title">Your trusted contacts</h2>
                <span className="sos-card-badge">Private</span>
              </div>
              <p className="sos-card-desc">
                Only you can open saved contact details. Contacts are not notified until you choose to contact them.
              </p>

              {/* Contacts List */}
              <div className="sos-contacts-list">
                {isLoadingContacts ? (
                  <div style={{ padding: "16px 0", textAlign: "center", color: "var(--muted)", fontSize: "13px" }}>
                    Loading trusted contacts from database...
                  </div>
                ) : contacts.length === 0 ? (
                  <div style={{ padding: "16px 0", textAlign: "center", color: "var(--muted)", fontSize: "13px" }}>
                    No emergency contacts saved yet. Add up to 5 trusted contacts below.
                  </div>
                ) : (
                  contacts.map((contact, index) => {
                    const isOpened = openContactId === contact.id;
                    return (
                      <div key={contact.id} style={{ display: "flex", flexDirection: "column" }}>
                        <div className="sos-contact-item">
                          <div className="sos-contact-left">
                            <div className="sos-contact-avatar" title={`Priority ${contact.priority}`}>
                              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                                <circle cx="12" cy="7" r="4" />
                              </svg>
                            </div>

                            <div className="sos-contact-info">
                              <div className="sos-contact-name-row">
                                <span className="sos-contact-name">{contact.name}</span>
                                <span className="sos-contact-priority-tag">
                                  #{contact.priority}
                                </span>
                              </div>
                              <div className="sos-contact-sub">
                                {isOpened
                                  ? `${contact.relationship} · ${contact.phoneNumber}`
                                  : "Saved personal contact · details hidden"}
                              </div>
                            </div>
                          </div>

                          <div className="sos-contact-actions">
                            <button
                              type="button"
                              className="sos-btn sos-btn-outline sos-btn-sm"
                              onClick={() => setOpenContactId(isOpened ? null : contact.id)}
                            >
                              {isOpened ? "Hide contact" : "Open contact"}
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

                        {/* Expanded details view */}
                        {isOpened && (
                          <div className="sos-contact-expanded">
                            <div className="sos-contact-details-grid">
                              <div>
                                <b>Phone</b>
                                <span>{contact.phoneNumber}</span>
                              </div>
                              <div>
                                <b>Relationship</b>
                                <span>{contact.relationship}</span>
                              </div>
                              <div>
                                <b>Priority Rank</b>
                                <span>Priority #{contact.priority}</span>
                              </div>
                            </div>
                            <div className="sos-contact-expanded-actions">
                              <a
                                href={`tel:${encodeURIComponent(contact.phoneNumber)}`}
                                className="sos-btn sos-btn-primary sos-btn-sm"
                                onClick={() => showToast(`Calling ${contact.name}...`)}
                              >
                                Call now
                              </a>
                              <a
                                href={`sms:${encodeURIComponent(contact.phoneNumber)}`}
                                className="sos-btn sos-btn-outline sos-btn-sm"
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

              {/* Add contact button or limit indicator */}
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "8px", marginTop: "10px" }}>
                <span
                  className="sos-card-footer-link"
                  onClick={() => setShowManageModal(true)}
                >
                  Manage trusted contacts →
                </span>

                <button
                  type="button"
                  className="sos-btn sos-btn-primary sos-btn-sm"
                  disabled={contacts.length >= 5}
                  onClick={handleOpenAdd}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4">
                    <line x1="12" y1="5" x2="12" y2="19" />
                    <line x1="5" y1="12" x2="19" y2="12" />
                  </svg>
                  <span>{contacts.length >= 5 ? "Max 5 Contacts Reached" : `+ Add Emergency Contact (${contacts.length}/5)`}</span>
                </button>
              </div>
            </div>

            {/* Card 3: Your ride & rental context */}
            <div className="sos-card">
              <div className="sos-card-header">
                <h2 className="sos-card-title">Your ride & rental context</h2>
              </div>

              <div className="sos-context-list">
                {/* Item 1: Ride */}
                <div className="sos-context-item">
                  <div className="sos-context-header">
                    <span className="sos-context-title">Dhanmondi 27 → TSC, DU</span>
                    <span className="sos-card-badge">Upcoming ride</span>
                  </div>
                  <div className="sos-context-desc">
                    Today, 8:30 AM · Car · Arif Hossain · 80 tokens / seat
                  </div>
                  <div className="sos-context-sub">
                    No active ride is shown. View ride details before adding it to a report.
                  </div>
                </div>

                {/* Item 2: Rental */}
                <div className="sos-context-item">
                  <div className="sos-context-header">
                    <span className="sos-context-title">Scientific calculator · Nafis Ahmed</span>
                    <span className="sos-card-badge">Active rental</span>
                  </div>
                  <div className="sos-context-desc">
                    Science Library · 2 days · 80 rental tokens + 100 held deposit tokens
                  </div>
                  <Link href="/marketplace" className="sos-card-footer-link" style={{ marginTop: "4px" }}>
                    View active rental →
                  </Link>
                </div>
              </div>
            </div>
          </div>

          {/* ================= RIGHT COLUMN ================= */}
          <div className="sos-col">
            {/* Card 1: Review your support alert */}
            <div className="sos-card">
              <div className="sos-card-header">
                <h2 className="sos-card-title">Review your support alert</h2>
                <span className={`sos-card-badge ${alertStatus === "submitted" ? "" : "badge-amber"}`}>
                  {alertStatus === "submitted" ? "Submitted" : "Not sent"}
                </span>
              </div>
              <p className="sos-card-desc">
                Prepare a request for UniShare support. Review what you share before confirming.
              </p>

              {/* Form: Concern */}
              <div className="sos-form-group">
                <label className="sos-label">Concern</label>
                <input
                  type="text"
                  className="sos-input"
                  value={concern}
                  onChange={(e) => setConcern(e.target.value)}
                />
              </div>

              {/* Form: Related activity */}
              <div className="sos-form-group">
                <label className="sos-label">Related activity</label>
                <input
                  type="text"
                  className="sos-input"
                  value={relatedActivity}
                  onChange={(e) => setRelatedActivity(e.target.value)}
                />
              </div>

              {/* Form: Location to share */}
              <div className="sos-form-group">
                <label className="sos-label">Location to share</label>
                <input
                  type="text"
                  className="sos-input"
                  value={locationToShare}
                  onChange={(e) => setLocationToShare(e.target.value)}
                />
                <div className="sos-help-text">
                  Manually entered · live device location is not enabled.
                </div>
              </div>

              {/* Form: Message to support */}
              <div className="sos-form-group">
                <label className="sos-label">Message to support</label>
                <textarea
                  className="sos-textarea"
                  value={messageToSupport}
                  onChange={(e) => setMessageToSupport(e.target.value)}
                />
              </div>

              {/* Checkboxes */}
              <label className="sos-checkbox-row">
                <input
                  type="checkbox"
                  checked={consentLocation}
                  onChange={(e) => setConsentLocation(e.target.checked)}
                />
                <span className="sos-checkbox-label">
                  I consent to sharing this location and related rental details with authorized UniShare support for this request.
                </span>
              </label>

              <label className="sos-checkbox-row">
                <input
                  type="checkbox"
                  checked={notifyContactsAuto}
                  onChange={(e) => setNotifyContactsAuto(e.target.checked)}
                />
                <span className="sos-checkbox-label">
                  Notify my trusted contacts automatically
                </span>
              </label>

              {/* Status Box */}
              <div className="sos-status-box">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                  <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                  <path d="M9 12l2 2 4-4" />
                </svg>
                <div>
                  <div className="sos-status-title">
                    {alertStatus === "submitted"
                      ? `Alert submitted (${supportReferenceId})`
                      : "Ready to review, not submitted"}
                  </div>
                  <div className="sos-status-desc">
                    {alertStatus === "submitted"
                      ? "UniShare support team has received your ticket. An officer is assigned to verify your campus context."
                      : "Recipient: UniShare support. No alert has been sent and no contact has been notified."}
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div style={{ display: "flex", flexDirection: "column", gap: "12px", marginTop: "18px" }}>
                <button
                  type="button"
                  className="sos-btn sos-btn-primary"
                  style={{ width: "100%", padding: "12px" }}
                  disabled={alertStatus === "submitting"}
                  onClick={handleConfirmSupport}
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                    <path d="M9 12l2 2 4-4" />
                  </svg>
                  <span>
                    {alertStatus === "submitted"
                      ? "Support request submitted"
                      : alertStatus === "submitting"
                      ? "Sending support alert..."
                      : "Confirm support request"}
                  </span>
                </button>

                <div style={{ textAlign: "center" }}>
                  <button
                    type="button"
                    onClick={() => router.push("/home")}
                    style={{ background: "none", border: "none", color: "var(--muted)", fontSize: "13.5px", cursor: "pointer" }}
                  >
                    Cancel and return home
                  </button>
                </div>
              </div>
            </div>

            {/* Card 2: You stay in control */}
            <div className="sos-card">
              <div className="sos-card-header">
                <h2 className="sos-card-title">You stay in control</h2>
              </div>
              <p className="sos-card-desc" style={{ marginBottom: 0 }}>
                Only the location you approve is included. No live tracking is started. Use a verified local emergency service for urgent danger; support response times are not guaranteed.
              </p>
            </div>
          </div>
        </div>

        {/* =========================================================
            REQUIREMENT 2: EMERGENCY ACTIVITY & INCIDENT HISTORY CARD
            ========================================================= */}
        <div className="sos-card" style={{ marginTop: "24px" }}>
          <div className="sos-card-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "8px" }}>
            <div>
              <h2 className="sos-card-title">Emergency Activity & Incident History</h2>
              <p className="sos-card-desc" style={{ marginBottom: 0 }}>
                Verified audit log of past emergency activations, calling attempts, SMS alerts and GPS breadcrumbs.
              </p>
            </div>
            <span style={{ fontSize: "12px", color: "var(--muted)", fontWeight: 700, background: "var(--field)", padding: "4px 10px", borderRadius: "999px" }}>
              {sessionHistory.length} Incident{sessionHistory.length === 1 ? "" : "s"} on Record
            </span>
          </div>

          {sessionHistory.length === 0 ? (
            <div style={{ textAlign: "center", padding: "36px 16px", color: "var(--muted)", fontSize: "13.5px" }}>
              <div style={{ fontSize: "28px", marginBottom: "8px" }}>🛡️</div>
              <strong>No past emergency incidents on record.</strong>
              <div style={{ fontSize: "12.5px", marginTop: "4px" }}>
                When you activate Emergency SOS, all calling escalation records, SMS alerts and GPS coordinates are securely archived here.
              </div>
            </div>
          ) : (
            <div className="sos-history-list">
              {sessionHistory.map((item) => {
                const isItemActive = item.status === "ACTIVE";
                const isReached = item.callingStatus === "CONTACT_REACHED";
                const callCount = item.callAttempts?.length || 0;
                const smsCount = item.smsDispatches?.length || 0;
                const locCount = item.locationUpdates?.length || 0;

                return (
                  <div key={item.id} className="sos-history-item">
                    <div className="sos-history-item-top">
                      <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
                        <span className={`sos-status-pill ${isItemActive ? (isReached ? "status-ANSWERED" : "status-UNANSWERED") : "status-CANCELLED"}`}>
                          {item.status} ({item.callingStatus || "RESOLVED"})
                        </span>
                        <strong style={{ fontSize: "14px", color: "var(--ink)" }}>
                          {item.triggerReason || "Emergency SOS Activated"}
                        </strong>
                      </div>

                      <div style={{ fontSize: "12px", color: "var(--muted)" }}>
                        {new Date(item.createdAt).toLocaleString([], { dateStyle: "medium", timeStyle: "short" })}
                      </div>
                    </div>

                    <div className="sos-history-details-row">
                      <span>📞 {callCount} Call Attempt{callCount === 1 ? "" : "s"}</span>
                      <span>💬 {smsCount} SMS Alert{smsCount === 1 ? "" : "s"}</span>
                      <span>📍 {locCount} GPS Coordinate{locCount === 1 ? "" : "s"}</span>
                      {item.resolvedAt && (
                        <span>✓ Ended at {new Date(item.resolvedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
                      )}
                    </div>

                    {item.resolvedReason && (
                      <div style={{ fontSize: "12px", color: "#475569", background: "var(--field)", padding: "6px 10px", borderRadius: "6px", marginTop: "6px" }}>
                        <strong>Resolution Note:</strong> {item.resolvedReason}
                      </div>
                    )}

                    <div style={{ display: "flex", justifyContent: "flex-end", marginTop: "8px", gap: "8px", flexWrap: "wrap" }}>
                      {isItemActive && (
                        <button
                          type="button"
                          className="sos-btn sos-btn-sm"
                          style={{ background: "#0d6b63", color: "#ffffff", fontSize: "12px", fontWeight: 700 }}
                          onClick={() => {
                            setActiveSession(item);
                            setIsCallingActive(true);
                          }}
                        >
                          View Active Session →
                        </button>
                      )}

                      <button
                        type="button"
                        className="sos-btn sos-btn-outline sos-btn-sm"
                        style={{ fontSize: "12px" }}
                        onClick={() => {
                          setSelectedHistorySession(item);
                          setShowHistoryModal(true);
                        }}
                      >
                        Inspect Full Audit Trail
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Bottom Note */}
        <div className="sos-bottom-note">
          Wallet unchanged: 500 available tokens + 100 held tokens. Safety support does not change your balance.
        </div>
      </main>

      {/* 3. Footer */}
      <footer className="sos-footer">
        <div className="wrap">
          <div>UniShare. Made for university students in Bangladesh.</div>
          <div className="sos-footer-links">
            <a href="#">Privacy</a>
            <a href="#">Terms</a>
            <a href="#">Get help</a>
            <Link href="/login">Log out</Link>
          </div>
        </div>
      </footer>

      {/* =========================================================
          EMERGENCY CONFIRMATION & 5-SECOND COUNTDOWN INTERFACE
          ========================================================= */}
      {isCountdownActive && (
        <div className="sos-escalation-overlay">
          <div className="sos-escalation-modal">
            <div className="sos-countdown-header">
              <div className="sos-countdown-badge">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                  <line x1="12" y1="9" x2="12" y2="13" />
                  <line x1="12" y1="17" x2="12.01" y2="17" />
                </svg>
                <span>Emergency Confirmation</span>
              </div>

              <div className="sos-countdown-timer-wrap">
                <div className="sos-countdown-circle">{countdownSeconds}</div>
              </div>

              <h2 className="sos-countdown-title">Activating Emergency Assistance</h2>
              <p className="sos-countdown-desc">
                In <strong>{countdownSeconds} seconds</strong>, UniShare will automatically initiate automated calling to your <strong>Priority 1</strong> emergency contact and escalate through your trusted contacts list.
              </p>
            </div>

            <div className="sos-countdown-actions">
              <button
                type="button"
                className="sos-btn-cancel-large"
                onClick={handleCancelCountdown}
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
                <span>I AM SAFE — CANCEL SOS</span>
              </button>

              <button
                type="button"
                className="sos-btn-instant-confirm"
                onClick={executeSOSConfirmation}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                  <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
                </svg>
                <span>Confirm & Activate Immediately</span>
              </button>

              <div style={{ textAlign: "center", marginTop: "6px" }}>
                <a
                  href="tel:999"
                  style={{ fontSize: "13px", color: "#e11d48", fontWeight: 700, textDecoration: "underline" }}
                >
                  Direct Call 999 (National Emergency)
                </a>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================
          ACTIVE EMERGENCY CALLING SESSION INTERFACE
          ========================================================= */}
      {isCallingActive && activeSession && (
        <div className="sos-escalation-overlay">
          <div className="sos-escalation-modal">
            <div className="sos-active-session-wrap">
              {/* Header */}
              <div className="sos-active-header">
                <div className="sos-active-title-box">
                  <div className={`sos-pulsing-dot ${activeSession.callingStatus === "CONTACT_REACHED" ? "reached" : ""}`} />
                  <div>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
                      <h3 style={{ fontSize: "17px", fontWeight: 700, margin: 0 }}>
                        Active Emergency Calling Session
                      </h3>
                      <span className={`sos-session-status-tag tag-${(activeSession.callingStatus || "initiating").toLowerCase()}`}>
                        {activeSession.callingStatus === "CONTACT_REACHED"
                          ? "CONTACT REACHED · ACTIVE"
                          : `STATUS: ${activeSession.status} (${activeSession.callingStatus || "ESCALATING"})`}
                      </span>
                    </div>
                    <small style={{ color: "var(--muted)" }}>
                      Session ID: {activeSession.id}
                    </small>
                  </div>
                </div>

                <div style={{ display: "flex", gap: "8px" }}>
                  <button
                    type="button"
                    className="sos-btn sos-btn-outline sos-btn-sm"
                    title="Minimize window while keeping emergency active"
                    onClick={() => setIsCallingActive(false)}
                  >
                    Minimize
                  </button>
                  <button
                    type="button"
                    className="sos-btn sos-btn-sm"
                    style={{ background: "#0d6b63", color: "#ffffff", fontWeight: 700 }}
                    onClick={() => handleResolveSession("Marked safe by student")}
                  >
                    End Emergency (I Am Safe)
                  </button>
                </div>
              </div>

              {/* Requirement 1, 2, 3, 4: Contact Reached Banner */}
              {activeSession.callingStatus === "CONTACT_REACHED" && (
                <div className="sos-contact-reached-banner">
                  <div className="sos-contact-reached-icon">✓</div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 700, fontSize: "15px", color: "#065f46" }}>
                      Contact Reached: Emergency Escalation Stopped
                    </div>
                    <div style={{ fontSize: "13px", color: "#047857", marginTop: "3px", lineHeight: "1.4" }}>
                      <strong>
                        {contacts.find((c) => c.id === activeSession.answeredContactId)?.name ||
                          currentlyCallingContact?.name ||
                          "Emergency Contact"}
                      </strong>{" "}
                      answered the call. Automatic call escalation has been stopped.
                    </div>
                    <div style={{ fontSize: "12px", color: "#065f46", marginTop: "6px", fontWeight: 600 }}>
                      ℹ️ Your emergency session remains <u>ACTIVE</u>. It will stay active until you click &quot;End Emergency (I Am Safe)&quot; below.
                    </div>
                  </div>
                </div>
              )}

              {/* Telephony Provider Status Banner */}
              <div className={`sos-telephony-banner ${telephonyInfo.isLive ? "" : "is-mock"}`}>
                <div style={{ fontWeight: 700, marginBottom: "2px" }}>
                  {telephonyInfo.isLive
                    ? "✓ LIVE TWILIO VOICE TELEPHONY CONNECTED"
                    : "⚠️ TELEPHONY MODE: MOCK SIMULATOR (Twilio credentials not configured in .env)"}
                </div>
                <div>{telephonyInfo.message}</div>
                {!telephonyInfo.isLive && (
                  <div style={{ marginTop: "4px", fontSize: "11.5px", opacity: 0.9 }}>
                    * Transparent simulated calling mode. Use the Manual Dialer Fallback button below to place a direct phone call.
                  </div>
                )}
              </div>

              {/* STEP 3: Live GPS Location Tracking & Secure Sharing Card */}
              <div className="sos-gps-card">
                <div className="sos-gps-header">
                  <div className="sos-gps-title">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                      <polygon points="12 2 19 21 12 17 5 21 12 2" />
                    </svg>
                    <span>Live GPS Location Sharing</span>
                  </div>

                  <span className={`sos-gps-pill status-${gpsStatus.toLowerCase()}`}>
                    {gpsStatus === "CONNECTED"
                      ? `Signal Locked (±${gpsCoords?.accuracy ? Math.round(gpsCoords.accuracy) : 10}m)`
                      : gpsStatus === "PENDING"
                        ? "Acquiring GPS Signal..."
                        : gpsStatus === "DENIED"
                          ? "GPS Permission Denied"
                          : "Signal Unavailable"}
                  </span>
                </div>

                {/* Coordinates & Status */}
                {gpsCoords ? (
                  <div style={{ fontSize: "13px", color: "var(--ink)" }}>
                    <strong>Latest Coordinates:</strong> {gpsCoords.latitude.toFixed(5)}, {gpsCoords.longitude.toFixed(5)}
                    <span style={{ color: "var(--muted)", marginLeft: "8px", fontSize: "11.5px" }}>
                      (Updated {gpsCoords.timestamp.toLocaleTimeString()})
                    </span>
                  </div>
                ) : (
                  <div style={{ fontSize: "12.5px", color: "var(--muted)" }}>
                    {gpsErrorMsg || "Requesting browser location permission to stream continuous GPS coordinates..."}
                  </div>
                )}

                {/* GPS Denied Warning & Retry Button */}
                {gpsStatus === "DENIED" && (
                  <div style={{ padding: "10px 12px", background: "#fef2f2", border: "1px solid #fecdd3", borderRadius: "8px", fontSize: "12px", color: "#991b1b" }}>
                    <div>⚠️ Browser blocked location access. Your emergency contacts will not see your live map coordinates.</div>
                    <button
                      type="button"
                      className="sos-btn sos-btn-sm"
                      style={{ marginTop: "8px", background: "#e11d48", color: "#ffffff", fontSize: "11.5px" }}
                      onClick={() => startLocationTracking(activeSession.id)}
                    >
                      Retry Location Permission
                    </button>
                  </div>
                )}

                {/* Secure Tracking Link */}
                <div className="sos-tracking-url-box">
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: "10.5px", textTransform: "uppercase", fontWeight: 700, color: "var(--muted)", marginBottom: "2px" }}>
                      Secure Live Tracking URL (Sent in SMS)
                    </div>
                    <div className="sos-tracking-url-text">
                      {trackingUrl || (activeSession.trackingToken ? `${typeof window !== "undefined" ? window.location.origin : ""}/sos/track/${activeSession.trackingToken}` : "Generating token...")}
                    </div>
                  </div>

                  <div style={{ display: "flex", gap: "6px" }}>
                    <button
                      type="button"
                      className="sos-sim-btn"
                      onClick={() => {
                        const url = trackingUrl || `${window.location.origin}/sos/track/${activeSession.trackingToken}`;
                        navigator.clipboard?.writeText(url);
                        showToast("Copied tracking link to clipboard!");
                      }}
                      title="Copy tracking link"
                    >
                      Copy Link
                    </button>
                    {activeSession.trackingToken && (
                      <a
                        href={`/sos/track/${activeSession.trackingToken}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="sos-sim-btn"
                        style={{ color: "var(--brand)", textDecoration: "none" }}
                      >
                        Preview Map ↗
                      </a>
                    )}
                  </div>
                </div>

                <div style={{ fontSize: "11px", color: "var(--muted)", lineHeight: 1.4 }}>
                  ℹ️ <strong>Foreground note:</strong> Due to browser security restrictions, continuous background GPS broadcasts work best when this browser tab remains open.
                </div>
              </div>

              {/* STEP 3: Automatic Emergency SMS Dispatch Status Card */}
              <div className="sos-sms-card">
                <div className="sos-sms-header">
                  <div className="sos-sms-title">
                    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                    </svg>
                    <span>Emergency SMS Dispatches ({smsLog.length})</span>
                  </div>

                  <button
                    type="button"
                    className="sos-sim-btn"
                    disabled={isResendingSms}
                    onClick={handleResendSms}
                  >
                    {isResendingSms ? "Sending..." : "Resend SMS Alerts"}
                  </button>
                </div>

                {smsLog.length === 0 ? (
                  <div style={{ fontSize: "12px", color: "var(--muted)", padding: "4px 0" }}>
                    Awaiting SMS dispatch confirmation...
                  </div>
                ) : (
                  <div className="sos-sms-list">
                    {smsLog.map((sms) => (
                      <div key={sms.id} className="sos-sms-item">
                        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                          <span className={`sos-status-pill status-${sms.status}`}>
                            {sms.status}
                          </span>
                          <div>
                            <strong>{sms.recipientName}</strong> ({sms.phoneNumber})
                          </div>
                        </div>
                        <div style={{ fontSize: "11px", color: "var(--muted)" }}>
                          {sms.provider === "MOCK_SIMULATOR" ? "[MOCK SMS]" : "[TWILIO SMS]"}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Active Call Card */}
              {currentlyCallingContact && (
                <div className="sos-calling-card">
                  <div className="sos-calling-card-top">
                    <span className="sos-calling-name">{currentlyCallingContact.name}</span>
                    <span className="sos-calling-priority-badge">
                      Priority #{currentlyCallingContact.priority} · Attempt {currentAttemptNumber}/2
                    </span>
                  </div>

                  <div className="sos-calling-phone">
                    {currentlyCallingContact.relationship} · {currentlyCallingContact.phoneNumber}
                  </div>

                  <div className="sos-calling-status-row">
                    {isStepProcessing && (
                      <svg className="animate-spin" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                        <circle cx="12" cy="12" r="10" strokeOpacity="0.25" />
                        <path d="M12 2a10 10 0 0 1 10 10" />
                      </svg>
                    )}
                    <span>{currentCallStatusText || "Calling..."}</span>
                  </div>

                  {/* Manual Dialer Fallback Button */}
                  <a
                    href={`tel:${encodeURIComponent(currentlyCallingContact.phoneNumber)}`}
                    className="sos-manual-fallback-btn"
                    onClick={() => showToast(`Opening device phone dialer for ${currentlyCallingContact.name}...`)}
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                      <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
                    </svg>
                    <span>Manual Dialer Fallback: Call {currentlyCallingContact.phoneNumber}</span>
                  </a>

                  {/* Simulation Controls for testing / evaluation in mock mode */}
                  {!telephonyInfo.isLive && (
                    <div className="sos-simulation-controls">
                      <strong>Mock Simulation Controls:</strong>
                      {activeSession.callingStatus === "CONTACT_REACHED" ? (
                        <div style={{ marginTop: "6px", color: "#166534", fontWeight: 600, fontSize: "12px" }}>
                          ✓ Call answered. Automatic escalation is stopped. Session remains ACTIVE until you click &quot;End Emergency (I Am Safe)&quot;.
                        </div>
                      ) : (
                        <div className="sos-simulation-btns">
                          <button
                            type="button"
                            className="sos-sim-btn"
                            disabled={isStepProcessing}
                            onClick={() =>
                              startCallStep(
                                activeSession.id,
                                currentlyCallingContact,
                                currentAttemptNumber,
                                contacts,
                                "UNANSWERED"
                              )
                            }
                          >
                            Simulate No Answer / Retry
                          </button>

                          <button
                            type="button"
                            className="sos-sim-btn sim-answer"
                            disabled={isStepProcessing}
                            onClick={() =>
                              startCallStep(
                                activeSession.id,
                                currentlyCallingContact,
                                currentAttemptNumber,
                                contacts,
                                "ANSWERED"
                              )
                            }
                          >
                            Simulate Contact Answers (Stop Escalation)
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Resolution Note if answered or exhausted */}
              {escalationResolutionNote && (
                <div style={{ padding: "12px", background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: "8px", fontSize: "13px", color: "#166534", fontWeight: 600 }}>
                  {escalationResolutionNote}
                </div>
              )}

              {/* Call Attempts Timeline / Database Log */}
              <div className="sos-timeline-box">
                <div className="sos-timeline-title">
                  <span>Call History & Escalation Log ({callLog.length} recorded)</span>
                  <small style={{ color: "var(--muted)", fontWeight: 400 }}>Saved to Database</small>
                </div>

                {callLog.length === 0 ? (
                  <div style={{ fontSize: "12px", color: "var(--muted)", textAlign: "center", padding: "8px 0" }}>
                    Starting initial attempt...
                  </div>
                ) : (
                  <div className="sos-timeline-list">
                    {callLog.map((attempt) => (
                      <div key={attempt.id} className="sos-timeline-item">
                        <div className="sos-timeline-item-left">
                          <span className={`sos-status-pill status-${attempt.status}`}>
                            {attempt.status}
                          </span>
                          <div>
                            <strong>{attempt.contactName}</strong> (Priority #{attempt.priority}) · Attempt {attempt.attemptNumber}/2
                          </div>
                        </div>
                        <div style={{ fontSize: "11px", color: "var(--muted)" }}>
                          {attempt.provider === "MOCK_SIMULATOR" ? "[MOCK]" : "[TWILIO]"} {new Date(attempt.createdAt).toLocaleTimeString()}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Prominent End Emergency Button (Student Manual Termination) */}
              <button
                type="button"
                className="sos-btn"
                style={{
                  background: "#0d6b63",
                  color: "#ffffff",
                  fontWeight: 700,
                  padding: "13px 20px",
                  fontSize: "14px",
                  borderRadius: "6px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "8px",
                  border: "none",
                  cursor: "pointer",
                  boxShadow: "0 2px 8px rgba(13, 107, 99, 0.28)",
                  marginTop: "8px",
                }}
                onClick={() => handleResolveSession("Emergency resolved and ended by student (safe)")}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path d="M20 6L9 17l-5-5" />
                </svg>
                <span>End Emergency (I Am Safe)</span>
              </button>

              {/* Bottom Emergency Fast-Dial Options */}
              <div style={{ display: "flex", gap: "10px", marginTop: "4px" }}>
                <a
                  href="tel:999"
                  className="sos-btn"
                  style={{ flex: 1, background: "#e11d48", color: "#ffffff", border: "none", fontSize: "13px" }}
                >
                  Dial 999 (National Police)
                </a>
                <a
                  href="tel:01711374747"
                  className="sos-btn"
                  style={{ flex: 1, background: "var(--brand)", color: "#ffffff", border: "none", fontSize: "13px" }}
                >
                  Call DU Proctor (Campus Security)
                </a>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ================= MODALS ================= */}

      {/* Guidance Modal */}
      {showGuidanceModal && (
        <div className="sos-modal-overlay" onClick={() => setShowGuidanceModal(false)}>
          <div className="sos-modal" onClick={(e) => e.stopPropagation()}>
            <div className="sos-modal-header">
              <h3 className="sos-modal-title">Official Campus Emergency Contacts</h3>
              <button
                type="button"
                className="sos-modal-close"
                onClick={() => setShowGuidanceModal(false)}
              >
                ✕
              </button>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "14px", fontSize: "13.5px" }}>
              <div style={{ padding: "12px", background: "var(--field)", borderRadius: "8px" }}>
                <b>National Emergency Hotline (Bangladesh)</b>
                <div style={{ fontSize: "16px", fontWeight: "700", color: "var(--brand)", marginTop: "4px" }}>
                  Dial 999
                </div>
                <div style={{ fontSize: "12px", color: "var(--muted)", marginTop: "2px" }}>
                  Toll-free 24/7 Police, Ambulance, Fire Service
                </div>
              </div>

              <div style={{ padding: "12px", background: "var(--field)", borderRadius: "8px" }}>
                <b>University of Dhaka Proctorial Team</b>
                <div style={{ fontSize: "16px", fontWeight: "700", color: "var(--brand)", marginTop: "4px" }}>
                  01711-374747
                </div>
                <div style={{ fontSize: "12px", color: "var(--muted)", marginTop: "2px" }}>
                  DU Proctor Office Control Room (Campus Security)
                </div>
              </div>

              <div style={{ padding: "12px", background: "var(--field)", borderRadius: "8px" }}>
                <b>Dhaka Medical College Hospital (DMCH) Emergency</b>
                <div style={{ fontSize: "16px", fontWeight: "700", color: "var(--brand)", marginTop: "4px" }}>
                  02-55165088
                </div>
                <div style={{ fontSize: "12px", color: "var(--muted)", marginTop: "2px" }}>
                  Adjacent to University of Dhaka campus
                </div>
              </div>

              <button
                type="button"
                className="sos-btn sos-btn-primary"
                onClick={() => {
                  setEmergencyNumber("01711-374747");
                  setShowGuidanceModal(false);
                  showToast("Selected DU Proctorial Control Room number.");
                }}
              >
                Use DU Proctor Office Number
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add / Edit Contact Modal */}
      {showAddForm && (
        <div className="sos-modal-overlay" onClick={() => setShowAddForm(false)}>
          <div className="sos-modal" onClick={(e) => e.stopPropagation()}>
            <div className="sos-modal-header">
              <h3 className="sos-modal-title">
                {editingContact ? "Edit Emergency Contact" : "Add Emergency Contact"}
              </h3>
              <button
                type="button"
                className="sos-modal-close"
                onClick={() => setShowAddForm(false)}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveContact}>
              {formError && (
                <div style={{ color: "var(--danger)", fontSize: "13px", marginBottom: "12px", padding: "8px", background: "var(--danger-bg)", borderRadius: "6px" }}>
                  {formError}
                </div>
              )}

              <div className="sos-form-group">
                <label className="sos-label">Full Name *</label>
                <input
                  type="text"
                  className="sos-input"
                  placeholder="e.g. Farida Rahman or Nafis Ahmed"
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
                  placeholder="e.g. +880 1711-234567"
                  value={formPhone}
                  onChange={(e) => setFormPhone(e.target.value)}
                  required
                />
                <div className="sos-help-text">
                  Enter mobile number with country or operator code.
                </div>
              </div>

              <div className="sos-form-group">
                <label className="sos-label">Relationship *</label>
                <select
                  className="sos-select"
                  value={formRelationship}
                  onChange={(e) => setFormRelationship(e.target.value)}
                >
                  <option value="Family contact">Family contact</option>
                  <option value="Parent / Mother">Parent / Mother</option>
                  <option value="Parent / Father">Parent / Father</option>
                  <option value="Sibling">Sibling</option>
                  <option value="Campus friend">Campus friend</option>
                  <option value="Roommate">Roommate</option>
                  <option value="Guardian">Guardian</option>
                  <option value="Department Senior">Department Senior</option>
                  <option value="Other">Other</option>
                </select>
              </div>

              <div className="sos-form-group">
                <label className="sos-label">Priority Order (1 to 5) *</label>
                <select
                  className="sos-select"
                  value={formPriority}
                  onChange={(e) => setFormPriority(Number(e.target.value))}
                >
                  <option value={1}>1 - Primary Emergency Contact</option>
                  <option value={2}>2 - Second Priority</option>
                  <option value={3}>3 - Third Priority</option>
                  <option value={4}>4 - Fourth Priority</option>
                  <option value={5}>5 - Fifth Priority</option>
                </select>
                <div className="sos-help-text">
                  Priority 1 will be contacted first in emergency situations.
                </div>
              </div>

              <div className="sos-btn-row" style={{ marginTop: "24px" }}>
                <button
                  type="submit"
                  className="sos-btn sos-btn-primary"
                  style={{ flex: 1 }}
                  disabled={isSubmitting}
                >
                  {isSubmitting ? "Saving to Database..." : editingContact ? "Update Contact" : "Save Contact"}
                </button>
                <button
                  type="button"
                  className="sos-btn sos-btn-outline"
                  onClick={() => setShowAddForm(false)}
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Manage Contacts Detailed Modal */}
      {showManageModal && (
        <div className="sos-modal-overlay" onClick={() => setShowManageModal(false)}>
          <div className="sos-modal" onClick={(e) => e.stopPropagation()}>
            <div className="sos-modal-header">
              <h3 className="sos-modal-title">
                Manage Trusted Contacts ({contacts.length}/5)
              </h3>
              <button
                type="button"
                className="sos-modal-close"
                onClick={() => setShowManageModal(false)}
              >
                ✕
              </button>
            </div>

            <p style={{ fontSize: "13px", color: "var(--muted)", marginBottom: "16px" }}>
              Only you have access to your saved emergency contacts. You can reorder their priority from 1 to 5, edit contact info, or add up to 5 people.
            </p>

            <div style={{ display: "flex", flexDirection: "column", gap: "10px", marginBottom: "20px" }}>
              {contacts.map((c, idx) => (
                <div
                  key={c.id}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "10px 12px",
                    background: "var(--field)",
                    borderRadius: "8px",
                    border: "1px solid var(--border-subtle)",
                  }}
                >
                  <div>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                      <span className="sos-contact-priority-tag">#{c.priority}</span>
                      <strong style={{ fontSize: "14px" }}>{c.name}</strong>
                    </div>
                    <div style={{ fontSize: "12px", color: "var(--muted)", marginTop: "2px" }}>
                      {c.relationship} · {c.phoneNumber}
                    </div>
                  </div>

                  <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                    <button
                      type="button"
                      className="sos-icon-btn"
                      disabled={idx === 0}
                      onClick={() => handleMovePriority(idx, "up")}
                      title="Move up"
                    >
                      ▲
                    </button>
                    <button
                      type="button"
                      className="sos-icon-btn"
                      disabled={idx === contacts.length - 1}
                      onClick={() => handleMovePriority(idx, "down")}
                      title="Move down"
                    >
                      ▼
                    </button>
                    <button
                      type="button"
                      className="sos-icon-btn"
                      onClick={() => {
                        setShowManageModal(false);
                        handleOpenEdit(c);
                      }}
                      title="Edit"
                    >
                      ✎
                    </button>
                    <button
                      type="button"
                      className="sos-icon-btn btn-danger"
                      onClick={() => handleDeleteContact(c.id, c.name)}
                      title="Delete"
                    >
                      ✕
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <div style={{ display: "flex", gap: "10px" }}>
              <button
                type="button"
                className="sos-btn sos-btn-primary"
                style={{ flex: 1 }}
                disabled={contacts.length >= 5}
                onClick={() => {
                  setShowManageModal(false);
                  handleOpenAdd();
                }}
              >
                + Add New Contact
              </button>
              <button
                type="button"
                className="sos-btn sos-btn-outline"
                onClick={() => setShowManageModal(false)}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Incident Audit Details Modal */}
      {showHistoryModal && selectedHistorySession && (
        <div className="sos-modal-overlay" onClick={() => setShowHistoryModal(false)}>
          <div className="sos-modal" style={{ maxWidth: "620px" }} onClick={(e) => e.stopPropagation()}>
            <div className="sos-modal-header">
              <div>
                <h3 className="sos-modal-title">Emergency Incident Audit Trail</h3>
                <small style={{ color: "var(--muted)" }}>Session ID: {selectedHistorySession.id}</small>
              </div>
              <button
                type="button"
                className="sos-modal-close"
                onClick={() => setShowHistoryModal(false)}
              >
                ✕
              </button>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "16px", maxHeight: "70vh", overflowY: "auto", paddingRight: "4px" }}>
              {/* Summary Band */}
              <div style={{ padding: "12px", background: "var(--field)", borderRadius: "8px", fontSize: "13px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "4px" }}>
                  <strong>Trigger Reason:</strong>
                  <span>{selectedHistorySession.triggerReason || "SOS Emergency"}</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "4px" }}>
                  <strong>Created At:</strong>
                  <span>{new Date(selectedHistorySession.createdAt).toLocaleString()}</span>
                </div>
                {selectedHistorySession.resolvedAt && (
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "4px" }}>
                    <strong>Resolved At:</strong>
                    <span>{new Date(selectedHistorySession.resolvedAt).toLocaleString()}</span>
                  </div>
                )}
                {selectedHistorySession.resolvedReason && (
                  <div style={{ marginTop: "6px", color: "var(--brand-dark)" }}>
                    <strong>Outcome:</strong> {selectedHistorySession.resolvedReason}
                  </div>
                )}
              </div>

              {/* Call Attempts History */}
              <div>
                <h4 style={{ fontSize: "14px", fontWeight: 700, margin: "0 0 8px", color: "var(--ink)" }}>
                  Voice Call Attempts ({selectedHistorySession.callAttempts?.length || 0})
                </h4>
                {(!selectedHistorySession.callAttempts || selectedHistorySession.callAttempts.length === 0) ? (
                  <div style={{ fontSize: "12px", color: "var(--muted)" }}>No calls logged for this incident.</div>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                    {selectedHistorySession.callAttempts.map((attempt) => (
                      <div key={attempt.id} className="sos-timeline-item">
                        <div className="sos-timeline-item-left">
                          <span className={`sos-status-pill status-${attempt.status}`}>
                            {attempt.status}
                          </span>
                          <div>
                            <strong>{attempt.contactName}</strong> (Priority #{attempt.priority}) · Attempt {attempt.attemptNumber}/2
                          </div>
                        </div>
                        <div style={{ fontSize: "11px", color: "var(--muted)" }}>
                          {attempt.provider === "MOCK_SIMULATOR" ? "[MOCK]" : "[TWILIO]"} {new Date(attempt.createdAt).toLocaleTimeString()}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* SMS Dispatches History */}
              <div>
                <h4 style={{ fontSize: "14px", fontWeight: 700, margin: "0 0 8px", color: "var(--ink)" }}>
                  Emergency SMS Dispatches ({selectedHistorySession.smsDispatches?.length || 0})
                </h4>
                {(!selectedHistorySession.smsDispatches || selectedHistorySession.smsDispatches.length === 0) ? (
                  <div style={{ fontSize: "12px", color: "var(--muted)" }}>No SMS recorded for this incident.</div>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                    {selectedHistorySession.smsDispatches.map((sms) => (
                      <div key={sms.id} className="sos-sms-item">
                        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                          <span className={`sos-status-pill status-${sms.status}`}>
                            {sms.status}
                          </span>
                          <div>
                            <strong>{sms.recipientName}</strong> ({sms.phoneNumber})
                          </div>
                        </div>
                        <div style={{ fontSize: "11px", color: "var(--muted)" }}>
                          {sms.provider === "MOCK_SIMULATOR" ? "[MOCK SMS]" : "[TWILIO SMS]"}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* GPS Coordinates logged */}
              {selectedHistorySession.latestLatitude && (
                <div style={{ padding: "10px 12px", background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: "8px", fontSize: "12.5px", color: "#166534" }}>
                  📍 <strong>Latest GPS Location:</strong> {selectedHistorySession.latestLatitude.toFixed(5)}, {selectedHistorySession.latestLongitude?.toFixed(5)}
                  {selectedHistorySession.latestAccuracy && <span> (±{Math.round(selectedHistorySession.latestAccuracy)}m)</span>}
                </div>
              )}
            </div>

            <div style={{ marginTop: "16px", display: "flex", justifyContent: "flex-end" }}>
              <button
                type="button"
                className="sos-btn sos-btn-outline"
                onClick={() => setShowHistoryModal(false)}
              >
                Close Audit View
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Floating Toast Notification */}
      {toastVisible && (
        <div className="sos-toast">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4">
            <path d="M20 6L9 17l-5-5" />
          </svg>
          <span>{toastMessage}</span>
        </div>
      )}
    </div>
  );
}
