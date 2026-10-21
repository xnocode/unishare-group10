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

