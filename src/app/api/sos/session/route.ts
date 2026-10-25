import { NextRequest, NextResponse } from "next/server";
import { db } from "@/app/lib/db";
import {
  placeEmergencyCall,
  getTelephonyProviderInfo,
  cancelTwilioCall,
  checkTwilioCallStatus,
  sendEmergencySms,
  generateSecureTrackingToken,
} from "@/app/lib/telephony";

// Helper to resolve authenticated student
async function getAuthenticatedUser(req: NextRequest, bodyEmail?: string) {
  let email = req.headers.get("x-user-email");

  if (!email && bodyEmail) {
    email = bodyEmail;
  }

  if (!email) {
    const userCookie = req.cookies.get("unishare_user")?.value;
    if (userCookie) {
      try {
        const parsed = JSON.parse(decodeURIComponent(userCookie));
        if (parsed.email) email = parsed.email;
      } catch {
        // ignore parse error
      }
    }
  }

  if (!email) {
    const url = new URL(req.url);
    const queryEmail = url.searchParams.get("email");
    if (queryEmail) email = queryEmail;
  }

  if (!email) {
    email = "farhana@std.du.ac.bd";
  }

  email = email.trim().toLowerCase();

  try {
    let user = await db.user.findUnique({
      where: { email },
    });

    if (!user) {
      user = await db.user.create({
        data: {
          email,
          fullName: email.includes("farhana") ? "Farhana Rahman" : "Campus Student",
          studentId: "DU-2023-8841",
          passwordHash: "student_verified_auth",
          verified: true,
          tokenBalance: 420,
        },
      });
    }

    return user;
  } catch (err) {
    console.warn("Session user lookup fallback:", err);
    return {
      id: "u-" + Buffer.from(email).toString("hex").slice(0, 16),
      email,
      fullName: email.includes("farhana") ? "Farhana Rahman" : "Campus Student",
      studentId: "DU-2023-8841",
      passwordHash: "student_verified_auth",
      verified: true,
      tokenBalance: 420,
      createdAt: new Date(),
    };
  }
}

// GET: Retrieve latest active session & telephony status
export async function GET(req: NextRequest) {
  try {
    const user = await getAuthenticatedUser(req);
    const telephony = getTelephonyProviderInfo();

    const latestSession = await db.emergencySession.findFirst({
      where: { userId: user.id },
      include: {
        callAttempts: {
          orderBy: { createdAt: "asc" },
        },
        smsDispatches: {
          orderBy: { createdAt: "asc" },
        },
        locationUpdates: {
          orderBy: { timestamp: "desc" },
          take: 15,
        },
      },
      orderBy: { createdAt: "desc" },
    });

    const activeSession = latestSession?.status === "ACTIVE" ? latestSession : null;

    // Requirement 2: Retrieve Emergency Activity & Incident History for this user
    const sessionHistory = await db.emergencySession.findMany({
      where: { userId: user.id },
      include: {
        callAttempts: {
          orderBy: { createdAt: "asc" },
        },
        smsDispatches: {
          orderBy: { createdAt: "asc" },
        },
        locationUpdates: {
          orderBy: { timestamp: "desc" },
          take: 5,
        },
      },
      orderBy: { createdAt: "desc" },
      take: 10,
    });

    const origin = req.headers.get("origin") || req.nextUrl.origin || "http://localhost:3000";
    const trackingUrl = activeSession?.trackingToken
      ? `${origin}/sos/track/${activeSession.trackingToken}`
      : latestSession?.trackingToken
        ? `${origin}/sos/track/${latestSession.trackingToken}`
        : undefined;

    const contacts = await db.emergencyContact.findMany({
      where: { userId: user.id },
      orderBy: { priority: "asc" },
    });

    return NextResponse.json({
      success: true,
      telephony,
      activeSession,
      latestSession,
      sessionHistory,
      trackingUrl,
      contacts,
    });
  } catch (error) {
    console.error("Failed to fetch emergency session:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error fetching emergency session" },
      { status: 500 }
    );
  }
}

// POST: Manage Emergency Session Lifecycle & Calling Steps
export async function POST(req: NextRequest) {
  try {
    const user = await getAuthenticatedUser(req);
    const body = await req.json();
    const action = body.action || "START";

    const telephony = getTelephonyProviderInfo();

    // 1. START SESSION: Create active emergency session with tracking token & automatic SMS
    if (action === "START") {
      let contacts = await db.emergencyContact.findMany({
        where: { userId: user.id },
        orderBy: { priority: "asc" },
      });

      // Default contacts seeding if empty
      if (contacts.length === 0 && user.email === "farhana@std.du.ac.bd") {
        await db.emergencyContact.createMany({
          data: [
            {
              userId: user.id,
              name: "Farida Rahman (Mother)",
              phoneNumber: "+880 1711-234567",
              relationship: "Family contact",
              priority: 1,
            },
            {
              userId: user.id,
              name: "Tanvir Ahmed (Roommate)",
              phoneNumber: "+880 1819-876543",
              relationship: "Campus friend",
              priority: 2,
            },
          ],
        });

        contacts = await db.emergencyContact.findMany({
          where: { userId: user.id },
          orderBy: { priority: "asc" },
        });
      }

      // Requirement 9: Prevent duplicate SOS requests if an emergency session is already ACTIVE
      const existingActiveSession = await db.emergencySession.findFirst({
        where: { userId: user.id, status: "ACTIVE" },
        include: {
          callAttempts: { orderBy: { createdAt: "asc" } },
          smsDispatches: { orderBy: { createdAt: "asc" } },
          locationUpdates: { orderBy: { timestamp: "desc" }, take: 10 },
        },
      });

      if (existingActiveSession) {
        const origin = req.headers.get("origin") || req.nextUrl.origin || "http://localhost:3000";
        const trackingUrl = existingActiveSession.trackingToken
          ? `${origin}/sos/track/${existingActiveSession.trackingToken}`
          : undefined;

        return NextResponse.json({
          success: true,
          session: existingActiveSession,
          contacts,
          telephony,
          trackingUrl,
          trackingToken: existingActiveSession.trackingToken,
          smsDispatches: existingActiveSession.smsDispatches,
          alreadyActive: true,
          message: "An active emergency session is already in progress. Re-attaching to prevent duplicate requests.",
        });
      }

      // Generate cryptographically secure tracking token (Requirement 5 & 10)
      const trackingToken = generateSecureTrackingToken();
      const origin = req.headers.get("origin") || req.nextUrl.origin || "http://localhost:3000";
      const trackingUrl = `${origin}/sos/track/${trackingToken}`;

      const session = await db.emergencySession.create({
        data: {
          userId: user.id,
          status: "ACTIVE",
          callingStatus: "ESCALATING",
          triggerReason: body.triggerReason || "SOS Emergency Confirmed",
          trackingToken,
          gpsStatus: "PENDING",
        },
      });

      // Requirement 6 & 7: Send emergency SMS with student name, alert message, activation time & tracking URL
      const smsDispatches = [];
      for (const contact of contacts) {
        const smsResult = await sendEmergencySms({
          toPhoneNumber: contact.phoneNumber,
          recipientName: contact.name,
          studentName: user.fullName,
          trackingUrl,
          activatedAt: session.createdAt,
          callbackBaseUrl: origin,
          simulatedOutcome: body.simulatedSmsOutcome,
        });

        const record = await db.emergencySmsDispatch.create({
          data: {
            sessionId: session.id,
            contactId: contact.id,
            recipientName: contact.name,
            phoneNumber: contact.phoneNumber,
            messageBody: smsResult.messageBody,
            status: smsResult.status,
            provider: smsResult.provider,
            telephonySid: smsResult.telephonySid,
            errorMessage: smsResult.errorMessage,
            sentAt:
              smsResult.status === "SENT" ||
                smsResult.status === "DELIVERED" ||
                smsResult.status === "MOCK_SENT"
                ? new Date()
                : null,
          },
        });
        smsDispatches.push(record);
      }

      return NextResponse.json({
        success: true,
        session,
        contacts,
        telephony,
        trackingUrl,
        trackingToken,
        smsDispatches,
        message: "Active emergency session established. Emergency SMS sent to all saved contacts.",
      });
    }

    // 2. STEP_CALL: Priority-based emergency calling step
    if (action === "STEP_CALL") {
      const { sessionId, contactId, attemptNumber, simulatedOutcome } = body;

      if (!sessionId || !contactId) {
        return NextResponse.json(
          { success: false, error: "sessionId and contactId are required." },
          { status: 400 }
        );
      }

      const session = await db.emergencySession.findUnique({
        where: { id: sessionId },
      });

      if (!session || session.userId !== user.id) {
        return NextResponse.json(
          { success: false, error: "Emergency session not found or access denied." },
          { status: 404 }
        );
      }

      if (session.status !== "ACTIVE") {
        return NextResponse.json(
          { success: false, error: `Emergency session is not active (${session.status}).` },
          { status: 400 }
        );
      }

      const contact = await db.emergencyContact.findUnique({
        where: { id: contactId },
      });

      if (!contact || contact.userId !== user.id) {
        return NextResponse.json(
          { success: false, error: "Emergency contact not found." },
          { status: 404 }
        );
      }

      const currentAttempt = Number(attemptNumber) || 1;

      // Extract request origin for Twilio webhook callback URL
      const origin = req.headers.get("origin") || req.nextUrl.origin;

      // Execute call via telephony provider
      const callResult = await placeEmergencyCall({
        toPhoneNumber: contact.phoneNumber,
        contactName: contact.name,
        studentName: user.fullName,
        priority: contact.priority,
        attemptNumber: currentAttempt,
        callbackBaseUrl: origin,
        simulatedOutcome: simulatedOutcome,
      });

      // Persist call attempt
      const recordedAttempt = await db.emergencyCallAttempt.create({
        data: {
          sessionId: session.id,
          contactId: contact.id,
          contactName: contact.name,
          phoneNumber: contact.phoneNumber,
          priority: contact.priority,
          attemptNumber: currentAttempt,
          status: callResult.status,
          provider: callResult.provider,
          telephonySid: callResult.telephonySid,
          durationSeconds: callResult.durationSeconds,
          errorMessage: callResult.errorMessage,
          notes: callResult.notes,
        },
      });

      // Update session's active call Sid
      await db.emergencySession.update({
        where: { id: session.id },
        data: { activeCallSid: callResult.telephonySid },
      });

      // Load all contacts to evaluate priority chain
      const allContacts = await db.emergencyContact.findMany({
        where: { userId: user.id },
        orderBy: { priority: "asc" },
      });

      let updatedSession = session;
      let nextStep: {
        escalationStopped: boolean;
        escalationExhausted: boolean;
        nextContactId?: string;
        nextContactName?: string;
        nextPhoneNumber?: string;
        nextPriority?: number;
        nextAttemptNumber?: number;
        reason: string;
      };

      // =========================================================================
      // BUG FIX: LOGIC WHEN CONTACT ANSWERS
      // 1. Stop further automatic call escalation.
      // 2. Record which contact answered.
      // 3. Update the calling status to CONTACT_REACHED.
      // 4. Keep the EmergencySession status as ACTIVE.
      // 5. Emergency remains active until student manually clicks End Emergency.
      // =========================================================================
      if (callResult.status === "ANSWERED") {
        updatedSession = await db.emergencySession.update({
          where: { id: session.id },
          data: {
            status: "ACTIVE", // CRITICAL: Kept ACTIVE as required!
            callingStatus: "CONTACT_REACHED",
            answeredContactId: contact.id,
            resolvedReason: `Priority ${contact.priority} contact (${contact.name}) answered the call. Emergency session remains ACTIVE until ended by student.`,
          },
        });

        nextStep = {
          escalationStopped: true,
          escalationExhausted: false,
          reason: `Contact reached: Priority ${contact.priority} (${contact.name}) answered. Automatic escalation stopped. Emergency session remains active.`,
        };
      }
      // Retry once if unanswered (Attempt 1 -> Attempt 2)
      else if (currentAttempt < 2) {
        nextStep = {
          escalationStopped: false,
          escalationExhausted: false,
          nextContactId: contact.id,
          nextContactName: contact.name,
          nextPhoneNumber: contact.phoneNumber,
          nextPriority: contact.priority,
          nextAttemptNumber: 2,
          reason: `Attempt 1 for Priority ${contact.priority} (${contact.name}) was ${callResult.status}. Retrying once as required.`,
        };
      }
      // Both attempts failed -> Escalate to next contact in priority order
      else {
        const nextContact = allContacts.find((c) => c.priority > contact.priority);

        if (nextContact) {
          nextStep = {
            escalationStopped: false,
            escalationExhausted: false,
            nextContactId: nextContact.id,
            nextContactName: nextContact.name,
            nextPhoneNumber: nextContact.phoneNumber,
            nextPriority: nextContact.priority,
            nextAttemptNumber: 1,
            reason: `Both attempts for Priority ${contact.priority} (${contact.name}) failed. Automatically escalating to Priority ${nextContact.priority} (${nextContact.name}).`,
          };
        } else {
          // All contacts called twice without answer
          updatedSession = await db.emergencySession.update({
            where: { id: session.id },
            data: {
              status: "ACTIVE", // Stays ACTIVE until ended by student
              callingStatus: "EXHAUSTED",
              resolvedReason: "All emergency contacts called twice without answer.",
            },
          });

          nextStep = {
            escalationStopped: false,
            escalationExhausted: true,
            reason: "All contacts have been called twice without answer. Emergency session remains active. Dial 999 or DU Proctor Office immediately.",
          };
        }
      }

      const allAttempts = await db.emergencyCallAttempt.findMany({
        where: { sessionId: session.id },
        orderBy: { createdAt: "asc" },
      });

      return NextResponse.json({
        success: true,
        callAttempt: recordedAttempt,
        session: updatedSession,
        nextStep,
        allAttempts,
        telephony,
      });
    }

    // 3. CHECK_STATUS: Polls live Twilio call status if webhooks are unable to reach local dev
    if (action === "CHECK_STATUS") {
      const { callSid } = body;
      if (!callSid) {
        return NextResponse.json({ success: false, error: "callSid is required" }, { status: 400 });
      }

      const twilioStatus = await checkTwilioCallStatus(callSid);
      if (twilioStatus) {
        const callAttempt = await db.emergencyCallAttempt.findFirst({
          where: { telephonySid: callSid },
          include: { session: true },
        });

        if (callAttempt && callAttempt.status !== twilioStatus.status) {
          await db.emergencyCallAttempt.update({
            where: { id: callAttempt.id },
            data: {
              status: twilioStatus.status,
              durationSeconds: twilioStatus.durationSeconds,
            },
          });

          if (twilioStatus.status === "ANSWERED" && callAttempt.session.status === "ACTIVE") {
            await db.emergencySession.update({
              where: { id: callAttempt.session.id },
              data: {
                callingStatus: "CONTACT_REACHED",
                answeredContactId: callAttempt.contactId,
              },
            });
          }
        }

        return NextResponse.json({ success: true, twilioStatus });
      }

      return NextResponse.json({ success: true, message: "No remote status update available" });
    }

    // =========================================================================
    // 4. END_EMERGENCY / RESOLVE:
    // Only student manually clicking "End Emergency" / "I Am Safe" marks session as RESOLVED.
    // Also cancels any pending / active Twilio calls.
    // =========================================================================
    if (action === "END_EMERGENCY" || action === "RESOLVE") {
      const { sessionId, reason } = body;
      if (!sessionId) {
        return NextResponse.json({ success: false, error: "sessionId is required." }, { status: 400 });
      }

      const session = await db.emergencySession.findUnique({
        where: { id: sessionId },
      });

      if (!session || session.userId !== user.id) {
        return NextResponse.json({ success: false, error: "Session not found." }, { status: 404 });
      }

      // Requirement 7: Ensure pending calls are cancelled when the student ends the emergency
      if (session.activeCallSid && session.activeCallSid.startsWith("CA")) {
        await cancelTwilioCall(session.activeCallSid);
      }

      // Cancel any attempts that were in INITIATED or RINGING state
      await db.emergencyCallAttempt.updateMany({
        where: {
          sessionId: session.id,
          status: { in: ["INITIATED", "RINGING"] },
        },
        data: {
          status: "CANCELLED",
          notes: "Call cancelled because student ended emergency session.",
        },
      });

      // Mark session as RESOLVED
      const resolvedSession = await db.emergencySession.update({
        where: { id: sessionId },
        data: {
          status: "RESOLVED",
          callingStatus: "RESOLVED",
          resolvedReason: reason || "Student manually ended emergency (marked safe).",
          resolvedAt: new Date(),
        },
      });

      return NextResponse.json({
        success: true,
        session: resolvedSession,
        message: "Emergency officially resolved and ended by student. All pending calls cancelled.",
      });
    }

    // 5. CANCEL: During initial countdown
    if (action === "CANCEL") {
      const { sessionId, reason } = body;
      if (!sessionId) {
        return NextResponse.json({ success: false, error: "sessionId is required." }, { status: 400 });
      }

      const session = await db.emergencySession.update({
        where: { id: sessionId },
        data: {
          status: "CANCELLED",
          callingStatus: "CANCELLED",
          resolvedReason: reason || "User cancelled emergency countdown.",
          resolvedAt: new Date(),
        },
      });

      return NextResponse.json({
        success: true,
        session,
        message: "Emergency session cancelled.",
      });
    }

    // 6. UPDATE_LOCATION: Continuously record real-time GPS coordinates & breadcrumbs (Requirements 2, 3, 4)
    if (action === "UPDATE_LOCATION") {
      const { sessionId, latitude, longitude, accuracy, heading, speed, gpsStatus } = body;

      if (!sessionId || typeof latitude !== "number" || typeof longitude !== "number") {
        return NextResponse.json(
          { success: false, error: "sessionId, latitude, and longitude numbers are required." },
          { status: 400 }
        );
      }

      const session = await db.emergencySession.findUnique({
        where: { id: sessionId },
      });

      if (!session || session.userId !== user.id) {
        return NextResponse.json(
          { success: false, error: "Emergency session not found or access denied." },
          { status: 404 }
        );
      }

      if (session.status !== "ACTIVE") {
        return NextResponse.json(
          { success: false, error: "Cannot update location on an inactive or resolved session." },
          { status: 400 }
        );
      }

      // Store breadcrumb in database
      const breadcrumb = await db.emergencyLocationUpdate.create({
        data: {
          sessionId: session.id,
          latitude,
          longitude,
          accuracy: typeof accuracy === "number" ? accuracy : null,
          heading: typeof heading === "number" ? heading : null,
          speed: typeof speed === "number" ? speed : null,
        },
      });

      // Update session's latest location & timestamp
      const updatedSession = await db.emergencySession.update({
        where: { id: session.id },
        data: {
          latestLatitude: latitude,
          latestLongitude: longitude,
          latestAccuracy: typeof accuracy === "number" ? accuracy : null,
          latestLocationAt: new Date(),
          gpsStatus: gpsStatus || "CONNECTED",
        },
        include: {
          locationUpdates: { orderBy: { timestamp: "desc" }, take: 10 },
          smsDispatches: true,
          callAttempts: true,
        },
      });

      return NextResponse.json({
        success: true,
        session: updatedSession,
        breadcrumb,
        message: "Live location update stored in database.",
      });
    }

    // 7. GPS_STATUS_UPDATE: Handle denied, unavailable, or granted GPS state (Requirement 12)
    if (action === "GPS_STATUS_UPDATE") {
      const { sessionId, gpsStatus } = body;
      if (!sessionId) {
        return NextResponse.json({ success: false, error: "sessionId is required." }, { status: 400 });
      }

      const session = await db.emergencySession.findUnique({
        where: { id: sessionId },
      });

      if (!session || session.userId !== user.id) {
        return NextResponse.json({ success: false, error: "Access denied." }, { status: 403 });
      }

      const updatedSession = await db.emergencySession.update({
        where: { id: sessionId },
        data: {
          gpsStatus: gpsStatus || "DENIED",
        },
      });

      return NextResponse.json({
        success: true,
        session: updatedSession,
        message: `GPS tracking state recorded as: ${gpsStatus}`,
      });
    }

    // 8. RESEND_SMS: Re-dispatch emergency SMS to all saved contacts
    if (action === "RESEND_SMS") {
      const { sessionId, simulatedOutcome } = body;
      if (!sessionId) {
        return NextResponse.json({ success: false, error: "sessionId is required." }, { status: 400 });
      }

      const session = await db.emergencySession.findUnique({
        where: { id: sessionId },
      });

      if (!session || session.userId !== user.id) {
        return NextResponse.json({ success: false, error: "Access denied." }, { status: 403 });
      }

      const contacts = await db.emergencyContact.findMany({
        where: { userId: user.id },
        orderBy: { priority: "asc" },
      });

      const origin = req.headers.get("origin") || req.nextUrl.origin || "http://localhost:3000";
      const trackingUrl = session.trackingToken
        ? `${origin}/sos/track/${session.trackingToken}`
        : `${origin}/sos`;

      const smsDispatches = [];
      for (const contact of contacts) {
        const smsResult = await sendEmergencySms({
          toPhoneNumber: contact.phoneNumber,
          recipientName: contact.name,
          studentName: user.fullName,
          trackingUrl,
          activatedAt: session.createdAt,
          callbackBaseUrl: origin,
          simulatedOutcome,
        });

        const record = await db.emergencySmsDispatch.create({
          data: {
            sessionId: session.id,
            contactId: contact.id,
            recipientName: contact.name,
            phoneNumber: contact.phoneNumber,
            messageBody: smsResult.messageBody,
            status: smsResult.status,
            provider: smsResult.provider,
            telephonySid: smsResult.telephonySid,
            errorMessage: smsResult.errorMessage,
            sentAt:
              smsResult.status === "SENT" ||
                smsResult.status === "DELIVERED" ||
                smsResult.status === "MOCK_SENT"
                ? new Date()
                : null,
          },
        });
        smsDispatches.push(record);
      }

      return NextResponse.json({
        success: true,
        smsDispatches,
        message: `Emergency SMS sent to ${smsDispatches.length} contacts.`,
      });
    }

    return NextResponse.json({ success: false, error: "Unknown action" }, { status: 400 });
  } catch (error) {
    console.error("Failed to process emergency session action:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error processing emergency session" },
      { status: 500 }
    );
  }
}
