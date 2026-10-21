import { NextRequest, NextResponse } from "next/server";
import { db } from "@/app/lib/db";
import {
  applySessionCookies,
  DEMO_EMAIL,
  hashPassword,
  isValidEmail,
  normalizeEmail,
  setVerifiedAccountCookieFromUser,
  toPublicUser,
  VERIFIED_ACCOUNT_COOKIE,
  VerifiedAccountPayload,
  verifyPassword,
  verifySignedPayload,
} from "@/app/lib/auth";

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json().catch(() => ({}))) as {
      email?: string;
      password?: string;
      rememberMe?: boolean;
    };

    const email = normalizeEmail(body.email || "");
    const password = body.password || "";
    const rememberMe = body.rememberMe !== false;

    if (!isValidEmail(email) || !password) {
      return NextResponse.json(
        { error: "Please enter both your email address and password." },
        { status: 400 }
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
      department: string | null;
      programme: string | null;
      academicSession: string | null;
      createdAt: Date | null;
      passwordHash: string;
      emailVerified: boolean;
      verified: boolean;
      tokenBalance: number;
    } | null = null;

    try {
      userRecord = await db.user.findUnique({ where: { email } });
    } catch (err) {
      console.warn("Login DB lookup warning:", err);
    }

    // Serverless cold-start fallback for verified user created in this browser session
    if (!userRecord) {
      const signedAccount = verifySignedPayload<VerifiedAccountPayload>(
        req.cookies.get(VERIFIED_ACCOUNT_COOKIE)?.value
      );
      if (signedAccount && signedAccount.email === email) {
        try {
          userRecord = await db.user.upsert({
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
              passwordHash: signedAccount.passwordHash,
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
              passwordHash: signedAccount.passwordHash,
              emailVerified: signedAccount.emailVerified,
              verified: signedAccount.verified,
              tokenBalance: signedAccount.tokenBalance,
            },
          });
        } catch {
          userRecord = {
            id: `u_${Buffer.from(email).toString("hex").slice(0, 12)}`,
            email,
            fullName: signedAccount.fullName,
            university: signedAccount.university,
            universityId: signedAccount.universityId,
            isCustomUniversity: signedAccount.isCustomUniversity,
            studentId: signedAccount.studentId,
            department: signedAccount.department ?? null,
            programme: signedAccount.programme ?? null,
            academicSession: signedAccount.academicSession ?? null,
            createdAt: signedAccount.createdAt ? new Date(signedAccount.createdAt) : new Date(),
            passwordHash: signedAccount.passwordHash,
            emailVerified: signedAccount.emailVerified,
            verified: signedAccount.verified,
            tokenBalance: signedAccount.tokenBalance,
          };
        }
      }
    }

    // Guarantee pre-seeded demo account availability even on fresh ephemeral DB
    if (!userRecord && email === DEMO_EMAIL) {
      const demoHash = hashPassword("password123");
      userRecord = {
        id: "demo-farhana",
        email: DEMO_EMAIL,
        fullName: "Farhana Rahman",
        university: "University of Dhaka",
        universityId: "du",
        isCustomUniversity: false,
        studentId: "2023-114-028",
        department: "Computer Science & Engineering",
        programme: "BSc (Honours)",
        academicSession: "2023–2024",
        createdAt: new Date("2026-10-14T00:00:00.000Z"),
        passwordHash: demoHash,
        emailVerified: true,
        verified: true,
        tokenBalance: 420,
      };
    }

    if (!userRecord) {
      return NextResponse.json(
        {
          error:
            "No account found with this email. Create an account first.",
        },
        { status: 401 }
      );
    }

    const passwordOk = verifyPassword(
      password,
      userRecord.passwordHash,
      userRecord.email
    );
    if (!passwordOk) {
      return NextResponse.json(
        { error: "Incorrect email or password." },
        { status: 401 }
      );
    }

    if (!userRecord.emailVerified && !userRecord.verified) {
      return NextResponse.json(
        {
          error:
            "Please confirm your email address with the 6-digit code before logging in.",
          needsEmailVerification: true,
          email: userRecord.email,
        },
        { status: 403 }
      );
    }

    const publicUser = toPublicUser(userRecord);
    const res = NextResponse.json({
      ok: true,
      user: publicUser,
    });

    applySessionCookies(res, publicUser, rememberMe);
    setVerifiedAccountCookieFromUser(res, publicUser, userRecord.passwordHash);

    return res;
  } catch (err) {
    console.error("Login API error:", err);
    return NextResponse.json(
      { error: "Unable to log in right now. Please try again." },
      { status: 500 }
    );
  }
}

