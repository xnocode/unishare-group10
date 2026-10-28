import { NextRequest, NextResponse } from "next/server";
import { sendUltraMsgWhatsApp } from "@/app/lib/ultramsg";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { toPhoneNumber, studentName, trackingUrl } = body;

    if (!toPhoneNumber) {
      return NextResponse.json(
        { success: false, error: "Recipient phone number is required." },
        { status: 400 }
      );
    }

    const origin = req.headers.get("origin") || req.nextUrl.origin || "https://unishare.online";
    const finalTrackingUrl = trackingUrl || `${origin}/sos`;

    const result = await sendUltraMsgWhatsApp({
      toPhoneNumber,
      studentName: studentName || "UniShare Student",
      trackingUrl: finalTrackingUrl,
    });

    return NextResponse.json({
      success: result.success,
      messageId: result.messageId,
      status: result.status,
      error: result.error,
    });
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : "Error executing WhatsApp dispatch";
    return NextResponse.json({ success: false, error: errorMsg }, { status: 500 });
  }
}

