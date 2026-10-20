import type { OtpPurpose } from "./auth";

export type MailProviderName = "RESEND_API";

export interface SendOtpEmailParams {
  to: string;
  code: string;
  purpose: OtpPurpose;
  university?: string;
}

export interface SendOtpEmailResult {
  delivered: boolean;
  provider: MailProviderName;
  error?: string;
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function buildOtpEmailContent({
  code,
  purpose,
  university,
}: SendOtpEmailParams): { subject: string; text: string; html: string } {
  const isReset = purpose === "PASSWORD_RESET";
  const uniLine = university?.trim() || "your campus";
  const subject = isReset
    ? `${code} is your UniShare password reset code`
    : `${code} is your UniShare confirmation code`;

  const headline = isReset
    ? "Reset your UniShare password"
    : "Confirm your university email";

  const intro = isReset
    ? "Use the 6-digit security code below to choose a new password for your UniShare account."
    : `Use the 6-digit confirmation code below to finish creating your UniShare campus account for ${uniLine}.`;

  const text = [
    headline,
    "",
    intro,
    "",
    `Your verification code: ${code}`,
    "",
    "This code expires in 15 minutes.",
    "If you did not request this, you can safely ignore this email.",
    "",
    "UniShare · University student community in Bangladesh",
  ].join("\n");

  const html = `<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8" /></head>
<body style="margin:0;padding:24px;background:#f4f7f6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#12201f;">
  <div style="max-width:480px;margin:0 auto;background:#ffffff;border:1.5px solid #d5e0de;border-radius:14px;padding:28px 28px 24px;">
    <div style="display:flex;align-items:center;gap:8px;margin-bottom:18px;font-weight:800;font-size:20px;color:#0B5D5E;">
      UniShare
    </div>
    <h1 style="margin:0 0 10px;font-size:22px;line-height:1.25;color:#12201f;">${escapeHtml(
      headline
    )}</h1>
    <p style="margin:0 0 20px;font-size:15px;line-height:1.55;color:#526160;">${escapeHtml(
      intro
    )}</p>
    <div style="background:#eef6f5;border:1.5px solid #0B5D5E;border-radius:10px;padding:18px 16px;text-align:center;margin:0 0 20px;">
      <div style="font-size:12px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:#0B5D5E;margin-bottom:6px;">
        6-digit verification code
      </div>
      <div style="font-size:34px;font-weight:800;letter-spacing:8px;color:#12201f;font-variant-numeric:tabular-nums;">
        ${escapeHtml(code)}
      </div>
    </div>
    <p style="margin:0;font-size:13px;line-height:1.5;color:#5f6f6d;">
      This code expires in 15 minutes. If you didn’t request this on UniShare, you can ignore this message.
    </p>
  </div>
</body>
</html>`;

  return { subject, text, html };
}

export function getMailProviderStatus() {
  const from =
    process.env.RESEND_FROM?.trim() ||
    process.env.MAIL_FROM?.trim() ||
    "UniShare <no-reply@unishare.online>";

  return {
    provider: "RESEND_API" as const,
    isConfigured: Boolean(process.env.RESEND_API_KEY?.trim()),
    from,
  };
}

export async function sendOtpEmail(
  params: SendOtpEmailParams
): Promise<SendOtpEmailResult> {
  const resendKey = process.env.RESEND_API_KEY?.trim();
  if (!resendKey) {
    return {
      delivered: false,
      provider: "RESEND_API",
      error: "RESEND_API_KEY is not configured in environment variables.",
    };
  }

  const content = buildOtpEmailContent(params);
  const from =
    process.env.RESEND_FROM?.trim() ||
    process.env.MAIL_FROM?.trim() ||
    "UniShare <no-reply@unishare.online>";

  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${resendKey}`,
      },
      body: JSON.stringify({
        from,
        to: [params.to.trim()],
        subject: content.subject,
        html: content.html,
        text: content.text,
      }),
    });

    if (!response.ok) {
      const errData = (await response.json().catch(() => ({}))) as {
        message?: string;
      };
      return {
        delivered: false,
        provider: "RESEND_API",
        error:
          errData.message ||
          `Resend rejected email delivery (${response.status}).`,
      };
    }

    return { delivered: true, provider: "RESEND_API" };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Resend request failed";
    return {
      delivered: false,
      provider: "RESEND_API",
      error: `Could not reach Resend email service: ${msg}`,
    };
  }
}
