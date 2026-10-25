import { NextRequest, NextResponse } from "next/server";
import { db } from "@/app/lib/db";
import { mapTwilioCallStatus, validateTwilioWebhookSignature } from "@/app/lib/telephony";

// TwiML voice instruction provider for Twilio Url calls
export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const student = url.searchParams.get("student") || "Campus Student";
  const priority = url.searchParams.get("priority") || "1";

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Pause length="1"/>
  <Say voice="alice" language="en-US">
    Urgent Campus Emergency Notification from UniShare. Student ${student} has activated an SOS emergency request. You are listed as priority ${priority} emergency contact. Please check your messages for live tracking or contact university security immediately.
  </Say>
  <Pause length="2"/>
</Response>`;

  return new NextResponse(xml, {
    status: 200,
    headers: { "Content-Type": "text/xml; charset=utf-8" },
  });
}

// Twilio asynchronous call status webhook handler
export async function POST(req: NextRequest) {
  try {
    const signature = req.headers.get("x-twilio-signature");
    const formData = await req.formData();
    const params: Record<string, string> = {};
    formData.forEach((value, key) => {
      params[key] = value.toString();
    });

    const fullUrl = req.nextUrl.toString();

    // Verify Twilio webhook signature where supported
    const isValid = validateTwilioWebhookSignature({
      url: fullUrl,
      signature,
      formData: params,
    });

    if (!isValid) {
      return new NextResponse("Unauthorized Twilio Webhook Signature", { status: 401 });
    }

    const callSid = params.CallSid || formData.get("CallSid")?.toString();
    const callStatus = params.CallStatus || formData.get("CallStatus")?.toString();
    const callDuration = params.CallDuration || formData.get("CallDuration")?.toString();

    if (!callSid || !callStatus) {
      return new NextResponse("<Response/>", {
        headers: { "Content-Type": "text/xml" },
      });
    }

    const mappedStatus = mapTwilioCallStatus(callStatus);

    // Update the call attempt record in database
    const callAttempt = await db.emergencyCallAttempt.findFirst({
      where: { telephonySid: callSid },
      include: { session: true },
    });

    if (callAttempt) {
      await db.emergencyCallAttempt.update({
        where: { id: callAttempt.id },
        data: {
          status: mappedStatus,
          durationSeconds: Number(callDuration) || callAttempt.durationSeconds,
          notes: `Twilio Webhook update: status=${callStatus}, duration=${callDuration || 0}s`,
        },
      });

      // IMPORTANT FIX:
      // When a contact answers (mappedStatus === 'ANSWERED'):
      // 1. Stop further automatic call escalation.
      // 2. Record which contact answered (answeredContactId).
      // 3. Update callingStatus to CONTACT_REACHED.
      // 4. Keep the EmergencySession status as ACTIVE!
      // 5. Do NOT mark session as RESOLVED until student clicks End Emergency.
      if (mappedStatus === "ANSWERED" && callAttempt.session.status === "ACTIVE") {
        await db.emergencySession.update({
          where: { id: callAttempt.session.id },
          data: {
            callingStatus: "CONTACT_REACHED",
            answeredContactId: callAttempt.contactId,
            resolvedReason: `Contact ${callAttempt.contactName} answered call. Emergency remains active until ended by student.`,
          },
        });
      }
    }

    return new NextResponse("<Response/>", {
      status: 200,
      headers: { "Content-Type": "text/xml" },
    });
  } catch (error) {
    console.error("Twilio webhook processing error:", error);
    return new NextResponse("<Response/>", {
      status: 200,
      headers: { "Content-Type": "text/xml" },
    });
  }
}

