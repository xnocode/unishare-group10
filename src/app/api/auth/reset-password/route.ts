import { NextRequest, NextResponse } from "next/server";
import { db } from "@/app/lib/db";
import {
  deriveNameFromEmail,
  hashPassword,
  isValidEmail,
  isValidPassword,
  normalizeEmail,
  PENDING_RESET_COOKIE,
  PendingResetPayload,
  setVerifiedAccountCookie,
  VERIFIED_ACCOUNT_COOKIE,
  VerifiedAccountPayload,
  verifySignedPayload,
} from "@/app/lib/auth";
import { consumeOtpCode } from "@/app/lib/otp-service";

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json().catch(() => ({}))) as {
      email?: string;
      code?: string;
      password?: string;
    };

    const email = normalizeEmail(body.email || "");
    const code = (body.code || "").trim();
    const password = body.password || "";

    if (!isValidEmail(email)) {
      return NextResponse.json(
        { error: "Valid email address is required." },
        { status: 400 }
      );
    }

    if (!isValidPassword(password)) {
      return NextResponse.json(
        { error: "Password needs 8+ characters, a letter, and a number." },
        { status: 400 }
      );
    }

    const pendingReset = verifySignedPayload<PendingResetPayload>(
      req.cookies.get(PENDING_RESET_COOKIE)?.value
    );
    const matchingPending =
      pendingReset && pendingReset.email === email ? pendingReset : null;

    const consume = await consumeOtpCode({
      email,
      purpose: "PASSWORD_RESET",
      code,
      fallbackCodeHash: matchingPending?.codeHash ?? null,
    });

    if (!consume.ok) {
      return NextResponse.json(
        { error: consume.error || "Invalid reset code." },
        { status: consume.status || 400 }
      );
    }

    const newHash = hashPassword(password);
    let savedUser: {
      email: string;
      fullName: string;
      university: string | null;
      universityId: string | null;
      isCustomUniversity: boolean;
      studentId: string | null;
      emailVerified: boolean;
      verified: boolean;
      tokenBalance: number;
    } | null = null;

    try {
      const existing = await db.user.findUnique({ where: { email } });
      if (existing) {
        savedUser = await db.user.update({
          where: { email },
          data: { passwordHash: newHash, emailVerified: true },
        });
      }
    } catch (err) {
      console.warn("Reset password DB update warning:", err);
    }

    const signedAcc = verifySignedPayload<VerifiedAccountPayload>(
      req.cookies.get(VERIFIED_ACCOUNT_COOKIE)?.value
    );

    const res = NextResponse.json({ ok: true });
    res.cookies.set(PENDING_RESET_COOKIE, "", { path: "/", maxAge: 0 });

    if (savedUser) {
      setVerifiedAccountCookie(res, {
        email: savedUser.email,
        fullName: savedUser.fullName,
        university: savedUser.university || "University of Dhaka",
        universityId: savedUser.universityId || "du",
        isCustomUniversity: savedUser.isCustomUniversity,
        studentId: savedUser.studentId,
        passwordHash: newHash,
        emailVerified: true,
        verified: savedUser.verified,
        tokenBalance: savedUser.tokenBalance,
      });
    } else if (signedAcc && signedAcc.email === email) {
      setVerifiedAccountCookie(res, {
        ...signedAcc,
        passwordHash: newHash,
        emailVerified: true,
      });
    } else {
      setVerifiedAccountCookie(res, {
        email,
        fullName: deriveNameFromEmail(email),
        university: "University of Dhaka",
        universityId: "du",
        isCustomUniversity: false,
        studentId: null,
        passwordHash: newHash,
        emailVerified: true,
        verified: false,
        tokenBalance: 50,
      });
    }

    return res;
  } catch (err) {
    console.error("Reset password API error:", err);
    return NextResponse.json(
      { error: "Unable to reset password right now." },
      { status: 500 }
    );
  }
}

