import { NextRequest, NextResponse } from "next/server";
import { db } from "@/app/lib/db";
import {
  applySessionCookies,
  isValidEmail,
  normalizeEmail,
  SESSION_COOKIE,
  SessionPayload,
  setVerifiedAccountCookie,
  toPublicUser,
  VERIFIED_ACCOUNT_COOKIE,
  VerifiedAccountPayload,
  verifySignedPayload,
} from "@/app/lib/auth";

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json().catch(() => ({}))) as {
      email?: string;
      fullName?: string;
      university?: string;
      studentId?: string;
      department?: string;
      programme?: string;
      academicSession?: string;
    };

    const session = verifySignedPayload<SessionPayload>(
      req.cookies.get(SESSION_COOKIE)?.value
    );
    const email = normalizeEmail(body.email || session?.email || "");

    if (!isValidEmail(email)) {
      return NextResponse.json(
        { error: "Valid university email is required." },
        { status: 400 }
      );
    }

    const fullName = (body.fullName || "").trim();
    const studentId = (body.studentId || "").trim();
    const department = (body.department || "").trim();
    const programme = (body.programme || "").trim();
    const academicSession = (body.academicSession || "").trim();
    const university = (body.university || session?.university || "").trim();

    if (!fullName || !studentId || !department) {
      return NextResponse.json(
        { error: "Please fill in your full name, student ID, and department." },
        { status: 400 }
      );
    }

    let updatedUser: {
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
        updatedUser = await db.user.update({
          where: { email },
          data: {
            fullName,
            studentId,
            department,
            programme,
            academicSession,
            ...(university ? { university } : {}),
            emailVerified: true,
          },
        });
      }
    } catch (err) {
      console.warn("Student verification DB warning:", err);
    }

    const signedAccount = verifySignedPayload<VerifiedAccountPayload>(
      req.cookies.get(VERIFIED_ACCOUNT_COOKIE)?.value
    );
    const matchingAccount =
      signedAccount && signedAccount.email === email ? signedAccount : null;

    if (!updatedUser && matchingAccount) {
      updatedUser = {
        id: session?.userId || `u_${Buffer.from(email).toString("hex").slice(0, 12)}`,
        email,
        fullName,
        university: university || matchingAccount.university,
        universityId: matchingAccount.universityId,
        isCustomUniversity: matchingAccount.isCustomUniversity,
        studentId,
        passwordHash: matchingAccount.passwordHash,
        emailVerified: true,
        verified: matchingAccount.verified,
        tokenBalance: matchingAccount.tokenBalance,
      };
    }

    const publicUser = updatedUser
      ? toPublicUser(updatedUser)
      : toPublicUser({
          id: session?.userId || `u_${Buffer.from(email).toString("hex").slice(0, 12)}`,
          email,
          fullName,
          university: university || "University of Dhaka",
          studentId,
          verified: false,
          emailVerified: true,
          tokenBalance: 50,
        });

    const res = NextResponse.json({ ok: true, user: publicUser });
    applySessionCookies(res, publicUser, true);

    if (updatedUser?.passwordHash) {
      setVerifiedAccountCookie(res, {
        email: publicUser.email,
        fullName: publicUser.fullName,
        university: publicUser.university,
        universityId: publicUser.universityId,
        isCustomUniversity: publicUser.isCustomUniversity,
        studentId: publicUser.studentId,
        passwordHash: updatedUser.passwordHash,
        emailVerified: publicUser.emailVerified,
        verified: publicUser.verified,
        tokenBalance: publicUser.tokenBalance,
      });
    }

    return res;
  } catch (err) {
    console.error("Student verification API error:", err);
    return NextResponse.json(
      { error: "Unable to save student details right now." },
      { status: 500 }
    );
  }
}

