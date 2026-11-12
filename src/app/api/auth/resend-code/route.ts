import { NextRequest, NextResponse } from "next/server";
import { db } from "@/app/lib/db";
import {
  canonicalizeEmail,
  DEMO_EMAIL,
  isValidEmail,
  normalizeEmail,
  OTP_EXPIRY_MS,
  OtpPurpose,
  PENDING_RESET_COOKIE,
  PENDING_VERIFY_COOKIE,
  PendingResetPayload,
  PendingVerifyPayload,
  signPayload,
  VERIFIED_ACCOUNT_COOKIE,
  VerifiedAccountPayload,
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

    if (purpose === "PASSWORD_RESET" && email === DEMO_EMAIL) {
      return NextResponse.json(
        { error: "The shared demo account password cannot be reset." },
        { status: 400 }
      );
    }

    const pendingVerify = verifySignedPayload<PendingVerifyPayload>(
      req.cookies.get(PENDING_VERIFY_COOKIE)?.value
    );
    const matchingPendingVerify =
      pendingVerify && canonicalizeEmail(pendingVerify.email) === canonicalizeEmail(email)
        ? pendingVerify
        : null;

    const signedAcc = verifySignedPayload<VerifiedAccountPayload>(
      req.cookies.get(VERIFIED_ACCOUNT_COOKIE)?.value
    );
    const matchingSignedAcc =
      signedAcc && canonicalizeEmail(signedAcc.email) === canonicalizeEmail(email)
        ? signedAcc
        : null;

    let targetEmail = email;
    let university = matchingPendingVerify?.university || matchingSignedAcc?.university;
    let accountFound = Boolean(
      purpose === "EMAIL_VERIFY" ? matchingPendingVerify : matchingSignedAcc
    );

    try {
      let user = await db.user.findUnique({
        where: { email },
        select: { id: true, email: true, university: true, emailVerified: true, verified: true },
      });
      if (!user) {
        const canonicalInput = canonicalizeEmail(email);
        const candidates = await db.user.findMany({
          select: { id: true, email: true, university: true, emailVerified: true, verified: true },
        });
        user = candidates.find((u) => canonicalizeEmail(u.email) === canonicalInput) ?? null;
      }
      if (user) {
        targetEmail = normalizeEmail(user.email);
        university = user.university || university;
        if (purpose === "PASSWORD_RESET") {
          accountFound = true;
        } else {
          accountFound = !user.emailVerified;
        }
      }
    } catch {
      // ignore DB lookup error
    }

    if (!accountFound) {
      return NextResponse.json(
        {
          error:
            purpose === "PASSWORD_RESET"
              ? "No registered account found for that email address."
              : "No pending unverified registration found for this email. Register or log in instead.",
        },
        { status: 404 }
      );
    }

    const otpRes = await issueOtpCode({
      email: targetEmail,
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
      email: targetEmail,
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
        email: targetEmail,
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

