import { NextRequest, NextResponse } from "next/server";
import { db } from "@/app/lib/db";
import {
  applySessionCookies,
  canonicalizeEmail,
  DEMO_EMAIL,
  hashPassword,
  isValidEmail,
  normalizeEmail,
  recordKnownAccountCookie,
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
      gender: string | null;
      createdAt: Date | null;
      passwordHash: string;
      emailVerified: boolean;
      verified: boolean;
      tokenBalance: number;
    } | null = null;

    try {
      userRecord = await db.user.findUnique({ where: { email } });
      // Also support logging in with Gmail dot/+tag canonical equivalents if registered under an alias
      if (!userRecord) {
        const canonicalInput = canonicalizeEmail(email);
        const candidates = await db.user.findMany({
          where: { OR: [{ emailVerified: true }, { verified: true }] },
        });
        userRecord =
          candidates.find((u) => canonicalizeEmail(u.email) === canonicalInput) ??
          null;
      }
    } catch (err) {
      console.warn("Login DB lookup warning:", err);
    }

    const signedAccount = verifySignedPayload<VerifiedAccountPayload>(
      req.cookies.get(VERIFIED_ACCOUNT_COOKIE)?.value
    );
    const matchingSignedAccount =
      signedAccount &&
      canonicalizeEmail(signedAccount.email) === canonicalizeEmail(email)
        ? signedAccount
        : null;

    // Serverless cold-start fallback for verified user created in this browser session
    if (!userRecord && matchingSignedAccount) {
      const targetEmail = normalizeEmail(matchingSignedAccount.email);
      try {
        userRecord = await db.user.upsert({
          where: { email: targetEmail },
          update: {
            fullName: matchingSignedAccount.fullName,
            university: matchingSignedAccount.university,
            universityId: matchingSignedAccount.universityId,
            isCustomUniversity: matchingSignedAccount.isCustomUniversity,
            studentId: matchingSignedAccount.studentId,
            department: matchingSignedAccount.department ?? null,
            programme: matchingSignedAccount.programme ?? null,
            academicSession: matchingSignedAccount.academicSession ?? null,
            gender: matchingSignedAccount.gender ?? null,
            passwordHash: matchingSignedAccount.passwordHash,
            emailVerified: matchingSignedAccount.emailVerified,
            verified: matchingSignedAccount.verified,
          },
          create: {
            email: targetEmail,
            fullName: matchingSignedAccount.fullName,
            university: matchingSignedAccount.university,
            universityId: matchingSignedAccount.universityId,
            isCustomUniversity: matchingSignedAccount.isCustomUniversity,
            studentId: matchingSignedAccount.studentId,
            department: matchingSignedAccount.department ?? null,
            programme: matchingSignedAccount.programme ?? null,
            academicSession: matchingSignedAccount.academicSession ?? null,
            gender: matchingSignedAccount.gender ?? null,
            passwordHash: matchingSignedAccount.passwordHash,
            emailVerified: matchingSignedAccount.emailVerified,
            verified: matchingSignedAccount.verified,
            tokenBalance: matchingSignedAccount.tokenBalance,
          },
        });
      } catch {
        userRecord = {
          id: `u_${Buffer.from(targetEmail).toString("hex").slice(0, 12)}`,
          email: targetEmail,
          fullName: matchingSignedAccount.fullName,
          university: matchingSignedAccount.university,
          universityId: matchingSignedAccount.universityId,
          isCustomUniversity: matchingSignedAccount.isCustomUniversity,
          studentId: matchingSignedAccount.studentId,
          department: matchingSignedAccount.department ?? null,
          programme: matchingSignedAccount.programme ?? null,
          academicSession: matchingSignedAccount.academicSession ?? null,
          gender: matchingSignedAccount.gender ?? null,
          createdAt: matchingSignedAccount.createdAt
            ? new Date(matchingSignedAccount.createdAt)
            : new Date(),
          passwordHash: matchingSignedAccount.passwordHash,
          emailVerified: matchingSignedAccount.emailVerified,
          verified: matchingSignedAccount.verified,
          tokenBalance: matchingSignedAccount.tokenBalance,
        };
      }
    }

    // Guarantee pre-seeded demo account exists in DB cleanly so relational actions (listings/rentals/wallet) work
    if (!userRecord && email === DEMO_EMAIL) {
      const demoHash = hashPassword("password123");
      try {
        userRecord = await db.user.upsert({
          where: { email: DEMO_EMAIL },
          update: {
            emailVerified: true,
            verified: true,
            gender: "female",
          },
          create: {
            email: DEMO_EMAIL,
            fullName: "Farhana Rahman",
            university: "University of Dhaka",
            universityId: "du",
            isCustomUniversity: false,
            studentId: "2023-114-028",
            department: "Computer Science & Engineering",
            programme: "BSc (Honours)",
            academicSession: "2023–2024",
            gender: "female",
            passwordHash: demoHash,
            emailVerified: true,
            verified: true,
            tokenBalance: 420,
          },
        });
      } catch {
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
          gender: "female",
          createdAt: new Date("2026-10-14T00:00:00.000Z"),
          passwordHash: demoHash,
          emailVerified: true,
          verified: true,
          tokenBalance: 420,
        };
      }
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

    let passwordOk = verifyPassword(
      password,
      userRecord.passwordHash,
      userRecord.email
    );

    // If serverless DB had an older/placeholder hash while the signed verified-account cookie carries the updated hash, recover & sync DB
    if (
      !passwordOk &&
      matchingSignedAccount?.passwordHash &&
      verifyPassword(
        password,
        matchingSignedAccount.passwordHash,
        matchingSignedAccount.email
      )
    ) {
      passwordOk = true;
      userRecord = {
        ...userRecord,
        passwordHash: matchingSignedAccount.passwordHash,
        emailVerified: true,
        verified: userRecord.verified || matchingSignedAccount.verified,
      };
      try {
        await db.user.update({
          where: { email: userRecord.email },
          data: {
            passwordHash: matchingSignedAccount.passwordHash,
            emailVerified: true,
          },
        });
      } catch {
        // ignore ephemeral DB write errors
      }
    }

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
    recordKnownAccountCookie(req, res, publicUser.email);

    return res;
  } catch (err) {
    console.error("Login API error:", err);
    return NextResponse.json(
      { error: "Unable to log in right now. Please try again." },
      { status: 500 }
    );
  }
}

