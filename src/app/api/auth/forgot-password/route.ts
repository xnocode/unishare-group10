import { NextRequest, NextResponse } from "next/server";
import { db } from "@/app/lib/db";
import {
  DEMO_EMAIL,
  isValidEmail,
  normalizeEmail,
  OTP_EXPIRY_MS,
  PENDING_RESET_COOKIE,
  PendingResetPayload,
  signPayload,
  VERIFIED_ACCOUNT_COOKIE,
  VerifiedAccountPayload,
  verifySignedPayload,
} from "@/app/lib/auth";
import { issueOtpCode } from "@/app/lib/otp-service";

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json().catch(() => ({}))) as { email?: string };
    const email = normalizeEmail(body.email || "");

    if (!isValidEmail(email)) {
      return NextResponse.json(
        { error: "Please enter a valid email address." },
        { status: 400 }
      );
    }

    let university: string | undefined;
    let isCustomUniversity = false;
    let found = false;

    try {
      const user = await db.user.findUnique({ where: { email } });
      if (user) {
        found = true;
        university = user.university || undefined;
        isCustomUniversity = user.isCustomUniversity;
      }
    } catch (err) {
      console.warn("Forgot password DB lookup warning:", err);
    }

    if (!found) {
      const cookieAcc = verifySignedPayload<VerifiedAccountPayload>(
        req.cookies.get(VERIFIED_ACCOUNT_COOKIE)?.value
      );
      if (cookieAcc && cookieAcc.email === email) {
        found = true;
        university = cookieAcc.university;
        isCustomUniversity = cookieAcc.isCustomUniversity;
      } else if (email === DEMO_EMAIL) {
        found = true;
        university = "University of Dhaka";
      }
    }

    if (!found) {
      return NextResponse.json(
        { error: "No UniShare account found with that email address." },
        { status: 404 }
      );
    }

    const otpRes = await issueOtpCode({
      email,
      purpose: "PASSWORD_RESET",
      university,
      isCustomUniversity,
      enforceCooldown: true,
    });

    if (!otpRes.ok || !otpRes.codeHash || !otpRes.mailResult) {
      return NextResponse.json(
        { error: otpRes.error || "Failed to send password reset code." },
        { status: otpRes.status || 502 }
      );
    }

    const res = NextResponse.json({
      ok: true,
      email,
      provider: otpRes.mailResult.provider,
      isLiveEmail: otpRes.mailResult.isLiveEmail,
      previewUrl: otpRes.mailResult.previewUrl,
    });

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

    return res;
  } catch (err) {
    console.error("Forgot password API error:", err);
    return NextResponse.json(
      { error: "Unable to send reset code right now." },
      { status: 500 }
    );
  }
}

