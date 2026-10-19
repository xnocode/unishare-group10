import { NextRequest, NextResponse } from "next/server";
import { db } from "@/app/lib/db";
import {
  DEMO_EMAIL,
  deriveNameFromEmail,
  hashPassword,
  isValidEmail,
  isValidPassword,
  normalizeEmail,
  OTP_EXPIRY_MS,
  PENDING_VERIFY_COOKIE,
  PendingVerifyPayload,
  signPayload,
} from "@/app/lib/auth";
import { issueOtpCode } from "@/app/lib/otp-service";
import {
  BD_UNIVERSITIES,
  matchesUniversityEmail,
} from "@/app/lib/bd-universities";

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json().catch(() => ({}))) as {
      email?: string;
      password?: string;
      universityName?: string;
      universityId?: string;
      isCustomUniversity?: boolean;
    };

    const email = normalizeEmail(body.email || "");
    const password = body.password || "";
    const rawUniName = (body.universityName || "").trim();
    const rawUniId = (body.universityId || "").trim();
    const isCustom = Boolean(body.isCustomUniversity) || !rawUniId || rawUniId === "custom";

    if (!rawUniName || rawUniName.length < 2) {
      return NextResponse.json(
        { error: "Please select your university or type your university name." },
        { status: 400 }
      );
    }

    if (!isValidEmail(email)) {
      return NextResponse.json(
        { error: "Please enter a valid university or personal email address." },
        { status: 400 }
      );
    }

    const listedUni = !isCustom
      ? BD_UNIVERSITIES.find((u) => u.id === rawUniId)
      : undefined;

    if (listedUni && !matchesUniversityEmail(email, listedUni)) {
      const domainLabel = listedUni.domains.map((d) => `@${d}`).join(" or ");
      return NextResponse.json(
        {
          error: `Please use your ${listedUni.shortName} email (${domainLabel}), or choose custom university entry if unlisted.`,
        },
        { status: 400 }
      );
    }

    if (!isValidPassword(password)) {
      return NextResponse.json(
        {
          error:
            "Password must be at least 8 characters long and include a letter and a number.",
        },
        { status: 400 }
      );
    }

    const resolvedUniName = listedUni ? listedUni.name : rawUniName;
    const resolvedUniId = listedUni ? listedUni.id : "custom";
    const resolvedIsCustom = !listedUni;

    let existingVerified = false;
    let existingUserName: string | null = null;
    try {
      const existing = await db.user.findUnique({ where: { email } });
      if (existing) {
        existingUserName = existing.fullName;
        if (existing.emailVerified || existing.verified) {
          existingVerified = true;
        }
      }
    } catch (err) {
      console.warn("DB duplicate check warning:", err);
    }

    if (existingVerified || email === DEMO_EMAIL) {
      return NextResponse.json(
        {
          error:
            "An account with this email already exists. Please log in instead.",
        },
        { status: 409 }
      );
    }

    const passwordHash = hashPassword(password);
    const fullName = existingUserName || deriveNameFromEmail(email);

    try {
      await db.user.upsert({
        where: { email },
        update: {
          passwordHash,
          university: resolvedUniName,
          universityId: resolvedUniId,
          isCustomUniversity: resolvedIsCustom,
          emailVerified: false,
        },
        create: {
          email,
          fullName,
          university: resolvedUniName,
          universityId: resolvedUniId,
          isCustomUniversity: resolvedIsCustom,
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
      isCustomUniversity: resolvedIsCustom,
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
      isLiveEmail: otpRes.mailResult.isLiveEmail,
      previewUrl: otpRes.mailResult.previewUrl,
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

