import { NextRequest, NextResponse } from "next/server";
import { db } from "@/app/lib/db";
import {
  applySessionCookies,
  parseUserPreferences,
  recordKnownAccountCookie,
  SESSION_COOKIE,
  SessionPayload,
  setVerifiedAccountCookieFromUser,
  toPublicUser,
  UserPreferences,
  VERIFIED_ACCOUNT_COOKIE,
  VerifiedAccountPayload,
  verifySignedPayload,
} from "@/app/lib/auth";
import { validateDepartment, validateFullName } from "@/app/lib/validation";

const VALID_GENDERS = new Set(["female", "male", "other"]);

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

  const verifiedCookie = verifySignedPayload<VerifiedAccountPayload>(
    req.cookies.get(VERIFIED_ACCOUNT_COOKIE)?.value
  );
  const matchingCookie =
    verifiedCookie &&
    verifiedCookie.email.toLowerCase() === session.email.toLowerCase()
      ? verifiedCookie
      : null;

  return NextResponse.json({
    ok: true,
    user: toPublicUser({
      id: session.userId,
      email: session.email,
      fullName: matchingCookie?.fullName || session.fullName,
      university: matchingCookie?.university || session.university,
      universityId: matchingCookie?.universityId,
      isCustomUniversity: matchingCookie?.isCustomUniversity,
      studentId: matchingCookie?.studentId ?? null,
      department: matchingCookie?.department ?? null,
      programme: matchingCookie?.programme ?? null,
      academicSession: matchingCookie?.academicSession ?? null,
      gender: matchingCookie?.gender ?? null,
      createdAt: matchingCookie?.createdAt ?? null,
      verified: matchingCookie?.verified ?? session.verified,
      emailVerified: matchingCookie?.emailVerified ?? session.emailVerified,
      tokenBalance: matchingCookie?.tokenBalance ?? 50,
    }),
  });
}

// PATCH /api/auth/me — Update authenticated user's profile and safety gender settings
export async function PATCH(req: NextRequest) {
  const sessionToken = req.cookies.get(SESSION_COOKIE)?.value;
  const session = verifySignedPayload<SessionPayload>(sessionToken);

  if (!session) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
    if (!body || typeof body !== "object") {
      return NextResponse.json({ ok: false, error: "Invalid request payload." }, { status: 400 });
    }

    const updateData: {
      fullName?: string;
      department?: string | null;
      programme?: string | null;
      academicSession?: string | null;
      gender?: string | null;
      preferencesJson?: string;
    } = {};

    const existing = await db.user
      .findUnique({ where: { email: session.email } })
      .catch(() => null);

    if ("fullName" in body) {
      const check = validateFullName(typeof body.fullName === "string" ? body.fullName : "");
      if (!check.valid) {
        return NextResponse.json(
          { ok: false, error: check.error || "Please enter your real full name." },
          { status: 400 }
        );
      }
      updateData.fullName = check.normalized;
    }

    if ("department" in body) {
      const rawDept = typeof body.department === "string" ? body.department.trim() : "";
      if (!rawDept) {
        if (existing?.verified || session.verified) {
          return NextResponse.json(
            { ok: false, error: "Verified student accounts require an academic department." },
            { status: 400 }
          );
        }
        updateData.department = null;
      } else {
        const check = validateDepartment(rawDept);
        if (!check.valid) {
          return NextResponse.json(
            { ok: false, error: check.error || "Please enter a valid department." },
            { status: 400 }
          );
        }
        updateData.department = check.normalized;
      }
    }

    if ("programme" in body) {
      const rawProg = typeof body.programme === "string" ? body.programme.trim() : "";
      if (rawProg.length > 60) {
        return NextResponse.json(
          { ok: false, error: "Programme name must be 60 characters or fewer." },
          { status: 400 }
        );
      }
      updateData.programme = rawProg || null;
    }

    if ("academicSession" in body) {
      const rawSess =
        typeof body.academicSession === "string" ? body.academicSession.trim() : "";
      if (rawSess.length > 30) {
        return NextResponse.json(
          { ok: false, error: "Academic session must be 30 characters or fewer." },
          { status: 400 }
        );
      }
      updateData.academicSession = rawSess || null;
    }

    if ("gender" in body) {
      const rawGender =
        typeof body.gender === "string" ? body.gender.trim().toLowerCase() : "";
      if (rawGender && !VALID_GENDERS.has(rawGender)) {
        return NextResponse.json(
          { ok: false, error: "Gender must be 'female', 'male', or 'other'." },
          { status: 400 }
        );
      }
      updateData.gender = rawGender || null;
    }

    if ("preferences" in body && body.preferences && typeof body.preferences === "object") {
      const currentPrefs = parseUserPreferences(existing?.preferencesJson);
      const p = body.preferences as Partial<UserPreferences>;
      const nextPrefs: UserPreferences = {
        emailRentalAlerts:
          typeof p.emailRentalAlerts === "boolean"
            ? p.emailRentalAlerts
            : currentPrefs.emailRentalAlerts,
        emailRideAlerts:
          typeof p.emailRideAlerts === "boolean"
            ? p.emailRideAlerts
            : currentPrefs.emailRideAlerts,
        safetyAlerts:
          typeof p.safetyAlerts === "boolean"
            ? p.safetyAlerts
            : currentPrefs.safetyAlerts,
        defaultRidePreference:
          p.defaultRidePreference === "women_only" ||
          p.defaultRidePreference === "men_only" ||
          p.defaultRidePreference === "no_preference"
            ? p.defaultRidePreference
            : currentPrefs.defaultRidePreference,
      };
      updateData.preferencesJson = JSON.stringify(nextPrefs);
    }

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json(
        { ok: false, error: "No editable profile fields provided." },
        { status: 400 }
      );
    }

    const verifiedCookie = verifySignedPayload<VerifiedAccountPayload>(
      req.cookies.get(VERIFIED_ACCOUNT_COOKIE)?.value
    );
    const matchingCookie =
      verifiedCookie &&
      verifiedCookie.email.toLowerCase() === session.email.toLowerCase()
        ? verifiedCookie
        : null;

    if (!existing && !matchingCookie) {
      return NextResponse.json(
        { ok: false, error: "Account not found in database. Please sign in again." },
        { status: 404 }
      );
    }

    const updatedRecord = existing
      ? await db.user.update({
          where: { email: session.email },
          data: updateData,
        })
      : await db.user.upsert({
          where: { email: session.email },
          update: updateData,
          create: {
            email: session.email,
            fullName: updateData.fullName ?? matchingCookie!.fullName,
            university: matchingCookie!.university,
            universityId: matchingCookie!.universityId,
            isCustomUniversity: matchingCookie!.isCustomUniversity,
            studentId: matchingCookie!.studentId,
            department:
              updateData.department !== undefined
                ? updateData.department
                : matchingCookie!.department ?? null,
            programme:
              updateData.programme !== undefined
                ? updateData.programme
                : matchingCookie!.programme ?? null,
            academicSession:
              updateData.academicSession !== undefined
                ? updateData.academicSession
                : matchingCookie!.academicSession ?? null,
            gender:
              updateData.gender !== undefined
                ? updateData.gender
                : matchingCookie!.gender ?? null,
            preferencesJson: updateData.preferencesJson ?? null,
            passwordHash: matchingCookie!.passwordHash,
            emailVerified: matchingCookie!.emailVerified,
            verified: matchingCookie!.verified,
            tokenBalance: matchingCookie!.tokenBalance,
          },
        });

    const publicUser = toPublicUser(updatedRecord);
    const res = NextResponse.json({
      ok: true,
      message: "Settings saved successfully.",
      user: publicUser,
    });

    applySessionCookies(res, publicUser, true);
    if (updatedRecord.passwordHash) {
      setVerifiedAccountCookieFromUser(res, publicUser, updatedRecord.passwordHash);
    }
    recordKnownAccountCookie(req, res, publicUser.email);

    return res;
  } catch (err) {
    console.error("PATCH /api/auth/me error:", err);
    return NextResponse.json(
      { ok: false, error: "Failed to update profile settings." },
      { status: 500 }
    );
  }
}
