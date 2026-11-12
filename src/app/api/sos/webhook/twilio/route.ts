import { NextRequest, NextResponse } from "next/server";
import { db } from "@/app/lib/db";
import { mapTwilioCallStatus } from "@/app/lib/telephony";

function escapeXml(raw: string): string {
  return raw
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

const getTwimlResponse = (student = "Campus Student") => {
  const safeStudent = escapeXml(student.slice(0, 80));
  return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Pause length="1"/>
  <Say language="bn-IN">
    জরুরি সতর্কতা। আপনার মেয়ে বা ছেলে লাইফ রিস্কে আছে এবং বিপদে পড়েছে। আপনার নাম্বারে তার লাইভ লোকেশনের লিংক পাঠানো হয়েছে। দয়া করে এখনই আপনার মেসেজ চেক করুন এবং দ্রুত ব্যবস্থা নিন।
  </Say>
  <Pause length="1"/>
  <Say language="bn-IN">
    আবার বলছি, আপনার সন্তান বিপদে পড়েছে। আপনার নাম্বারে তার লাইভ লোকেশনের লিংক পাঠানো হয়েছে।
  </Say>
  <Pause length="1"/>
  <Say voice="alice" language="en-US">
    Urgent emergency alert: Student ${safeStudent} is in danger and has activated an SOS alert. A live location tracking link has been sent to your mobile phone via SMS.
  </Say>
  <Pause length="2"/>
</Response>`;
};

// TwiML voice instruction provider for Twilio Url calls (GET)
export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const student = url.searchParams.get("student") || "Campus Student";

  return new NextResponse(getTwimlResponse(student), {
    status: 200,
    headers: { "Content-Type": "text/xml; charset=utf-8" },
  });
}

// Twilio asynchronous call webhook handler (POST)
// Note: Twilio calls the `Url` parameter using HTTP POST by default when the recipient answers!
// Therefore, this POST handler MUST return the TwiML voice instructions so Twilio speaks the message!
export async function POST(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const student = url.searchParams.get("student") || "Campus Student";

    // Try to parse formData if present for call status updates
    try {
      const formData = await req.formData();
      const callSid = formData.get("CallSid")?.toString();
      const callStatus = formData.get("CallStatus")?.toString();
      const callDuration = formData.get("CallDuration")?.toString();

      if (callSid && callStatus) {
        const mappedStatus = mapTwilioCallStatus(callStatus);
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
              notes: `Twilio update: status=${callStatus}, duration=${callDuration || 0}s`,
            },
          });

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
      }
    } catch {
      // Ignore formData parsing errors if none provided
    }

    // ALWAYS return the TwiML instructions with 200 OK so Twilio NEVER says "Application Error"!
    return new NextResponse(getTwimlResponse(student), {
      status: 200,
      headers: { "Content-Type": "text/xml; charset=utf-8" },
    });
  } catch (error) {
    console.error("Twilio webhook error:", error);
    return new NextResponse(getTwimlResponse("Campus Student"), {
      status: 200,
      headers: { "Content-Type": "text/xml; charset=utf-8" },
    });
  }
}
