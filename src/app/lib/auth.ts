import crypto from "crypto";
import { NextResponse } from "next/server";

export const SESSION_COOKIE = "unishare_session";
export const PENDING_VERIFY_COOKIE = "unishare_pending_verify";
export const PENDING_RESET_COOKIE = "unishare_pending_reset";
export const VERIFIED_ACCOUNT_COOKIE = "unishare_verified_account";

export const OTP_EXPIRY_MS = 15 * 60 * 1000;
export const MAX_OTP_ATTEMPTS = 6;
export const RESEND_COOLDOWN_MS = 30 * 1000;

export type OtpPurpose = "EMAIL_VERIFY" | "PASSWORD_RESET";

export interface PublicUser {
  id: string;
  email: string;
  name: string;
  fullName: string;
  initials: string;
  university: string;
  universityId: string;
  isCustomUniversity: boolean;
  studentId: string | null;
  department: string | null;
  programme: string | null;
  academicSession: string | null;
  createdAt: string | null;
  verified: boolean;
  emailVerified: boolean;
  tokenBalance: number;
  isDemoUser: boolean;
}

export interface PendingVerifyPayload {
  email: string;
  fullName: string;
  university: string;
  universityId: string;
  isCustomUniversity: boolean;
  passwordHash: string;
  codeHash: string;
  exp: number;
}

export interface PendingResetPayload {
  email: string;
  codeHash: string;
  exp: number;
}

export interface VerifiedAccountPayload {
  email: string;
  fullName: string;
  university: string;
  universityId: string;
  isCustomUniversity: boolean;
  studentId: string | null;
  department?: string | null;
  programme?: string | null;
  academicSession?: string | null;
  createdAt?: string | null;
  passwordHash: string;
  emailVerified: boolean;
  verified: boolean;
  tokenBalance: number;
  exp: number;
}

export interface SessionPayload {
  userId: string;
  email: string;
  fullName: string;
  university: string;
  verified: boolean;
  emailVerified: boolean;
  exp: number;
}

export const DEMO_EMAIL = "farhana@std.du.ac.bd";

function getAuthSecret(): string {
  return (
    process.env.AUTH_SECRET ||
    process.env.NEXTAUTH_SECRET ||
    process.env.SESSION_SECRET ||
    process.env.VERCEL_PROJECT_ID ||
    "unishare_campus_auth_v1_hmac_key"
  );
}

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(normalizeEmail(email));
}

export function isValidPassword(password: string): boolean {
  return (
    typeof password === "string" &&
    password.length >= 8 &&
    /[A-Za-z]/.test(password) &&
    /\d/.test(password)
  );
}

export function deriveNameFromEmail(email: string): string {
  const local = normalizeEmail(email).split("@")[0] || "student";
  const cleaned = local
    .replace(/[._-]+/g, " ")
    .replace(/\d+/g, " ")
    .trim();
  if (!cleaned) return "Campus Student";
  return cleaned
    .split(/\s+/)
    .slice(0, 3)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

export function deriveInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "US";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
}

export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString("hex");
  const derived = crypto.scryptSync(password, salt, 64).toString("hex");
  return `scrypt$${salt}$${derived}`;
}

export function verifyPassword(
  password: string,
  storedHash: string,
  email?: string
): boolean {
  if (!password || !storedHash) return false;

  if (storedHash.startsWith("scrypt$")) {
    const [, salt, hashHex] = storedHash.split("$");
    if (!salt || !hashHex) return false;
    try {
      const derived = crypto.scryptSync(password, salt, 64);
      const storedBuf = Buffer.from(hashHex, "hex");
      if (derived.length !== storedBuf.length) return false;
      return crypto.timingSafeEqual(derived, storedBuf);
    } catch {
      return false;
    }
  }

  // Backward-compatible verification for pre-seeded demo account before migration
  if (
    email &&
    normalizeEmail(email) === DEMO_EMAIL &&
    (storedHash === "hash" || storedHash === "student_verified_auth")
  ) {
    return password === "password123";
  }

  return false;
}

export function generateOtpCode(): string {
  return crypto.randomInt(100000, 1000000).toString();
}

export function hashOtpCode(
  email: string,
  purpose: OtpPurpose,
  code: string
): string {
  return crypto
    .createHmac("sha256", getAuthSecret())
    .update(`${normalizeEmail(email)}:${purpose}:${code.trim()}`)
    .digest("hex");
}

export function verifyOtpHash(
  email: string,
  purpose: OtpPurpose,
  code: string,
  storedHash: string
): boolean {
  if (!/^\d{6}$/.test(code.trim()) || !storedHash) return false;
  const candidate = Buffer.from(hashOtpCode(email, purpose, code), "hex");
  const expected = Buffer.from(storedHash, "hex");
  if (candidate.length !== expected.length) return false;
  return crypto.timingSafeEqual(candidate, expected);
}

export function signPayload<T extends object>(payload: T): string {
  const encoded = Buffer.from(JSON.stringify(payload), "utf8").toString(
    "base64url"
  );
  const sig = crypto
    .createHmac("sha256", getAuthSecret())
    .update(encoded)
    .digest("base64url");
  return `${encoded}.${sig}`;
}

export function verifySignedPayload<T extends { exp?: number }>(
  token: string | undefined | null
): T | null {
  if (!token || typeof token !== "string") return null;
  const dotIdx = token.indexOf(".");
  if (dotIdx <= 0) return null;

  const encoded = token.slice(0, dotIdx);
  const sig = token.slice(dotIdx + 1);
  if (!encoded || !sig) return null;

  const expectedSig = crypto
    .createHmac("sha256", getAuthSecret())
    .update(encoded)
    .digest("base64url");

  const sigBuf = Buffer.from(sig);
  const expectedBuf = Buffer.from(expectedSig);
  if (
    sigBuf.length !== expectedBuf.length ||
    !crypto.timingSafeEqual(sigBuf, expectedBuf)
  ) {
    return null;
  }

  try {
    const parsed = JSON.parse(
      Buffer.from(encoded, "base64url").toString("utf8")
    ) as T;
    if (parsed.exp && Date.now() > parsed.exp) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function toPublicUser(user: {
  id: string;
  email: string;
  fullName: string;
  university?: string | null;
  universityId?: string | null;
  isCustomUniversity?: boolean;
  studentId?: string | null;
  department?: string | null;
  programme?: string | null;
  academicSession?: string | null;
  createdAt?: Date | string | null;
  verified: boolean;
  emailVerified?: boolean;
  tokenBalance: number;
}): PublicUser {
  const email = normalizeEmail(user.email);
  const fullName = user.fullName?.trim() || deriveNameFromEmail(email);
  const createdAtIso =
    user.createdAt instanceof Date
      ? user.createdAt.toISOString()
      : typeof user.createdAt === "string"
      ? user.createdAt
      : null;

  return {
    id: user.id,
    email,
    name: fullName,
    fullName,
    initials: deriveInitials(fullName),
    university: user.university?.trim() || "University of Dhaka",
    universityId: user.universityId || "du",
    isCustomUniversity: Boolean(user.isCustomUniversity),
    studentId: user.studentId ?? null,
    department: user.department ?? null,
    programme: user.programme ?? null,
    academicSession: user.academicSession ?? null,
    createdAt: createdAtIso,
    verified: Boolean(user.verified),
    emailVerified: Boolean(user.emailVerified ?? user.verified),
    tokenBalance: user.tokenBalance ?? 50,
    isDemoUser: email === DEMO_EMAIL,
  };
}

export function applySessionCookies(
  res: NextResponse,
  publicUser: PublicUser,
  rememberMe = true
) {
  const maxAgeSeconds = rememberMe ? 60 * 60 * 24 * 7 : 60 * 60 * 24;
  const secure = process.env.NODE_ENV === "production";

  const sessionToken = signPayload<SessionPayload>({
    userId: publicUser.id,
    email: publicUser.email,
    fullName: publicUser.fullName,
    university: publicUser.university,
    verified: publicUser.verified,
    emailVerified: publicUser.emailVerified,
    exp: Date.now() + maxAgeSeconds * 1000,
  });

  res.cookies.set(SESSION_COOKIE, sessionToken, {
    httpOnly: true,
    sameSite: "lax",
    secure,
    path: "/",
    maxAge: maxAgeSeconds,
  });

  // Compatibility cookies read by existing client pages and AppNavbar
  res.cookies.set("unishare_logged_in", "true", {
    httpOnly: false,
    sameSite: "lax",
    secure,
    path: "/",
    maxAge: maxAgeSeconds,
  });

  res.cookies.set("unishare_user", JSON.stringify(publicUser), {
    httpOnly: false,
    sameSite: "lax",
    secure,
    path: "/",
    maxAge: maxAgeSeconds,
  });

  res.cookies.set("unishare_token", `verified_${publicUser.id}`, {
    httpOnly: false,
    sameSite: "lax",
    secure,
    path: "/",
    maxAge: maxAgeSeconds,
  });
}

export function setVerifiedAccountCookie(
  res: NextResponse,
  payload: Omit<VerifiedAccountPayload, "exp">
) {
  const maxAgeSeconds = 60 * 60 * 24 * 30;
  const token = signPayload<VerifiedAccountPayload>({
    ...payload,
    exp: Date.now() + maxAgeSeconds * 1000,
  });
  res.cookies.set(VERIFIED_ACCOUNT_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: maxAgeSeconds,
  });
}

export function setVerifiedAccountCookieFromUser(
  res: NextResponse,
  publicUser: PublicUser,
  passwordHash: string
) {
  setVerifiedAccountCookie(res, {
    email: publicUser.email,
    fullName: publicUser.fullName,
    university: publicUser.university,
    universityId: publicUser.universityId,
    isCustomUniversity: publicUser.isCustomUniversity,
    studentId: publicUser.studentId,
    department: publicUser.department,
    programme: publicUser.programme,
    academicSession: publicUser.academicSession,
    createdAt: publicUser.createdAt,
    passwordHash,
    emailVerified: publicUser.emailVerified,
    verified: publicUser.verified,
    tokenBalance: publicUser.tokenBalance,
  });
}

export function clearSessionCookies(res: NextResponse) {
  for (const name of [
    SESSION_COOKIE,
    "unishare_logged_in",
    "unishare_user",
    "unishare_token",
  ]) {
    res.cookies.set(name, "", { path: "/", maxAge: 0 });
  }
}

