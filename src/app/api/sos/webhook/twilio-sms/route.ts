import { NextRequest, NextResponse } from "next/server";
import { db } from "@/app/lib/db";
import { mapTwilioSmsStatus, validateTwilioWebhookSignature } from "@/app/lib/telephony";

// POST: Twilio SMS StatusCallback Webhook
// Handles delivery reports (delivered, undelivered, failed, sent)
export async function POST(req: NextRequest) {
  try {
    const signature = req.headers.get("x-twilio-signature");
    const contentType = req.headers.get("content-type") || "";
    let messageSid = "";
    let messageStatus = "";
    let errorCode = "";
    const params: Record<string, string> = {};

    if (contentType.includes("application/x-www-form-urlencoded")) {
      const formData = await req.formData();
      formData.forEach((value, key) => {
        params[key] = value.toString();
      });
      messageSid = (params.MessageSid || params.SmsSid || "").toString();
      messageStatus = (params.MessageStatus || params.SmsStatus || "").toString();
      errorCode = (params.ErrorCode || "").toString();
    } else {
      const body = await req.json().catch(() => ({}));
      messageSid = body.MessageSid || body.SmsSid || "";
      messageStatus = body.MessageStatus || body.SmsStatus || "";
      errorCode = body.ErrorCode || "";
      Object.entries(body).forEach(([k, v]) => {
        if (typeof v === "string") params[k] = v;
      });
    }

    // Verify webhook signature where supported
    const isValid = validateTwilioWebhookSignature({
      url: req.nextUrl.toString(),
      signature,
      formData: params,
    });

    if (!isValid) {
      return new NextResponse("Unauthorized Twilio SMS Webhook Signature", { status: 401 });
    }

    if (!messageSid) {
      return new NextResponse("<Response/>", {
        status: 200,
        headers: { "Content-Type": "text/xml" },
      });
    }

    const internalStatus = mapTwilioSmsStatus(messageStatus);

    const existingDispatch = await db.emergencySmsDispatch.findFirst({
      where: { telephonySid: messageSid },
    });

    if (existingDispatch) {
      await db.emergencySmsDispatch.update({
        where: { id: existingDispatch.id },
        data: {
          status: internalStatus,
          errorMessage: errorCode ? `Twilio ErrorCode: ${errorCode}` : existingDispatch.errorMessage,
          sentAt: internalStatus === "DELIVERED" || internalStatus === "SENT" ? new Date() : existingDispatch.sentAt,
        },
      });
    }

    return new NextResponse("<Response/>", {
      status: 200,
      headers: { "Content-Type": "text/xml" },
    });
  } catch (err) {
    console.error("Twilio SMS webhook error:", err);
    return new NextResponse("<Response/>", {
      status: 200,
      headers: { "Content-Type": "text/xml" },
    });
  }
}

