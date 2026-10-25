// Telephony Provider Interface for UniShare Emergency Assistance
// Supports Twilio live voice telephony with asynchronous status callbacks, polling verification,
// call cancellation, and transparent Mock Calling Mode with manual dialer fallback.

import crypto from "crypto";

export interface TelephonyCallResult {
  provider: "TWILIO" | "MOCK_SIMULATOR";
  isLive: boolean;
  status: "INITIATED" | "RINGING" | "ANSWERED" | "UNANSWERED" | "BUSY" | "FAILED" | "CANCELLED";
  telephonySid: string;
  durationSeconds: number;
  errorMessage?: string;
  notes?: string;
}

// Telephony Credentials Helper
export function getTelephonyCredentials() {
  const accountSid = process.env.TWILIO_ACCOUNT_SID || "";
  const authToken = process.env.TWILIO_AUTH_TOKEN || "";
  const fromNumber = process.env.TWILIO_PHONE_NUMBER || "";
  return { accountSid, authToken, fromNumber };
}

export function getTelephonyProviderInfo() {
  const { accountSid, authToken, fromNumber } = getTelephonyCredentials();

  const hasCredentials = Boolean(
    accountSid &&
    authToken &&
    fromNumber &&
    !accountSid.includes("your_") &&
    accountSid.startsWith("AC")
  );

  return {
    provider: hasCredentials ? ("TWILIO" as const) : ("MOCK_SIMULATOR" as const),
    isLive: hasCredentials,
    fromNumber: hasCredentials ? fromNumber : "Simulated Campus Gateway",
    accountSid: hasCredentials ? `${accountSid?.slice(0, 6)}...` : undefined,
    message: hasCredentials
      ? "Twilio Voice Telephony active. Webhook & asynchronous status polling enabled."
      : "Mock Telephony Mode active (TWILIO_ACCOUNT_SID / TWILIO_AUTH_TOKEN not configured). Manual dialer fallback available.",
  };
}

// Maps raw Twilio status string to our internal state machine
// IMPORTANT: "queued" and "initiated" mean the API accepted the call, NOT that someone answered!
export function mapTwilioCallStatus(rawStatus: string): TelephonyCallResult["status"] {
  const s = (rawStatus || "").toLowerCase();
  switch (s) {
    case "in-progress":
      // Contact picked up and call is live
      return "ANSWERED";
    case "completed":
      // Call finished after being answered
      return "ANSWERED";
    case "ringing":
      return "RINGING";
    case "queued":
    case "initiated":
      return "INITIATED";
    case "busy":
      return "BUSY";
    case "no-answer":
      return "UNANSWERED";
    case "canceled":
      return "CANCELLED";
    case "failed":
    default:
      return "FAILED";
  }
}

// Verifies Twilio cryptographic webhook signature (HMAC-SHA1)
export function validateTwilioWebhookSignature(params: {
  url: string;
  signature: string | null;
  formData: Record<string, string>;
}): boolean {
  const { authToken } = getTelephonyCredentials();

  // In development, mock mode, or when Twilio credentials are not configured, allow simulated requests
  if (
    !authToken ||
    authToken.includes("your_") ||
    authToken === "mock" ||
    process.env.SKIP_TWILIO_SIGNATURE_VALIDATION === "true"
  ) {
    return true;
  }

  if (!params.signature) {
    return false;
  }

  try {
    const sortedKeys = Object.keys(params.formData).sort();
    let data = params.url;
    for (const key of sortedKeys) {
      data += key + params.formData[key];
    }

    const expectedSignature = crypto
      .createHmac("sha1", authToken)
      .update(Buffer.from(data, "utf-8"))
      .digest("base64");

    const sigBuf = Buffer.from(params.signature);
    const expectedBuf = Buffer.from(expectedSignature);

    if (sigBuf.length !== expectedBuf.length) {
      return false;
    }

    return crypto.timingSafeEqual(sigBuf, expectedBuf);
  } catch (err) {
    console.error("Error validating Twilio signature:", err);
    return false;
  }
}

// Normalizes phone numbers to standard international E.164 (+880...)
export function normalizeToE164(phone: string): string {
  if (!phone) return "";
  const cleaned = phone.trim().replace(/[\s\-\(\)]/g, "");
  if (cleaned.startsWith("+")) return cleaned;
  if (cleaned.startsWith("880")) return "+" + cleaned;
  if (cleaned.startsWith("0")) return "+88" + cleaned;
  return "+" + cleaned;
}

// Places an emergency call
export async function placeEmergencyCall(params: {
  toPhoneNumber: string;
  contactName: string;
  studentName: string;
  priority: number;
  attemptNumber: number;
  callbackBaseUrl?: string;
  simulatedOutcome?: "ANSWERED" | "UNANSWERED" | "BUSY" | "FAILED";
}): Promise<TelephonyCallResult> {
  const info = getTelephonyProviderInfo();

  // 1. Live Twilio Voice Calling (unless a simulated test outcome is explicitly requested)
  if (info.isLive && !params.simulatedOutcome) {
    try {
      const { accountSid, authToken, fromNumber } = getTelephonyCredentials();
      const normalizedTo = normalizeToE164(params.toPhoneNumber);

      const appUrl = (process.env.NEXT_PUBLIC_APP_URL || params.callbackBaseUrl || "https://unishare.online").replace(/\/$/, "");
      const voiceUrl = appUrl.startsWith("http")
        ? `${appUrl}/api/sos/webhook/twilio?student=${encodeURIComponent(params.studentName)}&priority=${params.priority}`
        : "http://demo.twilio.com/docs/voice.xml";

      const formData = new URLSearchParams();
      formData.append("To", normalizedTo);
      formData.append("From", fromNumber);
      formData.append("Url", voiceUrl);

      const response = await fetch(
        `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Calls.json`,
        {
          method: "POST",
          headers: {
            Authorization: `Basic ${Buffer.from(`${accountSid}:${authToken}`).toString("base64")}`,
            "Content-Type": "application/x-www-form-urlencoded",
          },
          body: formData.toString(),
        }
      );

      const data = await response.json();

      if (response.ok) {
        // IMPORTANT FIX: Do NOT assume answered! Initial Twilio status is "queued" or "initiated".
        const initialStatus = mapTwilioCallStatus(data.status);

        return {
          provider: "TWILIO",
          isLive: true,
          status: initialStatus,
          telephonySid: data.sid,
          durationSeconds: 0,
          notes: `Twilio call initiated. Initial status: ${data.status}. Awaiting asynchronous pickup or callback.`,
        };
      } else {
        return {
          provider: "TWILIO",
          isLive: true,
          status: "FAILED",
          telephonySid: `TWILIO-FAIL-${Date.now()}`,
          durationSeconds: 0,
          errorMessage: data.message || `Twilio error ${data.code || response.status}`,
        };
      }
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : "Network error contacting Twilio";
      return {
        provider: "TWILIO",
        isLive: true,
        status: "FAILED",
        telephonySid: `TWILIO-ERR-${Date.now()}`,
        durationSeconds: 0,
        errorMessage: errorMsg,
      };
    }
  }

  // 2. Clearly Labelled Mock Calling Mode (Credentials unavailable)
  // Transparently records that this is a simulated call attempt and never fakes successful real network calls
  const mockSid = `MOCK-CALL-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

  let finalStatus: TelephonyCallResult["status"] = "UNANSWERED";

  if (params.simulatedOutcome) {
    const normalized = String(params.simulatedOutcome).toUpperCase();
    if (["ANSWERED", "UNANSWERED", "BUSY", "FAILED"].includes(normalized)) {
      finalStatus = normalized as TelephonyCallResult["status"];
    } else {
      finalStatus = "UNANSWERED";
    }
  } else {
    // Default mock behavior for realistic escalation testing:
    // If not specified, unreached by default to trigger proper escalation
    finalStatus = "UNANSWERED";
  }

  return {
    provider: "MOCK_SIMULATOR",
    isLive: false,
    status: finalStatus,
    telephonySid: mockSid,
    durationSeconds: finalStatus === "ANSWERED" ? 18 : 25,
    notes: `[MOCK ENGINE] Attempt ${params.attemptNumber} for ${params.contactName} (${params.toPhoneNumber}). Status: ${finalStatus}. Twilio credentials not set in environment. Use manual dialer fallback button to place direct phone call.`,
    errorMessage:
      finalStatus === "FAILED"
        ? "Simulated call failure (Mock mode)"
        : finalStatus === "UNANSWERED"
          ? "No answer / Ring timeout after 25s (Simulated)"
          : undefined,
  };
}

// Queries real-time Twilio call status by CallSid
export async function checkTwilioCallStatus(callSid: string): Promise<{
  status: TelephonyCallResult["status"];
  durationSeconds: number;
  rawStatus: string;
} | null> {
  const { accountSid, authToken } = getTelephonyCredentials();

  if (!accountSid || !authToken || !callSid.startsWith("CA")) {
    return null;
  }

  try {
    const res = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Calls/${callSid}.json`,
      {
        headers: {
          Authorization: `Basic ${Buffer.from(`${accountSid}:${authToken}`).toString("base64")}`,
        },
      }
    );

    if (!res.ok) return null;
    const data = await res.json();
    return {
      status: mapTwilioCallStatus(data.status),
      durationSeconds: Number(data.duration || 0),
      rawStatus: data.status,
    };
  } catch (err) {
    console.error("Error polling Twilio call status:", err);
    return null;
  }
}

// Cancels / terminates an in-progress Twilio call
export async function cancelTwilioCall(callSid: string): Promise<boolean> {
  const { accountSid, authToken } = getTelephonyCredentials();

  if (!accountSid || !authToken || !callSid || !callSid.startsWith("CA")) {
    return false;
  }

  try {
    const formData = new URLSearchParams();
    formData.append("Status", "completed");

    const res = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Calls/${callSid}.json`,
      {
        method: "POST",
        headers: {
          Authorization: `Basic ${Buffer.from(`${accountSid}:${authToken}`).toString("base64")}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: formData.toString(),
      }
    );

    return res.ok;
  } catch (err) {
    console.error("Error cancelling Twilio call:", err);
    return false;
  }
}

// ============================================================================
// STEP 3: AUTOMATIC EMERGENCY SMS & SECURE TRACKING DISPATCH
// ============================================================================

export interface SmsDispatchResult {
  provider: "TWILIO" | "MOCK_SIMULATOR";
  isLive: boolean;
  status: "SENT" | "QUEUED" | "DELIVERED" | "FAILED" | "MOCK_SENT";
  telephonySid: string;
  messageBody: string;
  errorMessage?: string;
  notes?: string;
}

// Generates an unguessable, high-entropy 48-hex-character tracking token
export function generateSecureTrackingToken(): string {
  try {
    return crypto.randomBytes(24).toString("hex");
  } catch {
    return `${Date.now().toString(36)}${Math.random().toString(36).slice(2)}${Math.random().toString(36).slice(2)}`;
  }
}

// Maps raw Twilio message status to internal status
export function mapTwilioSmsStatus(rawStatus: string): SmsDispatchResult["status"] {
  const s = (rawStatus || "").toLowerCase();
  switch (s) {
    case "delivered":
      return "DELIVERED";
    case "sent":
      return "SENT";
    case "queued":
    case "accepted":
    case "sending":
      return "QUEUED";
    case "undelivered":
    case "failed":
    default:
      return "FAILED";
  }
}

// Dispatches Emergency SMS with student name, alert message, activation time & secure tracking URL
export async function sendEmergencySms(params: {
  toPhoneNumber: string;
  recipientName: string;
  studentName: string;
  trackingUrl: string;
  activatedAt?: Date | string;
  callbackBaseUrl?: string;
  simulatedOutcome?: "SENT" | "FAILED";
}): Promise<SmsDispatchResult> {
  const info = getTelephonyProviderInfo();
  const timeStr = params.activatedAt
    ? new Date(params.activatedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
    : new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

  const messageBody = `URGENT SOS: UniShare student ${params.studentName} is in danger and has activated an emergency SOS alert at ${timeStr}. We have sent their live GPS location. Track live here: ${params.trackingUrl} . If in immediate danger, contact campus security (01711-374747) or dial 999.`;

  // 1. Live Twilio SMS Sending
  if (info.isLive) {
    try {
      const { accountSid, authToken, fromNumber } = getTelephonyCredentials();
      const normalizedTo = normalizeToE164(params.toPhoneNumber);

      const formData = new URLSearchParams();
      formData.append("To", normalizedTo);
      formData.append("From", fromNumber);
      formData.append("Body", messageBody);

      const response = await fetch(
        `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`,
        {
          method: "POST",
          headers: {
            Authorization: `Basic ${Buffer.from(`${accountSid}:${authToken}`).toString("base64")}`,
            "Content-Type": "application/x-www-form-urlencoded",
          },
          body: formData.toString(),
        }
      );

      const data = await response.json();

      if (response.ok) {
        return {
          provider: "TWILIO",
          isLive: true,
          status: data.status === "delivered" ? "DELIVERED" : data.status === "sent" ? "SENT" : "QUEUED",
          telephonySid: data.sid,
          messageBody,
          notes: `Twilio SMS queued for delivery to ${params.recipientName} (${params.toPhoneNumber}). Initial status: ${data.status}.`,
        };
      } else {
        return {
          provider: "TWILIO",
          isLive: true,
          status: "FAILED",
          telephonySid: `TWILIO-SMS-FAIL-${Date.now()}`,
          messageBody,
          errorMessage: data.message || `Twilio SMS error code ${data.code || response.status}`,
        };
      }
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : "Network error contacting Twilio SMS gateway";
      return {
        provider: "TWILIO",
        isLive: true,
        status: "FAILED",
        telephonySid: `TWILIO-SMS-ERR-${Date.now()}`,
        messageBody,
        errorMessage: errorMsg,
      };
    }
  }

  // 2. Transparent Mock Mode (When Twilio credentials unavailable)
  const mockSid = `MOCK-SMS-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
  const isSimFail = params.simulatedOutcome === "FAILED";

  return {
    provider: "MOCK_SIMULATOR",
    isLive: false,
    status: isSimFail ? "FAILED" : "MOCK_SENT",
    telephonySid: mockSid,
    messageBody,
    notes: isSimFail
      ? `Simulated SMS delivery failure for ${params.recipientName}.`
      : `[MOCK SMS] Emergency SMS with live tracking URL dispatched to ${params.recipientName} (${params.toPhoneNumber}). Twilio credentials not configured in environment.`,
    errorMessage: isSimFail ? "Simulated SMS provider error" : undefined,
  };
}
