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
 * In production, only cryptographically signed SESSION_COOKIE (or signed Bearer token) is trusted
 * so unauthenticated callers cannot spoof another student via `x-user-email` or client cookies.
 */
async function resolveUserByEmail(
  req: NextRequest,
  rawEmail: string
): Promise<AuthenticatedUser | null> {
  const email = normalizeEmail(rawEmail);

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

/** Strict cryptographic session verification for sensitive mutations (KYC, uploads, wallet, rentals). */
export async function getAuthenticatedSessionUser(
  req: NextRequest
): Promise<AuthenticatedUser | null> {
  let email: string | null = null;

  const sessionToken = req.cookies.get(SESSION_COOKIE)?.value;
  if (sessionToken) {
    const session = verifySignedPayload<SessionPayload>(sessionToken);
    if (session?.email) {
      email = session.email;
    }
  }

  if (!email) {
    const authHeader = req.headers.get("authorization");
    if (authHeader && authHeader.startsWith("Bearer ")) {
      const verified = verifySignedPayload<SessionPayload>(
        authHeader.slice(7).trim()
      );
      if (verified?.email) {
        email = verified.email;
      }
    }
  }

  if (!email) return null;
  return resolveUserByEmail(req, email);
}

export async function getAuthenticatedRideUser(
  req: NextRequest
): Promise<AuthenticatedUser | null> {
  const strictUser = await getAuthenticatedSessionUser(req);
  if (strictUser) return strictUser;

  // Unsigned fallbacks are strictly disabled in production to prevent email header impersonation.
  if (process.env.NODE_ENV === "production") {
    return null;
  }

  let email: string | null = null;
  const headerEmail = req.headers.get("x-user-email");
  if (headerEmail && headerEmail.trim()) {
    email = headerEmail.trim();
  }

  if (!email) {
    const authHeader = req.headers.get("authorization");
    if (authHeader && authHeader.startsWith("Bearer ")) {
      const bearerVal = authHeader.slice(7).trim();
      if (bearerVal.includes("@")) {
        email = bearerVal;
      }
    }
  }

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

  if (!email) return null;
  return resolveUserByEmail(req, email);
}
