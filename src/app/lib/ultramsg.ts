// UltraMsg WhatsApp Cloud Gateway Integration for UniShare Emergency Assistance
// Automatically sends WhatsApp messages to emergency contacts directly from the server

export interface UltraMsgSendResult {
  success: boolean;
  messageId?: string;
  status?: string;
  error?: string;
}

export function formatPhoneForUltraMsg(phone: string): string {
  let digits = phone.replace(/\D/g, "");
  if (digits.startsWith("880")) return digits;
  if (digits.startsWith("88") && !digits.startsWith("880")) return "880" + digits.slice(2);
  if (digits.startsWith("0")) return "880" + digits.slice(1);
  return "880" + digits;
}

export async function sendUltraMsgWhatsApp(params: {
  toPhoneNumber: string;
  studentName: string;
  trackingUrl: string;
}): Promise<UltraMsgSendResult> {
  const instanceId = process.env.ULTRAMSG_INSTANCE_ID || "";
  const token = process.env.ULTRAMSG_TOKEN || "";

  if (!instanceId || !token) {
    return { success: false, error: "UltraMsg credentials not configured" };
  }

  const to = formatPhoneForUltraMsg(params.toPhoneNumber);
  const messageBody =
    `🚨 *জরুরি সতর্কতা (UniShare Emergency SOS)*\n` +
    `আপনার সন্তান/বন্ধু (${params.studentName}) বিপদে পড়েছেন এবং জরুরি সহায়তা চেয়েছেন!\n\n` +
    `📍 *রিয়েল-টাইম লাইভ জিপিএস লোকেশন দেখতে নিচের লিংকে ক্লিক করুন:*\n${params.trackingUrl}\n\n` +
    `দয়া করে এখনই ব্যবস্থা নিন অথবা প্রয়োজনে ৯৯৯ নম্বরে কল করুন।`;

  try {
    const formData = new URLSearchParams();
    formData.append("token", token);
    formData.append("to", to);
    formData.append("body", messageBody);

    const res = await fetch(`https://api.ultramsg.com/${instanceId}/messages/chat`, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: formData.toString(),
    });

    const data = await res.json();

    if (data.sent === "true" || data.sent === true || data.id) {
      return {
        success: true,
        messageId: String(data.id || ""),
        status: data.message || "Message dispatched successfully via UltraMsg",
      };
    } else {
      return {
        success: false,
        error: data.message || data.error || "Failed to dispatch message via UltraMsg",
      };
    }
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : "UltraMsg API request network failure";
    console.error("UltraMsg WhatsApp sending error:", err);
    return {
      success: false,
      error: errorMsg,
    };
  }
}
