import { db } from "./db";

/**
 * Database-backed presence store for students actively browsing or searching
 * for rides on UniShare. Using PostgreSQL ensures active searchers remain visible
 * across serverless instances and requests.
 */

export interface ActiveRiderPresence {
  userId: string;
  fullName: string;
  avatarInitials: string;
  university: string;
  department: string;
  verified: boolean;
  lat: number;
  lng: number;
  pickupLocation: string;
  destinationLocation?: string;
  destinationLat?: number | null;
  destinationLng?: number | null;
  gender?: string | null;
  genderPreference?: string;
  isSearching: boolean;
  lastActive: number;
}

const PRESENCE_TTL_MS = 15 * 60 * 1000;

function formatInitials(fullName: string): string {
  return (
    fullName
      .trim()
      .split(/\s+/)
      .filter(Boolean)
      .map((p) => p[0])
      .join("")
      .slice(0, 2)
      .toUpperCase() || "US"
  );
}

export async function recordRidesPresence(params: {
  userId: string;
  lat: number;
  lng: number;
  pickupLocation: string;
  destinationLocation?: string;
  destinationLat?: number | null;
  destinationLng?: number | null;
  genderPreference?: string;
}): Promise<void> {
  const expiresAt = new Date(Date.now() + PRESENCE_TTL_MS);
  try {
    await db.ridePresence.upsert({
      where: { userId: params.userId },
      update: {
        lat: params.lat,
        lng: params.lng,
        pickupLocation: params.pickupLocation || "Nearby Pickup",
        destinationLocation: params.destinationLocation || null,
        destinationLat: params.destinationLat ?? null,
        destinationLng: params.destinationLng ?? null,
        genderPreference: params.genderPreference || "no_preference",
        expiresAt,
      },
      create: {
        userId: params.userId,
        lat: params.lat,
        lng: params.lng,
        pickupLocation: params.pickupLocation || "Nearby Pickup",
        destinationLocation: params.destinationLocation || null,
        destinationLat: params.destinationLat ?? null,
        destinationLng: params.destinationLng ?? null,
        genderPreference: params.genderPreference || "no_preference",
        expiresAt,
      },
    });
  } catch (err) {
    console.warn("recordRidesPresence warning:", err);
  }
}

export async function removeRidesPresence(userId: string): Promise<void> {
  try {
    await db.ridePresence.deleteMany({
      where: { userId },
    });
  } catch (err) {
    console.warn("removeRidesPresence warning:", err);
  }
}

export async function getActiveRidersPresence(
  excludeUserId?: string
): Promise<ActiveRiderPresence[]> {
  const now = new Date();
  try {
    const rows = await db.ridePresence.findMany({
      where: {
        expiresAt: { gt: now },
        ...(excludeUserId ? { userId: { not: excludeUserId } } : {}),
        user: { verified: true },
      },
      include: {
        user: {
          select: {
            id: true,
            fullName: true,
            university: true,
            department: true,
            verified: true,
            gender: true,
          },
        },
      },
      orderBy: { updatedAt: "desc" },
      take: 40,
    });

    return rows.map((row) => ({
      userId: row.userId,
      fullName: row.user.fullName,
      avatarInitials: formatInitials(row.user.fullName),
      university: row.user.university || "University of Dhaka",
      department: row.user.department || "Campus Student",
      verified: row.user.verified,
      lat: row.lat,
      lng: row.lng,
      pickupLocation: row.pickupLocation,
      destinationLocation: row.destinationLocation || undefined,
      destinationLat: row.destinationLat,
      destinationLng: row.destinationLng,
      gender: row.user.gender,
      genderPreference: row.genderPreference,
      isSearching: true,
      lastActive: row.updatedAt.getTime(),
    }));
  } catch (err) {
    console.warn("getActiveRidersPresence warning:", err);
    return [];
  }
}
