"use client";

import { useEffect, useMemo, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";

export interface ClientUser {
  id?: string;
  email: string;
  name: string;
  fullName?: string;
  initials: string;
  university: string;
  universityId?: string;
  isCustomUniversity?: boolean;
  studentId?: string | null;
  department?: string | null;
  programme?: string | null;
  academicSession?: string | null;
  gender?: string | null;
  preferences?: {
    emailRentalAlerts: boolean;
    emailRideAlerts: boolean;
    safetyAlerts: boolean;
    defaultRidePreference: "no_preference" | "women_only" | "men_only";
  };
  createdAt?: string | null;
  verified?: boolean;
  emailVerified?: boolean;
  tokenBalance: number;
  isDemoUser?: boolean;
}

export const DEMO_EMAIL = "farhana@std.du.ac.bd";

export const SSR_PLACEHOLDER_USER: ClientUser = {
  email: "",
  name: "Campus Student",
  fullName: "Campus Student",
  initials: "US",
  university: "Verified Campus",
  studentId: null,
  department: null,
  programme: null,
  academicSession: null,
  createdAt: null,
  verified: false,
  emailVerified: false,
  tokenBalance: 0,
  isDemoUser: false,
};

export const DEMO_USER: ClientUser = {
  email: DEMO_EMAIL,
  name: "Farhana Rahman",
  fullName: "Farhana Rahman",
  initials: "FR",
  university: "University of Dhaka",
  universityId: "du",
  isCustomUniversity: false,
  studentId: "2023-114-028",
  department: "Computer Science & Engineering",
  programme: "BSc (Honours)",
  academicSession: "2023–2024",
  gender: "female",
  createdAt: "2026-10-14T00:00:00.000Z",
  verified: true,
  emailVerified: true,
  tokenBalance: 420,
  isDemoUser: true,
};

const USER_EVENT = "unishare-user-updated";
const STORAGE_EVENT = "unishare-storage-updated";
let cachedMeSynced = false;

export function getUserScopedKey(
  baseKey: string,
  email: string,
  isDemoUser: boolean
): string {
  const cleanEmail = (email || "").trim().toLowerCase();
  if (isDemoUser || !cleanEmail || cleanEmail === DEMO_EMAIL) {
    return baseKey;
  }
  return `${baseKey}_${cleanEmail}`;
}

export function emitStorageUpdate(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(STORAGE_EVENT));
}

export function writeUserScopedJson<T>(key: string, value: T): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    emitStorageUpdate();
  } catch {
    // ignore storage errors
  }
}

export function readUserScopedJson<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function subscribeAnyStorage(callback: () => void) {
  if (typeof window === "undefined") return () => {};
  window.addEventListener("storage", callback);
  window.addEventListener(STORAGE_EVENT, callback);
  return () => {
    window.removeEventListener("storage", callback);
    window.removeEventListener(STORAGE_EVENT, callback);
  };
}

const emptySubscribe = () => () => {};

export function useIsHydrated(): boolean {
  return useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false
  );
}

export function useRequireAuth(redirectPath: string, enabled = true): boolean {
  const router = useRouter();
  const hydrated = useIsHydrated();
  const isLoggedIn =
    hydrated &&
    (() => {
      try {
        return (
          localStorage.getItem("unishare_logged_in") === "true" ||
          document.cookie.includes("unishare_logged_in=true")
        );
      } catch {
        return false;
      }
    })();

  useEffect(() => {
    if (enabled && hydrated && !isLoggedIn) {
      router.replace(`/login?redirect=${encodeURIComponent(redirectPath)}`);
    }
  }, [enabled, hydrated, isLoggedIn, redirectPath, router]);

  return isLoggedIn;
}

export function useLocalStorageRaw(key: string): string {
  return useSyncExternalStore(
    subscribeAnyStorage,
    () => {
      if (typeof window === "undefined") return "";
      try {
        return localStorage.getItem(key) || "";
      } catch {
        return "";
      }
    },
    () => ""
  );
}

export function deriveInitials(name?: string, provided?: string): string {
  if (provided?.trim()) return provided.trim().slice(0, 2).toUpperCase();
  if (!name?.trim()) return "US";
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
}

export function getFirstName(name?: string): string {
  const cleaned = (name || "").trim();
  if (!cleaned) return "Student";
  return cleaned.split(/\s+/)[0] || "Student";
}

export function formatMemberSince(createdAt?: string | null): string {
  if (!createdAt) return "Current term";
  const d = new Date(createdAt);
  if (Number.isNaN(d.getTime())) return "Current term";
  return d.toLocaleDateString("en-US", { month: "long", year: "numeric" });
}

export function saveClientUser(user: ClientUser) {
  try {
    localStorage.setItem("unishare_logged_in", "true");
    localStorage.setItem("unishare_user", JSON.stringify(user));
    window.dispatchEvent(new Event(USER_EVENT));
    emitStorageUpdate();
  } catch {
    // ignore storage errors
  }
}

export function clearClientSession() {
  cachedMeSynced = false;
  try {
    localStorage.removeItem("unishare_logged_in");
    localStorage.removeItem("unishare_user");
    sessionStorage.removeItem("unishare_pending_mail_meta");
    document.cookie = "unishare_logged_in=; path=/; max-age=0; SameSite=Lax";
    document.cookie = "unishare_user=; path=/; max-age=0; SameSite=Lax";
    document.cookie = "unishare_token=; path=/; max-age=0; SameSite=Lax";
    window.dispatchEvent(new Event(USER_EVENT));
    emitStorageUpdate();
    fetch("/api/auth/logout", { method: "POST", keepalive: true }).catch(() => {});
  } catch {
    // ignore storage errors
  }
}

export async function signInDemoStudent(): Promise<ClientUser | null> {
  try {
    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: DEMO_EMAIL,
        password: "password123",
        rememberMe: true,
      }),
    });
    if (res.ok) {
      const data = (await res.json().catch(() => null)) as {
        ok?: boolean;
        user?: ClientUser;
      } | null;
      if (data?.ok && data.user) {
        saveClientUser(data.user);
        return data.user;
      }
    }
  } catch {
    // ignore network failure
  }
  return null;
}

function subscribeUserStore(callback: () => void) {
  if (typeof window === "undefined") return () => {};
  window.addEventListener("storage", callback);
  window.addEventListener(USER_EVENT, callback);
  return () => {
    window.removeEventListener("storage", callback);
    window.removeEventListener(USER_EVENT, callback);
  };
}

function getUserSnapshot(): string {
  if (typeof window === "undefined") return "";
  try {
    return localStorage.getItem("unishare_user") || "";
  } catch {
    return "";
  }
}

export function useCurrentUser() {
  const hydrated = useIsHydrated();
  const rawJson = useSyncExternalStore(
    subscribeUserStore,
    getUserSnapshot,
    () => ""
  );

  useEffect(() => {
    if (cachedMeSynced || typeof window === "undefined") return;
    cachedMeSynced = true;
    const isLoggedIn =
      localStorage.getItem("unishare_logged_in") === "true" ||
      document.cookie.includes("unishare_logged_in=true");
    if (!isLoggedIn) return;

    fetch("/api/auth/me")
      .then(async (res) => {
        if (res.status === 401) {
          clearClientSession();
          return null;
        }
        return res.ok ? res.json() : null;
      })
      .then((data: { ok?: boolean; user?: ClientUser } | null) => {
        if (data?.ok && data.user) {
          saveClientUser(data.user);
        }
      })
      .catch(() => {});
  }, []);

  return useMemo(() => {
    if (!hydrated) {
      return {
        user: null as ClientUser | null,
        resolvedUser: SSR_PLACEHOLDER_USER,
        isDemoUser: false,
        firstName: "Student",
        isHydrated: false,
      };
    }

    if (!rawJson) {
      return {
        user: null as ClientUser | null,
        resolvedUser: SSR_PLACEHOLDER_USER,
        isDemoUser: false,
        firstName: "Student",
        isHydrated: true,
      };
    }

    try {
      const parsed = JSON.parse(rawJson) as Partial<ClientUser>;
      const email = (parsed.email || "").trim().toLowerCase();
      if (!email) {
        return {
          user: null as ClientUser | null,
          resolvedUser: SSR_PLACEHOLDER_USER,
          isDemoUser: false,
          firstName: "Student",
          isHydrated: true,
        };
      }
      const name = (parsed.name || parsed.fullName || "").trim() || "Campus Student";
      const isDemo =
        Boolean(parsed.isDemoUser) || email === DEMO_EMAIL;
      const merged: ClientUser = {
        id: parsed.id,
        email,
        name,
        fullName: parsed.fullName || name,
        initials: deriveInitials(name, parsed.initials),
        university:
          (parsed.university || "").trim() ||
          (isDemo ? "University of Dhaka" : "Campus Community"),
        universityId: parsed.universityId,
        isCustomUniversity: parsed.isCustomUniversity,
        studentId: parsed.studentId ?? (isDemo ? "2023-114-028" : null),
        department:
          parsed.department ?? (isDemo ? "Computer Science & Engineering" : null),
        programme: parsed.programme ?? (isDemo ? "BSc (Honours)" : null),
        academicSession: parsed.academicSession ?? (isDemo ? "2023–2024" : null),
        gender: parsed.gender ?? (isDemo ? "female" : null),
        preferences: parsed.preferences,
        createdAt: parsed.createdAt ?? (isDemo ? DEMO_USER.createdAt : null),
        verified: parsed.verified ?? false,
        emailVerified: parsed.emailVerified ?? true,
        tokenBalance:
          parsed.tokenBalance !== undefined
            ? parsed.tokenBalance
            : isDemo
            ? 420
            : 50,
        isDemoUser: isDemo,
      };

      return {
        user: merged,
        resolvedUser: merged,
        isDemoUser: isDemo,
        firstName: getFirstName(merged.name),
        isHydrated: true,
      };
    } catch {
      return {
        user: null as ClientUser | null,
        resolvedUser: SSR_PLACEHOLDER_USER,
        isDemoUser: false,
        firstName: "Student",
        isHydrated: true,
      };
    }
  }, [hydrated, rawJson]);
}
