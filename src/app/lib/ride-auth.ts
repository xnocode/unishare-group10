import { NextRequest } from "next/server";
import { db } from "@/app/lib/db";
import {
  SESSION_COOKIE,
  SessionPayload,
  verifySignedPayload,
  normalizeEmail,
} from "@/app/lib/auth";

export interface AuthenticatedUser {
  id: string;
  email: string;
  fullName: string;
  studentId: string | null;
  university: string | null;
  department: string | null;
  verified: boolean;
  tokenBalance: number;
}

/**
 * Extracts and verifies the authenticated student user from request session cookies or headers.
 * Supports:
 *  1. Signed unishare_session cookie (SessionPayload HMAC)
 *  2. x-user-email HTTP header
 *  3. Authorization: Bearer <email-or-token>
 *  4. unishare_user cookie JSON
 */
export async function getAuthenticatedRideUser(
  req: NextRequest
): Promise<AuthenticatedUser | null> {
  let email: string | null = null;

  // 1. Signed session cookie
  const sessionToken = req.cookies.get(SESSION_COOKIE)?.value;
  if (sessionToken) {
    const session = verifySignedPayload<SessionPayload>(sessionToken);
    if (session?.email) {
      email = session.email;
    }
  }

  // 2. x-user-email custom header
  if (!email) {
    const headerEmail = req.headers.get("x-user-email");
    if (headerEmail && headerEmail.trim()) {
      email = headerEmail.trim();
    }
  }

  // 3. Authorization header (Bearer token or email)
  if (!email) {
    const authHeader = req.headers.get("authorization");
    if (authHeader && authHeader.startsWith("Bearer ")) {
      const bearerVal = authHeader.slice(7).trim();
      const verified = verifySignedPayload<SessionPayload>(bearerVal);
      if (verified?.email) {
        email = verified.email;
      } else if (bearerVal.includes("@")) {
        email = bearerVal;
      }
    }
  }

  // 4. unishare_user cookie JSON fallback
  if (!email) {
    const userCookie = req.cookies.get("unishare_user")?.value;
    if (userCookie) {
      try {
        const parsed = JSON.parse(decodeURIComponent(userCookie));
        if (parsed.email) email = parsed.email;
      } catch {
        // ignore
      }
    }
  }

  // If no email was provided through any authentication mechanism
  if (!email) {
    return null;
  }

  email = normalizeEmail(email);

  try {
    const user = await db.user.findUnique({
      where: { email },
      select: {
        id: true,
        email: true,
        fullName: true,
        studentId: true,
        university: true,
        department: true,
        verified: true,
        tokenBalance: true,
      },
    });

    return user;
  } catch (err) {
    console.error("Error retrieving authenticated user for rides:", err);
    return null;
  }
}
