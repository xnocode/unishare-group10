import { NextRequest, NextResponse } from "next/server";
import { db } from "@/app/lib/db";
import {
  canonicalizeEmail,
  hashPassword,
  isValidEmail,
  normalizeEmail,
  PENDING_RESET_COOKIE,
  PendingResetPayload,
  recordKnownAccountCookie,
  setVerifiedAccountCookie,
  setVerifiedAccountCookieFromUser,
  toPublicUser,
  VERIFIED_ACCOUNT_COOKIE,
  VerifiedAccountPayload,
  verifySignedPayload,
} from "@/app/lib/auth";
import { consumeOtpCode } from "@/app/lib/otp-service";
import { validatePasswordChoice } from "@/app/lib/validation";

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

    const pwCheck = validatePasswordChoice(password);
    if (!pwCheck.valid) {
      return NextResponse.json(
        { error: pwCheck.error || "Password needs 8+ characters, a letter, and a number." },
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
      id: string;
      email: string;
      fullName: string;
      university: string | null;
      universityId: string | null;
      isCustomUniversity: boolean;
      studentId: string | null;
      department: string | null;
      programme: string | null;
      academicSession: string | null;
      createdAt: Date | null;
      emailVerified: boolean;
      verified: boolean;
      tokenBalance: number;
    } | null = null;

    try {
      let existing = await db.user.findUnique({ where: { email } });
      if (!existing) {
        const canonicalInput = canonicalizeEmail(email);
        const candidates = await db.user.findMany({
          where: { OR: [{ emailVerified: true }, { verified: true }] },
        });
        existing =
          candidates.find((u) => canonicalizeEmail(u.email) === canonicalInput) ??
          null;
      }
      if (existing) {
        savedUser = await db.user.update({
          where: { id: existing.id },
          data: { passwordHash: newHash, emailVerified: true },
        });
      }
    } catch (err) {
      console.warn("Reset password DB update warning:", err);
    }

    const signedAcc = verifySignedPayload<VerifiedAccountPayload>(
      req.cookies.get(VERIFIED_ACCOUNT_COOKIE)?.value
    );

    if (!savedUser && (!signedAcc || canonicalizeEmail(signedAcc.email) !== canonicalizeEmail(email))) {
      return NextResponse.json(
        { error: "No matching registered account found for password reset." },
        { status: 404 }
      );
    }

    const res = NextResponse.json({ ok: true });
    res.cookies.set(PENDING_RESET_COOKIE, "", {
      path: "/",
      maxAge: 0,
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
    });

    if (savedUser) {
      setVerifiedAccountCookieFromUser(res, toPublicUser(savedUser), newHash);
    } else if (signedAcc) {
      setVerifiedAccountCookie(res, {
        ...signedAcc,
        passwordHash: newHash,
        emailVerified: true,
      });
    }

    recordKnownAccountCookie(req, res, email);

    return res;
  } catch (err) {
    console.error("Reset password API error:", err);
    return NextResponse.json(
      { error: "Unable to reset password right now." },
      { status: 500 }
    );
  }
}

