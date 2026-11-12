import { NextRequest, NextResponse } from "next/server";
import { db } from "@/app/lib/db";
import {
  hashPassword,
  isValidEmail,
  normalizeEmail,
  OTP_EXPIRY_MS,
  PENDING_VERIFY_COOKIE,
  PendingVerifyPayload,
  signPayload,
} from "@/app/lib/auth";
import { isEmailAlreadyRegistered, issueOtpCode } from "@/app/lib/otp-service";
import {
  BD_UNIVERSITIES,
  matchesUniversityEmail,
} from "@/app/lib/bd-universities";
import {
  validateCustomUniversityName,
  validateFullName,
  validatePasswordChoice,
} from "@/app/lib/validation";

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json().catch(() => ({}))) as {
      fullName?: string;
      email?: string;
      password?: string;
      gender?: string;
      universityName?: string;
      universityId?: string;
      isCustomUniversity?: boolean;
    };

    const rawGender = typeof body.gender === "string" ? body.gender.trim().toLowerCase() : "";
    const resolvedGender =
      rawGender === "female" || rawGender === "male" || rawGender === "other"
        ? rawGender
        : null;

    const nameCheck = validateFullName(body.fullName || "");
    if (!nameCheck.valid) {
      return NextResponse.json(
        { error: nameCheck.error || "Please enter your real full name." },
        { status: 400 }
      );
    }

    const email = normalizeEmail(body.email || "");
    const password = body.password || "";
    const rawUniName = (body.universityName || "").trim();
    const rawUniId = (body.universityId || "").trim();
    const isCustom =
      Boolean(body.isCustomUniversity) || !rawUniId || rawUniId === "custom";

    if (!rawUniName) {
      return NextResponse.json(
        { error: "Please select your university or enter your institution name." },
        { status: 400 }
      );
    }

    const listedUni = !isCustom
      ? BD_UNIVERSITIES.find((u) => u.id === rawUniId)
      : undefined;

    let resolvedUniName = rawUniName;
    if (!listedUni) {
      const customCheck = validateCustomUniversityName(rawUniName);
      if (!customCheck.valid) {
        return NextResponse.json(
          { error: customCheck.error || "Please enter a valid institution name." },
          { status: 400 }
        );
      }
      resolvedUniName = customCheck.normalized;
    } else {
      resolvedUniName = listedUni.name;
    }

    if (!isValidEmail(email)) {
      return NextResponse.json(
        { error: "Please enter a valid university or personal email address." },
        { status: 400 }
      );
    }

    if (listedUni && !matchesUniversityEmail(email, listedUni)) {
      const domainLabel = listedUni.domains.map((d) => `@${d}`).join(" or ");
      return NextResponse.json(
        {
          error: `Please use your ${listedUni.shortName} email (${domainLabel}).`,
        },
        { status: 400 }
      );
    }

    const pwCheck = validatePasswordChoice(password);
    if (!pwCheck.valid) {
      return NextResponse.json(
        { error: pwCheck.error || "Choose a valid password." },
        { status: 400 }
      );
    }

    const resolvedUniId = listedUni ? listedUni.id : "custom";
    const resolvedIsCustom = !listedUni;

    if (await isEmailAlreadyRegistered(req, email)) {
      return NextResponse.json(
        {
          error:
            "An account with this email already exists. Please log in instead.",
        },
        { status: 409 }
      );
    }

    const passwordHash = hashPassword(password);
    const fullName = nameCheck.normalized;

    try {
      await db.user.upsert({
        where: { email },
        update: {
          fullName,
          passwordHash,
          university: resolvedUniName,
          universityId: resolvedUniId,
          isCustomUniversity: resolvedIsCustom,
          ...(resolvedGender ? { gender: resolvedGender } : {}),
          emailVerified: false,
        },
        create: {
          email,
          fullName,
          university: resolvedUniName,
          universityId: resolvedUniId,
          isCustomUniversity: resolvedIsCustom,
          ...(resolvedGender ? { gender: resolvedGender } : {}),
          passwordHash,
          emailVerified: false,
          verified: false,
          tokenBalance: 50,
        },
      });
    } catch (err) {
      console.warn("DB pending user upsert warning:", err);
    }

    const otpRes = await issueOtpCode({
      email,
      purpose: "EMAIL_VERIFY",
      university: resolvedUniName,
      enforceCooldown: false,
    });

    if (!otpRes.ok || !otpRes.codeHash || !otpRes.mailResult) {
      return NextResponse.json(
        { error: otpRes.error || "Failed to send confirmation code email." },
        { status: otpRes.status || 502 }
      );
    }

    const res = NextResponse.json({
      ok: true,
      email,
      university: resolvedUniName,
      universityId: resolvedUniId,
      isCustomUniversity: resolvedIsCustom,
      provider: otpRes.mailResult.provider,
    });

    const pendingToken = signPayload<PendingVerifyPayload>({
      email,
      fullName,
      university: resolvedUniName,
      universityId: resolvedUniId,
      isCustomUniversity: resolvedIsCustom,
      passwordHash,
      codeHash: otpRes.codeHash,
      exp: Date.now() + OTP_EXPIRY_MS,
    });

    res.cookies.set(PENDING_VERIFY_COOKIE, pendingToken, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: Math.floor(OTP_EXPIRY_MS / 1000),
    });

    return res;
  } catch (err) {
    console.error("Register API error:", err);
    return NextResponse.json(
      { error: "Unable to create account right now. Please try again." },
      { status: 500 }
    );
  }
}

