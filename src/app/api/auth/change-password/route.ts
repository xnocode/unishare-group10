import { NextRequest, NextResponse } from "next/server";
import { db } from "@/app/lib/db";
import {
  DEMO_EMAIL,
  hashPassword,
  recordKnownAccountCookie,
  SESSION_COOKIE,
  SessionPayload,
  setVerifiedAccountCookieFromUser,
  toPublicUser,
  VERIFIED_ACCOUNT_COOKIE,
  VerifiedAccountPayload,
  verifyPassword,
  verifySignedPayload,
} from "@/app/lib/auth";
import { validatePasswordChoice } from "@/app/lib/validation";

/** POST /api/auth/change-password — Update password for the authenticated student. */
export async function POST(req: NextRequest) {
  const session = verifySignedPayload<SessionPayload>(
    req.cookies.get(SESSION_COOKIE)?.value
  );

  if (!session) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  if (session.email.toLowerCase() === DEMO_EMAIL) {
    return NextResponse.json(
      {
        ok: false,
        error: "The shared demo account password cannot be modified.",
      },
      { status: 400 }
    );
  }

  try {
    const body = (await req.json().catch(() => ({}))) as {
      currentPassword?: string;
      newPassword?: string;
    };

    const currentPassword = body.currentPassword || "";
    const newPassword = body.newPassword || "";

    if (!currentPassword || !newPassword) {
      return NextResponse.json(
        { ok: false, error: "Enter both your current password and new password." },
        { status: 400 }
      );
    }

    const pwCheck = validatePasswordChoice(newPassword);
    if (!pwCheck.valid) {
      return NextResponse.json(
        { ok: false, error: pwCheck.error || "Choose a stronger password." },
        { status: 400 }
      );
    }

    if (currentPassword === newPassword) {
      return NextResponse.json(
        {
          ok: false,
          error: "New password must be different from your current password.",
        },
        { status: 400 }
      );
    }

    const verifiedCookie = verifySignedPayload<VerifiedAccountPayload>(
      req.cookies.get(VERIFIED_ACCOUNT_COOKIE)?.value
    );
    const matchingCookie =
      verifiedCookie &&
      verifiedCookie.email.toLowerCase() === session.email.toLowerCase()
        ? verifiedCookie
        : null;

    let dbUser = null;
    try {
      dbUser = await db.user.findUnique({ where: { email: session.email } });
    } catch (err) {
      console.warn("Change password DB lookup warning:", err);
    }

    const activeHash = dbUser?.passwordHash || matchingCookie?.passwordHash || "";
    if (!verifyPassword(currentPassword, activeHash, session.email)) {
      return NextResponse.json(
        { ok: false, error: "Current password is incorrect." },
        { status: 401 }
      );
    }

    const newHash = hashPassword(newPassword);
    let updatedPublic = matchingCookie
      ? toPublicUser({
          id: session.userId,
          email: session.email,
          fullName: matchingCookie.fullName,
          university: matchingCookie.university,
          universityId: matchingCookie.universityId,
          isCustomUniversity: matchingCookie.isCustomUniversity,
          studentId: matchingCookie.studentId,
          department: matchingCookie.department,
          programme: matchingCookie.programme,
          academicSession: matchingCookie.academicSession,
          gender: matchingCookie.gender,
          createdAt: matchingCookie.createdAt,
          verified: matchingCookie.verified,
          emailVerified: matchingCookie.emailVerified,
          tokenBalance: matchingCookie.tokenBalance,
        })
      : null;

    if (dbUser) {
      try {
        const saved = await db.user.update({
          where: { email: session.email },
          data: { passwordHash: newHash },
        });
        updatedPublic = toPublicUser(saved);
      } catch (err) {
        console.warn("Change password DB update warning:", err);
      }
    }

    const res = NextResponse.json({
      ok: true,
      message: "Password updated successfully.",
    });

    if (updatedPublic) {
      setVerifiedAccountCookieFromUser(res, updatedPublic, newHash);
    }
    recordKnownAccountCookie(req, res, session.email);

    return res;
  } catch (err) {
    console.error("POST /api/auth/change-password error:", err);
    return NextResponse.json(
      { ok: false, error: "Unable to update password right now." },
      { status: 500 }
    );
  }
}

