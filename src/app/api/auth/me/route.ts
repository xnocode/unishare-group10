import { NextRequest, NextResponse } from "next/server";
import { db } from "@/app/lib/db";
import {
  SESSION_COOKIE,
  SessionPayload,
  VERIFIED_ACCOUNT_COOKIE,
  VerifiedAccountPayload,
  toPublicUser,
  verifySignedPayload,
} from "@/app/lib/auth";

export async function GET(req: NextRequest) {
  const sessionToken = req.cookies.get(SESSION_COOKIE)?.value;
  const session = verifySignedPayload<SessionPayload>(sessionToken);

  if (!session) {
    return NextResponse.json({ ok: false, user: null }, { status: 401 });
  }

  try {
    const dbUser = await db.user.findUnique({ where: { email: session.email } });
    if (dbUser) {
      return NextResponse.json({ ok: true, user: toPublicUser(dbUser) });
    }
  } catch (err) {
    console.warn("/api/auth/me DB warning:", err);
  }

  const verifiedCookie = verifySignedPayload<VerifiedAccountPayload>(
    req.cookies.get(VERIFIED_ACCOUNT_COOKIE)?.value
  );
  const matchingCookie =
    verifiedCookie &&
    verifiedCookie.email.toLowerCase() === session.email.toLowerCase()
      ? verifiedCookie
      : null;

  return NextResponse.json({
    ok: true,
    user: toPublicUser({
      id: session.userId,
      email: session.email,
      fullName: matchingCookie?.fullName || session.fullName,
      university: matchingCookie?.university || session.university,
      universityId: matchingCookie?.universityId,
      isCustomUniversity: matchingCookie?.isCustomUniversity,
      studentId: matchingCookie?.studentId ?? null,
      department: matchingCookie?.department ?? null,
      programme: matchingCookie?.programme ?? null,
      academicSession: matchingCookie?.academicSession ?? null,
      createdAt: matchingCookie?.createdAt ?? null,
      verified: matchingCookie?.verified ?? session.verified,
      emailVerified: matchingCookie?.emailVerified ?? session.emailVerified,
      tokenBalance: matchingCookie?.tokenBalance ?? 50,
    }),
  });
}

// PATCH /api/auth/me — Self-declare profile gender securely
export async function PATCH(req: NextRequest) {
  const sessionToken = req.cookies.get(SESSION_COOKIE)?.value;
  const session = verifySignedPayload<SessionPayload>(sessionToken);

  if (!session) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const gender = typeof body.gender === "string" ? body.gender.trim().toLowerCase() : null;

    if (gender && !["female", "male", "other"].includes(gender)) {
      return NextResponse.json(
        { ok: false, error: "Gender must be 'female', 'male', or 'other'." },
        { status: 400 }
      );
    }

    const updated = await db.user.update({
      where: { email: session.email },
      data: { gender },
    });

    return NextResponse.json({
      ok: true,
      message: "Profile gender updated successfully.",
      user: toPublicUser(updated),
    });
  } catch (err) {
    console.error("PATCH /api/auth/me error:", err);
    return NextResponse.json({ ok: false, error: "Failed to update profile." }, { status: 500 });
  }
}


