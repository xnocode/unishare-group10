import nodemailer from "nodemailer";
import type { OtpPurpose } from "./auth";
import { BD_UNIVERSITIES } from "./bd-universities";

export type MailProviderName =
  | "SMTP"
  | "GMAIL_SMTP"
  | "BREVO_API"
  | "RESEND_API"
  | "ETHEREAL_TEST";

export type MailChannel = "TEMP_MAIL" | "ACTUAL_MAIL";

export interface SendOtpEmailParams {
  to: string;
  code: string;
  purpose: OtpPurpose;
  university?: string;
  isCustomUniversity?: boolean;
}

export interface SendOtpEmailResult {
  delivered: boolean;
  provider: MailProviderName;
  channel?: MailChannel;
  isLiveEmail: boolean;
  previewUrl?: string;
  error?: string;
}

interface BuiltMailContent {
  subject: string;
  text: string;
  html: string;
}

interface EtherealCachedAccount {
  user: string;
  pass: string;
  smtp: { host: string; port: number; secure: boolean };
}

const globalForMail = globalThis as unknown as {
  __unishareEtherealAccount?: EtherealCachedAccount;
};

const BUILTIN_TEMP_MAIL_DOMAINS = [
  "mailinator.com",
  "guerrillamail.com",
  "guerrillamail.net",
  "guerrillamail.org",
  "guerrillamailblock.com",
  "sharklasers.com",
  "grr.la",
  "yopmail.com",
  "yopmail.fr",
  "yopmail.net",
  "10minutemail.com",
  "10minutemail.net",
  "tempmail.com",
  "temp-mail.org",
  "temp-mail.io",
  "tmpmail.org",
  "tmpmail.net",
  "mohmal.com",
  "maildrop.cc",
  "getnada.com",
  "nada.email",
  "dispostable.com",
  "throwawaymail.com",
  "trashmail.com",
  "trashmail.net",
  "fakeinbox.com",
  "mintemail.com",
  "emailondeck.com",
  "tempinbox.com",
  "moakt.com",
  "burnermail.io",
  "ethereal.email",
  "inboxkitten.com",
  "mailnesia.com",
  "anonbox.net",
  "mailcatch.com",
  "spambog.com",
  "discard.email",
  "mail-temporaire.fr",
];

const REAL_CONSUMER_PROVIDERS = [
  "gmail.com",
  "googlemail.com",
  "outlook.com",
  "hotmail.com",
  "live.com",
  "msn.com",
  "yahoo.com",
  "ymail.com",
  "icloud.com",
  "me.com",
  "mac.com",
  "proton.me",
  "protonmail.com",
  "pm.me",
  "zoho.com",
  "gmx.com",
  "gmx.net",
  "aol.com",
  "yandex.com",
  "fastmail.com",
  "tutanota.com",
  "tuta.io",
];

const LISTED_UNI_DOMAINS = Array.from(
  new Set(BD_UNIVERSITIES.flatMap((u) => u.domains.map((d) => d.toLowerCase())))
);

function matchesDomainEntry(domain: string, entry: string): boolean {
  const cleanEntry = entry.trim().toLowerCase().replace(/^@/, "");
  if (!cleanEntry) return false;
  return domain === cleanEntry || domain.endsWith(`.${cleanEntry}`);
}

export function classifyEmailChannel(
  email: string,
  options?: { isCustomUniversity?: boolean }
): MailChannel {
  const domain = (email.trim().toLowerCase().split("@")[1] || "").trim();
  if (!domain) return "ACTUAL_MAIL";

  const extraTempDomains = (process.env.TEMP_MAIL_DOMAINS || "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);

  const isKnownTemp =
    BUILTIN_TEMP_MAIL_DOMAINS.some((d) => matchesDomainEntry(domain, d)) ||
    extraTempDomains.some((d) => matchesDomainEntry(domain, d)) ||
    /(tempmail|temp-mail|trashmail|mailinator|throwaway|disposable|guerrillamail|yopmail|10minutemail)/i.test(
      domain
    );

  if (isKnownTemp) {
    return "TEMP_MAIL";
  }

  const isAcademicDomain = /\.(edu|edu\.[a-z]{2,}|ac\.[a-z]{2,})$/i.test(domain);
  const isListedUniDomain = LISTED_UNI_DOMAINS.some((d) =>
    matchesDomainEntry(domain, d)
  );
  const isMajorPersonalProvider = REAL_CONSUMER_PROVIDERS.some((d) =>
    matchesDomainEntry(domain, d)
  );

  if (isAcademicDomain || isListedUniDomain || isMajorPersonalProvider) {
    return "ACTUAL_MAIL";
  }

  // Services like temp-mail.org rotate random non-academic domains daily;
  // unlisted university signups using unknown non-academic domains route to Brevo.
  if (options?.isCustomUniversity) {
    return "TEMP_MAIL";
  }

  return "ACTUAL_MAIL";
}

function parseFromHeader(rawFrom?: string): { name: string; email: string } {
  const cleaned = (rawFrom || "").trim();
  const angleMatch = cleaned.match(/^(.*?)\s*<([^>]+)>$/);
  if (angleMatch) {
    return {
      name: angleMatch[1].replace(/^"|"$/g, "").trim() || "UniShare",
      email: angleMatch[2].trim(),
    };
  }
  if (cleaned.includes("@")) {
    return { name: "UniShare", email: cleaned };
  }
  return { name: "UniShare", email: "no-reply@unishare.online" };
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
}: SendOtpEmailParams): BuiltMailContent {
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
  const hasCustomSmtp = Boolean(
    process.env.SMTP_HOST?.trim() &&
      process.env.SMTP_USER?.trim() &&
      process.env.SMTP_PASS?.trim()
  );
  const hasBrevo = Boolean(process.env.BREVO_API_KEY?.trim());
  const hasResend = Boolean(process.env.RESEND_API_KEY?.trim());
  const hasGmail = Boolean(
    process.env.GMAIL_USER?.trim() && process.env.GMAIL_APP_PASSWORD?.trim()
  );

  const secondaryProvider: MailProviderName | null = hasBrevo
    ? "BREVO_API"
    : hasCustomSmtp
    ? "SMTP"
    : hasGmail
    ? "GMAIL_SMTP"
    : null;

  const provider: MailProviderName =
    secondaryProvider || (hasResend ? "RESEND_API" : "ETHEREAL_TEST");

  return {
    provider,
    dualRoutingEnabled: Boolean(hasResend && secondaryProvider),
    tempMailProvider: secondaryProvider || provider,
    actualMailProvider: hasResend ? "RESEND_API" : provider,
    isLiveEmail: hasCustomSmtp || hasBrevo || hasResend || hasGmail,
  };
}

async function sendViaSmtp(
  to: string,
  content: BuiltMailContent,
  channel: MailChannel
): Promise<SendOtpEmailResult> {
  const smtpHost = process.env.SMTP_HOST?.trim();
  const smtpUser = process.env.SMTP_USER?.trim();
  const smtpPass = process.env.SMTP_PASS?.trim();
  if (!smtpHost || !smtpUser || !smtpPass) {
    return {
      delivered: false,
      provider: "SMTP",
      channel,
      isLiveEmail: true,
      error: "SMTP credentials are not configured.",
    };
  }

  try {
    const port = Number(process.env.SMTP_PORT || "587");
    const secure = process.env.SMTP_SECURE === "true" || port === 465;
    const from =
      process.env.SMTP_FROM?.trim() ||
      process.env.MAIL_FROM?.trim() ||
      `UniShare <${smtpUser}>`;

    const transporter = nodemailer.createTransport({
      host: smtpHost,
      port,
      secure,
      auth: { user: smtpUser, pass: smtpPass },
    });

    await transporter.sendMail({
      from,
      to,
      subject: content.subject,
      text: content.text,
      html: content.html,
    });
    return { delivered: true, provider: "SMTP", channel, isLiveEmail: true };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "SMTP send failed";
    return {
      delivered: false,
      provider: "SMTP",
      channel,
      isLiveEmail: true,
      error: `Could not send verification email via SMTP: ${msg}`,
    };
  }
}

async function sendViaGmail(
  to: string,
  content: BuiltMailContent,
  channel: MailChannel
): Promise<SendOtpEmailResult> {
  const gmailUser = process.env.GMAIL_USER?.trim();
  const gmailPass = process.env.GMAIL_APP_PASSWORD?.replace(/\s+/g, "").trim();
  if (!gmailUser || !gmailPass) {
    return {
      delivered: false,
      provider: "GMAIL_SMTP",
      channel,
      isLiveEmail: true,
      error: "Gmail SMTP credentials are not configured.",
    };
  }

  try {
    const from =
      process.env.GMAIL_FROM?.trim() ||
      process.env.MAIL_FROM?.trim() ||
      `UniShare <${gmailUser}>`;
    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: { user: gmailUser, pass: gmailPass },
    });

    await transporter.sendMail({
      from,
      to,
      subject: content.subject,
      text: content.text,
      html: content.html,
    });
    return {
      delivered: true,
      provider: "GMAIL_SMTP",
      channel,
      isLiveEmail: true,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Gmail SMTP failed";
    return {
      delivered: false,
      provider: "GMAIL_SMTP",
      channel,
      isLiveEmail: true,
      error: `Could not send verification email via Gmail: ${msg}`,
    };
  }
}

async function sendViaBrevo(
  to: string,
  content: BuiltMailContent,
  channel: MailChannel
): Promise<SendOtpEmailResult> {
  const brevoKey = process.env.BREVO_API_KEY?.trim();
  if (!brevoKey) {
    return {
      delivered: false,
      provider: "BREVO_API",
      channel,
      isLiveEmail: true,
      error: "BREVO_API_KEY is not configured.",
    };
  }

  try {
    const sender = parseFromHeader(
      process.env.BREVO_FROM ||
        process.env.BREVO_SENDER_EMAIL ||
        process.env.MAIL_FROM
    );
    const response = await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "api-key": brevoKey,
      },
      body: JSON.stringify({
        sender,
        to: [{ email: to }],
        subject: content.subject,
        htmlContent: content.html,
        textContent: content.text,
      }),
    });

    if (!response.ok) {
      const errData = (await response.json().catch(() => ({}))) as {
        message?: string;
      };
      return {
        delivered: false,
        provider: "BREVO_API",
        channel,
        isLiveEmail: true,
        error:
          errData.message ||
          `Brevo rejected email delivery (${response.status}).`,
      };
    }

    return {
      delivered: true,
      provider: "BREVO_API",
      channel,
      isLiveEmail: true,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Brevo API failed";
    return {
      delivered: false,
      provider: "BREVO_API",
      channel,
      isLiveEmail: true,
      error: `Brevo email request failed: ${msg}`,
    };
  }
}

async function sendViaResend(
  to: string,
  content: BuiltMailContent,
  channel: MailChannel
): Promise<SendOtpEmailResult> {
  const resendKey = process.env.RESEND_API_KEY?.trim();
  if (!resendKey) {
    return {
      delivered: false,
      provider: "RESEND_API",
      channel,
      isLiveEmail: true,
      error: "RESEND_API_KEY is not configured.",
    };
  }

  try {
    const from =
      process.env.RESEND_FROM?.trim() ||
      process.env.MAIL_FROM?.trim() ||
      "UniShare <onboarding@resend.dev>";

    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${resendKey}`,
      },
      body: JSON.stringify({
        from,
        to: [to],
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
        channel,
        isLiveEmail: true,
        error:
          errData.message ||
          `Resend rejected delivery (${response.status}). Verify unishare.online domain or configure a secondary SMTP/Gmail sender.`,
      };
    }

    return {
      delivered: true,
      provider: "RESEND_API",
      channel,
      isLiveEmail: true,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Resend API failed";
    return {
      delivered: false,
      provider: "RESEND_API",
      channel,
      isLiveEmail: true,
      error: `Resend email request failed: ${msg}`,
    };
  }
}

export async function sendOtpEmail(
  params: SendOtpEmailParams
): Promise<SendOtpEmailResult> {
  const content = buildOtpEmailContent(params);
  const to = params.to.trim();
  const channel = classifyEmailChannel(to, {
    isCustomUniversity: params.isCustomUniversity,
  });

  const hasBrevo = Boolean(process.env.BREVO_API_KEY?.trim());
  const hasResend = Boolean(process.env.RESEND_API_KEY?.trim());
  const hasCustomSmtp = Boolean(
    process.env.SMTP_HOST?.trim() &&
      process.env.SMTP_USER?.trim() &&
      process.env.SMTP_PASS?.trim()
  );
  const hasGmail = Boolean(
    process.env.GMAIL_USER?.trim() && process.env.GMAIL_APP_PASSWORD?.trim()
  );

  // Secondary/temp-mail-friendly providers: Brevo, custom SMTP (SMTP2GO/SendPulse/Mailjet), or Gmail SMTP
  const secondarySenders = [
    hasBrevo ? () => sendViaBrevo(to, content, channel) : null,
    hasCustomSmtp ? () => sendViaSmtp(to, content, channel) : null,
    hasGmail ? () => sendViaGmail(to, content, channel) : null,
  ].filter((fn): fn is () => Promise<SendOtpEmailResult> => fn !== null);

  const primaryResend = hasResend
    ? [() => sendViaResend(to, content, channel)]
    : [];

  // Dual Router:
  // - TEMP_MAIL tries non-Resend providers first (Gmail SMTP / SMTP2GO / SendPulse / Brevo), then Resend fallback
  // - ACTUAL_MAIL tries Resend first, with automatic fallback to any configured secondary provider
  const orderedSenders =
    channel === "TEMP_MAIL"
      ? [...secondarySenders, ...primaryResend]
      : [...primaryResend, ...secondarySenders];

  let lastResult: SendOtpEmailResult | null = null;
  for (const sendAttempt of orderedSenders) {
    const result = await sendAttempt();
    if (result.delivered) {
      return result;
    }
    console.warn(
      `[UniShare Mail][${result.provider}][${channel}] Failed for ${to}: ${result.error}`
    );
    lastResult = result;
  }

  if (lastResult) {
    return lastResult;
  }

  // Zero-config Ethereal Email fallback (only when NO live provider credentials are set)
  try {
    if (!globalForMail.__unishareEtherealAccount) {
      globalForMail.__unishareEtherealAccount =
        await nodemailer.createTestAccount();
    }
    const testAccount = globalForMail.__unishareEtherealAccount;
    const transporter = nodemailer.createTransport({
      host: testAccount.smtp.host,
      port: testAccount.smtp.port,
      secure: testAccount.smtp.secure,
      auth: {
        user: testAccount.user,
        pass: testAccount.pass,
      },
    });

    const info = await transporter.sendMail({
      from: `"UniShare" <${testAccount.user}>`,
      to,
      subject: content.subject,
      text: content.text,
      html: content.html,
    });

    const previewUrl = nodemailer.getTestMessageUrl(info) || undefined;
    console.info(
      `[UniShare Mail][ETHEREAL_TEST][${channel}] To: ${to} | Code: ${params.code} | Preview: ${previewUrl || "n/a"}`
    );

    return {
      delivered: true,
      provider: "ETHEREAL_TEST",
      channel,
      isLiveEmail: false,
      previewUrl,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Mail setup unavailable";
    return {
      delivered: false,
      provider: "ETHEREAL_TEST",
      channel,
      isLiveEmail: false,
      error: `No live email provider is configured (RESEND_API_KEY, GMAIL_USER, SMTP_HOST, or BREVO_API_KEY), and test mailbox failed: ${msg}`,
    };
  }
}
