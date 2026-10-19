import { NextRequest, NextResponse } from "next/server";
import { db } from "@/app/lib/db";
import {
  applySessionCookies,
  deriveNameFromEmail,
  normalizeEmail,
  PENDING_VERIFY_COOKIE,
  PendingVerifyPayload,
  setVerifiedAccountCookie,
  toPublicUser,
  verifySignedPayload,
} from "@/app/lib/auth";
import { consumeOtpCode } from "@/app/lib/otp-service";

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json().catch(() => ({}))) as {
      email?: string;
      code?: string;
    };

    const email = normalizeEmail(body.email || "");
    const code = (body.code || "").trim();

    if (!email) {
      return NextResponse.json(
        { error: "Email address is required." },
        { status: 400 }
      );
    }

    const pendingCookie = req.cookies.get(PENDING_VERIFY_COOKIE)?.value;
    const pendingPayload =
      verifySignedPayload<PendingVerifyPayload>(pendingCookie);
    const matchingPending =
      pendingPayload && pendingPayload.email === email ? pendingPayload : null;

    const consume = await consumeOtpCode({
      email,
      purpose: "EMAIL_VERIFY",
      code,
      fallbackCodeHash: matchingPending?.codeHash ?? null,
    });

    if (!consume.ok) {
      return NextResponse.json(
        { error: consume.error || "Invalid confirmation code." },
        { status: consume.status || 400 }
      );
    }

    let userRecord: {
      id: string;
      email: string;
      fullName: string;
      university: string | null;
      universityId: string | null;
      isCustomUniversity: boolean;
      studentId: string | null;
      passwordHash: string;
      emailVerified: boolean;
      verified: boolean;
      tokenBalance: number;
    } | null = null;

    try {
      const existing = await db.user.findUnique({ where: { email } });
      if (existing) {
        userRecord = await db.user.update({
          where: { email },
          data: {
            emailVerified: true,
            ...(matchingPending
              ? {
                  university: existing.university || matchingPending.university,
                  universityId:
                    existing.universityId || matchingPending.universityId,
                  isCustomUniversity: matchingPending.isCustomUniversity,
                }
              : {}),
          },
        });
      } else if (matchingPending) {
        userRecord = await db.user.create({
          data: {
            email,
            fullName: matchingPending.fullName || deriveNameFromEmail(email),
            university: matchingPending.university,
            universityId: matchingPending.universityId,
            isCustomUniversity: matchingPending.isCustomUniversity,
            passwordHash: matchingPending.passwordHash,
            emailVerified: true,
            verified: false,
            tokenBalance: 50,
          },
        });
      }
    } catch (err) {
      console.warn("Verify email DB update warning:", err);
    }

    if (!userRecord && matchingPending) {
      userRecord = {
        id: `u_${Buffer.from(email).toString("hex").slice(0, 12)}`,
        email,
        fullName: matchingPending.fullName || deriveNameFromEmail(email),
        university: matchingPending.university,
        universityId: matchingPending.universityId,
        isCustomUniversity: matchingPending.isCustomUniversity,
        studentId: null,
        passwordHash: matchingPending.passwordHash,
        emailVerified: true,
        verified: false,
        tokenBalance: 50,
      };
    }

    if (!userRecord) {
      return NextResponse.json(
        { error: "Account not found. Please register again." },
        { status: 404 }
      );
    }

    const publicUser = toPublicUser(userRecord);
    const res = NextResponse.json({
      ok: true,
      user: publicUser,
    });

    applySessionCookies(res, publicUser, true);
    setVerifiedAccountCookie(res, {
      email: publicUser.email,
      fullName: publicUser.fullName,
      university: publicUser.university,
      universityId: publicUser.universityId,
      isCustomUniversity: publicUser.isCustomUniversity,
      studentId: publicUser.studentId,
      passwordHash: userRecord.passwordHash,
      emailVerified: true,
      verified: userRecord.verified,
      tokenBalance: publicUser.tokenBalance,
    });
    res.cookies.set(PENDING_VERIFY_COOKIE, "", { path: "/", maxAge: 0 });

    return res;
  } catch (err) {
    console.error("Verify email API error:", err);
    return NextResponse.json(
      { error: "Unable to verify confirmation code right now." },
      { status: 500 }
    );
  }
}

