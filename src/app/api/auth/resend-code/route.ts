import { NextRequest, NextResponse } from "next/server";
import { db } from "@/app/lib/db";
import {
  isValidEmail,
  normalizeEmail,
  OTP_EXPIRY_MS,
  OtpPurpose,
  PENDING_RESET_COOKIE,
  PENDING_VERIFY_COOKIE,
  PendingResetPayload,
  PendingVerifyPayload,
  signPayload,
  verifySignedPayload,
} from "@/app/lib/auth";
import { issueOtpCode } from "@/app/lib/otp-service";

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json().catch(() => ({}))) as {
      email?: string;
      purpose?: OtpPurpose;
    };

    const email = normalizeEmail(body.email || "");
    const purpose: OtpPurpose =
      body.purpose === "PASSWORD_RESET" ? "PASSWORD_RESET" : "EMAIL_VERIFY";

    if (!isValidEmail(email)) {
      return NextResponse.json(
        { error: "Please provide a valid email address." },
        { status: 400 }
      );
    }

    const pendingVerify = verifySignedPayload<PendingVerifyPayload>(
      req.cookies.get(PENDING_VERIFY_COOKIE)?.value
    );
    const matchingPendingVerify =
      pendingVerify && pendingVerify.email === email ? pendingVerify : null;

    let university = matchingPendingVerify?.university;
    try {
      const user = await db.user.findUnique({ where: { email } });
      if (user?.university) university = user.university;
    } catch {
      // ignore DB lookup error
    }

    const otpRes = await issueOtpCode({
      email,
      purpose,
      university,
      enforceCooldown: true,
    });

    if (!otpRes.ok || !otpRes.codeHash || !otpRes.mailResult) {
      return NextResponse.json(
        {
          error: otpRes.error || "Could not resend confirmation code.",
          retryAfterSeconds: otpRes.retryAfterSeconds,
        },
        { status: otpRes.status || 502 }
      );
    }

    const res = NextResponse.json({
      ok: true,
      email,
      provider: otpRes.mailResult.provider,
    });

    if (purpose === "EMAIL_VERIFY" && matchingPendingVerify) {
      const refreshedToken = signPayload<PendingVerifyPayload>({
        ...matchingPendingVerify,
        codeHash: otpRes.codeHash,
        exp: Date.now() + OTP_EXPIRY_MS,
      });
      res.cookies.set(PENDING_VERIFY_COOKIE, refreshedToken, {
        httpOnly: true,
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
        path: "/",
        maxAge: Math.floor(OTP_EXPIRY_MS / 1000),
      });
    }

    if (purpose === "PASSWORD_RESET") {
      const resetToken = signPayload<PendingResetPayload>({
        email,
        codeHash: otpRes.codeHash,
        exp: Date.now() + OTP_EXPIRY_MS,
      });
      res.cookies.set(PENDING_RESET_COOKIE, resetToken, {
        httpOnly: true,
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
        path: "/",
        maxAge: Math.floor(OTP_EXPIRY_MS / 1000),
      });
    }

    return res;
  } catch (err) {
    console.error("Resend code API error:", err);
    return NextResponse.json(
      { error: "Unable to resend confirmation code right now." },
      { status: 500 }
    );
  }
}

