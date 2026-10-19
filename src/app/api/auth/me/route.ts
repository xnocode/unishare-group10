import { NextRequest, NextResponse } from "next/server";
import { db } from "@/app/lib/db";
import {
  SESSION_COOKIE,
  SessionPayload,
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

  return NextResponse.json({
    ok: true,
    user: toPublicUser({
      id: session.userId,
      email: session.email,
      fullName: session.fullName,
      university: session.university,
      verified: session.verified,
      emailVerified: session.emailVerified,
      tokenBalance: 50,
    }),
  });
}

