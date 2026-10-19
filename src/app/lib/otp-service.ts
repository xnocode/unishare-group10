import { db } from "./db";
import {
  generateOtpCode,
  hashOtpCode,
  MAX_OTP_ATTEMPTS,
  normalizeEmail,
  OTP_EXPIRY_MS,
  OtpPurpose,
  RESEND_COOLDOWN_MS,
  verifyOtpHash,
} from "./auth";
import { sendOtpEmail, type SendOtpEmailResult } from "./mailer";

export interface IssueOtpResult {
  ok: boolean;
  codeHash?: string;
  mailResult?: SendOtpEmailResult;
  error?: string;
  retryAfterSeconds?: number;
  status?: number;
}

export async function issueOtpCode(params: {
  email: string;
  purpose: OtpPurpose;
  university?: string;
  isCustomUniversity?: boolean;
  enforceCooldown?: boolean;
}): Promise<IssueOtpResult> {
  const email = normalizeEmail(params.email);

  if (params.enforceCooldown) {
    try {
      const latest = await db.authVerificationCode.findFirst({
        where: { email, purpose: params.purpose, consumedAt: null },
        orderBy: { createdAt: "desc" },
      });
      if (latest) {
        const elapsed = Date.now() - latest.createdAt.getTime();
        if (elapsed < RESEND_COOLDOWN_MS) {
          const waitSec = Math.ceil((RESEND_COOLDOWN_MS - elapsed) / 1000);
          return {
            ok: false,
            error: `Please wait ${waitSec}s before requesting another code.`,
            retryAfterSeconds: waitSec,
            status: 429,
          };
        }
      }
    } catch (err) {
      console.warn("OTP cooldown DB lookup warning:", err);
    }
  }

  const code = generateOtpCode();
  const codeHash = hashOtpCode(email, params.purpose, code);
  const expiresAt = new Date(Date.now() + OTP_EXPIRY_MS);

  try {
    await db.authVerificationCode.updateMany({
      where: { email, purpose: params.purpose, consumedAt: null },
      data: { consumedAt: new Date() },
    });
    await db.authVerificationCode.create({
      data: {
        email,
        purpose: params.purpose,
        codeHash,
        expiresAt,
      },
    });
  } catch (err) {
    console.warn("OTP DB store warning (signed cookie fallback active):", err);
  }

  const mailResult = await sendOtpEmail({
    to: email,
    code,
    purpose: params.purpose,
    university: params.university,
    isCustomUniversity: params.isCustomUniversity,
  });

  if (!mailResult.delivered) {
    return {
      ok: false,
      error:
        mailResult.error ||
        "Unable to send verification email right now. Please try again.",
      mailResult,
      status: 502,
    };
  }

  return { ok: true, codeHash, mailResult };
}

export interface ConsumeOtpResult {
  ok: boolean;
  error?: string;
  status?: number;
  usedFallbackCookie?: boolean;
}

export async function consumeOtpCode(params: {
  email: string;
  purpose: OtpPurpose;
  code: string;
  fallbackCodeHash?: string | null;
}): Promise<ConsumeOtpResult> {
  const email = normalizeEmail(params.email);
  const cleanedCode = params.code.trim();

  if (!/^\d{6}$/.test(cleanedCode)) {
    return {
      ok: false,
      error: "Please enter all 6 digits of your confirmation code.",
      status: 400,
    };
  }

  try {
    const active = await db.authVerificationCode.findFirst({
      where: {
        email,
        purpose: params.purpose,
        consumedAt: null,
      },
      orderBy: { createdAt: "desc" },
    });

    if (active) {
      if (active.expiresAt.getTime() < Date.now()) {
        return {
          ok: false,
          error: "That code has expired. Click “Resend code” for a fresh one.",
          status: 400,
        };
      }

      if (active.attempts >= MAX_OTP_ATTEMPTS) {
        return {
          ok: false,
          error: "Too many incorrect attempts. Please request a new code.",
          status: 429,
        };
      }

      if (!verifyOtpHash(email, params.purpose, cleanedCode, active.codeHash)) {
        await db.authVerificationCode.update({
          where: { id: active.id },
          data: { attempts: { increment: 1 } },
        });
        return {
          ok: false,
          error: "Incorrect code. Double-check the 6 digits sent to your email.",
          status: 400,
        };
      }

      await db.authVerificationCode.update({
        where: { id: active.id },
        data: { consumedAt: new Date() },
      });

      return { ok: true };
    }
  } catch (err) {
    console.warn("OTP DB verify warning:", err);
  }

  // Serverless ephemeral DB fallback via HMAC-signed HttpOnly cookie
  if (
    params.fallbackCodeHash &&
    verifyOtpHash(email, params.purpose, cleanedCode, params.fallbackCodeHash)
  ) {
    return { ok: true, usedFallbackCookie: true };
  }

  return {
    ok: false,
    error: params.fallbackCodeHash
      ? "Incorrect or expired code. Please check your email or resend a new code."
      : "No active confirmation code found for this email. Request a new code.",
    status: 400,
  };
}

