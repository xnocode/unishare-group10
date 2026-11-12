/**
 * In-memory presence store for students actively browsing or searching for rides on UniShare.
 * Tracks students who are exploring rides even before booking or posting a completed ride.
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
  lastActive: number; // Unix timestamp ms
}

declare global {
  var __unishare_rides_presence__: Map<string, ActiveRiderPresence> | undefined;
}

if (!globalThis.__unishare_rides_presence__) {
  globalThis.__unishare_rides_presence__ = new Map<string, ActiveRiderPresence>();
}

const presenceMap = globalThis.__unishare_rides_presence__;

const PRESENCE_TTL_MS = 15 * 60 * 1000; // 15 minutes TTL

export function recordRidesPresence(presence: Omit<ActiveRiderPresence, "lastActive">): void {
  const full: ActiveRiderPresence = {
    ...presence,
    lastActive: Date.now(),
  };
  presenceMap.set(presence.userId, full);
}

export function removeRidesPresence(userId: string): void {
  presenceMap.delete(userId);
}

export function getActiveRidersPresence(excludeUserId?: string): ActiveRiderPresence[] {
  const now = Date.now();
  const active: ActiveRiderPresence[] = [];

  for (const [id, item] of presenceMap.entries()) {
    if (now - item.lastActive > PRESENCE_TTL_MS) {
      presenceMap.delete(id);
      continue;
    }
    if (excludeUserId && id === excludeUserId) {
      continue;
    }
    active.push(item);
  }

  return active;
}
