import { NextRequest, NextResponse } from "next/server";
import { db } from "@/app/lib/db";
import {
  applySessionCookies,
  DEMO_EMAIL,
  isValidEmail,
  normalizeEmail,
  SESSION_COOKIE,
  SessionPayload,
  setVerifiedAccountCookieFromUser,
  toPublicUser,
  VERIFIED_ACCOUNT_COOKIE,
  VerifiedAccountPayload,
  verifySignedPayload,
} from "@/app/lib/auth";
import {
  validateDepartment,
  validateFullName,
  validateStudentId,
} from "@/app/lib/validation";

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
      idCardFileName?: string;
      faceFileName?: string;
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

    const nameCheck = validateFullName(body.fullName || "");
    if (!nameCheck.valid) {
      return NextResponse.json(
        { error: nameCheck.error || "Please enter your real full name." },
        { status: 400 }
      );
    }

    const idCheck = validateStudentId(body.studentId || "");
    if (!idCheck.valid) {
      return NextResponse.json(
        { error: idCheck.error || "Please enter your genuine student ID." },
        { status: 400 }
      );
    }

    const deptCheck = validateDepartment(body.department || "");
    if (!deptCheck.valid) {
      return NextResponse.json(
        { error: deptCheck.error || "Please enter a valid academic department." },
        { status: 400 }
      );
    }

    if (
      email !== DEMO_EMAIL &&
      (!(body.idCardFileName || "").trim() || !(body.faceFileName || "").trim())
    ) {
      return NextResponse.json(
        { error: "Please upload both your student ID card photo and face photo." },
        { status: 400 }
      );
    }

    const fullName = nameCheck.normalized;
    const studentId = idCheck.normalized;
    const department = deptCheck.normalized;
    const programme = (body.programme || "").trim() || "BSc (Honours)";
    const academicSession = (body.academicSession || "").trim() || "2023–2024";
    const university = (body.university || session?.university || "").trim();

    let updatedUser: {
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
        department,
        programme,
        academicSession,
        createdAt: matchingAccount.createdAt ? new Date(matchingAccount.createdAt) : new Date(),
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
          department,
          programme,
          academicSession,
          createdAt: new Date(),
          verified: false,
          emailVerified: true,
          tokenBalance: 50,
        });

    const res = NextResponse.json({ ok: true, user: publicUser });
    applySessionCookies(res, publicUser, true);

    if (updatedUser?.passwordHash) {
      setVerifiedAccountCookieFromUser(res, publicUser, updatedUser.passwordHash);
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

