import { NextRequest } from "next/server";
import { db } from "@/app/lib/db";
import {
  SESSION_COOKIE,
  SessionPayload,
  VERIFIED_ACCOUNT_COOKIE,
  VerifiedAccountPayload,
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
  gender: string | null;
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
    let user = await db.user.findUnique({
      where: { email },
      select: {
        id: true,
        email: true,
        fullName: true,
        studentId: true,
        university: true,
        department: true,
        gender: true,
        verified: true,
        tokenBalance: true,
      },
    });

    // Recover authenticated user from signed VERIFIED_ACCOUNT_COOKIE on fresh/ephemeral DB instances
    if (!user) {
      const signedAccount = verifySignedPayload<VerifiedAccountPayload>(
        req.cookies.get(VERIFIED_ACCOUNT_COOKIE)?.value
      );
      if (signedAccount && normalizeEmail(signedAccount.email) === email) {
        user = await db.user.upsert({
          where: { email },
          update: {
            fullName: signedAccount.fullName,
            university: signedAccount.university,
            universityId: signedAccount.universityId,
            isCustomUniversity: signedAccount.isCustomUniversity,
            studentId: signedAccount.studentId,
            department: signedAccount.department ?? null,
            programme: signedAccount.programme ?? null,
            academicSession: signedAccount.academicSession ?? null,
            gender: signedAccount.gender ?? null,
            emailVerified: signedAccount.emailVerified,
            verified: signedAccount.verified,
          },
          create: {
            email,
            fullName: signedAccount.fullName,
            university: signedAccount.university,
            universityId: signedAccount.universityId,
            isCustomUniversity: signedAccount.isCustomUniversity,
            studentId: signedAccount.studentId,
            department: signedAccount.department ?? null,
            programme: signedAccount.programme ?? null,
            academicSession: signedAccount.academicSession ?? null,
            gender: signedAccount.gender ?? null,
            passwordHash: signedAccount.passwordHash,
            emailVerified: signedAccount.emailVerified,
            verified: signedAccount.verified,
            tokenBalance: signedAccount.tokenBalance ?? 50,
          },
          select: {
            id: true,
            email: true,
            fullName: true,
            studentId: true,
            university: true,
            department: true,
            gender: true,
            verified: true,
            tokenBalance: true,
          },
        });
      }
    }

    return user;
  } catch (err) {
    console.error("Error retrieving authenticated user for rides:", err);
    return null;
  }
}
