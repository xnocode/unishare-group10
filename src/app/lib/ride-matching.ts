import { db } from "./db";
import { getActiveRidersPresence } from "./rides-presence";

export const VALID_GENDER_PREFERENCES = [
  "no_preference",
  "women_only",
  "men_only",
] as const;

export type GenderPreference = (typeof VALID_GENDER_PREFERENCES)[number];

export interface MatchUserContext {
  id: string;
  verified?: boolean;
  gender: string | null;
}

export interface MatchQueryOptions {
  user: MatchUserContext;
  browseMode?: boolean;
  destination: string;
  origin: string;
  genderPreference: GenderPreference;
  destLat?: number;
  destLng?: number;
  originLat?: number;
  originLng?: number;
  includeActiveExplorers?: boolean;
}

export function getHaversineDistanceKm(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/** Distance from point P to segment A->B in km, plus normalized progression t in [0,1]. */
function pointToSegmentKm(
  px: number,
  py: number,
  ax: number,
  ay: number,
  bx: number,
  by: number
): { distanceKm: number; t: number } {
  const cosLat = Math.cos((((ay + by) / 2) * Math.PI) / 180);
  const scaleX = 111.32 * cosLat;
  const scaleY = 110.57;

  const pX = (px - ax) * scaleX;
  const pY = (py - ay) * scaleY;
  const dX = (bx - ax) * scaleX;
  const dY = (by - ay) * scaleY;

  const lenSq = dX * dX + dY * dY;
  if (lenSq < 1e-6) {
    return { distanceKm: Math.hypot(pX, pY), t: 0 };
  }

  const rawT = (pX * dX + pY * dY) / lenSq;
  const t = Math.max(0, Math.min(1, rawT));
  const closestX = t * dX;
  const closestY = t * dY;
  return { distanceKm: Math.hypot(pX - closestX, pY - closestY), t };
}

/** Cosine similarity of two travel vectors in Dhaka; prevents opposite-direction matching. */
function computeDirectionAlignment(
  aOriginLat: number,
  aOriginLng: number,
  aDestLat: number,
  aDestLng: number,
  bOriginLat: number,
  bOriginLng: number,
  bDestLat: number,
  bDestLng: number
): number {
  const ax = aDestLng - aOriginLng;
  const ay = aDestLat - aOriginLat;
  const bx = bDestLng - bOriginLng;
  const by = bDestLat - bOriginLat;
  const magA = Math.hypot(ax, ay);
  const magB = Math.hypot(bx, by);
  if (magA < 1e-5 || magB < 1e-5) return 0;
  return (ax * bx + ay * by) / (magA * magB);
}

const PLACE_KEYWORDS = [
  "tsc", "curzon", "shahbagh", "dhanmondi", "farmgate", "science lab",
  "mirpur", "gulshan", "banani", "uttara", "mohakhali", "motijheel",
  "buet", "du", "dhaka university", "jahangirnagar", "savar", "badda",
  "uits", "nsu", "brac", "uiu", "aiub", "bashundhara", "rampura",
];

export function isDestinationSimilar(targetDest: string, candidateDest: string): boolean {
  const normTarget = targetDest.toLowerCase().replace(/[^a-z0-9]/g, " ").trim();
  const normCandidate = candidateDest.toLowerCase().replace(/[^a-z0-9]/g, " ").trim();

  if (!normTarget || !normCandidate) return false;
  if (normTarget === normCandidate) return true;
  if (normTarget.includes(normCandidate) || normCandidate.includes(normTarget)) return true;

  for (const kw of PLACE_KEYWORDS) {
    const regex = new RegExp(`\\b${kw}\\b`);
    if (regex.test(normTarget) && regex.test(normCandidate)) {
      return true;
    }
  }

  const targetTokens = normTarget.split(/\s+/).filter((t) => t.length > 2 && t !== "dhaka" && t !== "university");
  const candidateTokens = new Set(normCandidate.split(/\s+/).filter((t) => t.length > 2));
  let overlapCount = 0;
  for (const t of targetTokens) {
    if (candidateTokens.has(t)) overlapCount++;
  }

  return overlapCount >= 2;
}

export function isPickupCompatible(
  targetOrigin: string,
  candidateOrigin: string,
  targetLat?: number,
  targetLng?: number,
  candidateLat?: number | null,
  candidateLng?: number | null
): { compatible: boolean; distanceKm: number | null; distanceText: string } {
  const hasTarget =
    typeof targetLat === "number" &&
    typeof targetLng === "number" &&
    Number.isFinite(targetLat) &&
    Number.isFinite(targetLng);
  const hasCand =
    typeof candidateLat === "number" &&
    typeof candidateLng === "number" &&
    candidateLat !== null &&
    candidateLng !== null &&
    Number.isFinite(candidateLat) &&
    Number.isFinite(candidateLng);

  if (hasTarget && hasCand) {
    const distKm = getHaversineDistanceKm(targetLat, targetLng, candidateLat, candidateLng);
    const distText =
      distKm < 1 ? `${Math.round(distKm * 1000)} m away` : `${distKm.toFixed(1)} km away`;
    return {
      compatible: distKm <= 5.5,
      distanceKm: Math.round(distKm * 100) / 100,
      distanceText: distText,
    };
  }

  const normTarget = targetOrigin.toLowerCase().trim();
  const normCand = candidateOrigin.toLowerCase().trim();
  if (!normTarget) {
    return {
      compatible: true,
      distanceKm: null,
      distanceText: `Near ${candidateOrigin.split(",")[0]}`,
    };
  }

  return {
    compatible: isDestinationSimilar(normTarget, normCand),
    distanceKm: null,
    distanceText: `Near ${candidateOrigin.split(",")[0]}`,
  };
}

export function getDestinationCompatibility(
  targetDest: string,
  candidateDest: string,
  targetLat?: number,
  targetLng?: number,
  candidateLat?: number | null,
  candidateLng?: number | null
): { compatibility: string; scorePercent: number; distanceKm: number | null } {
  const isExactText = targetDest.trim().toLowerCase() === candidateDest.trim().toLowerCase();

  if (
    typeof targetLat === "number" &&
    typeof targetLng === "number" &&
    Number.isFinite(targetLat) &&
    Number.isFinite(targetLng) &&
    typeof candidateLat === "number" &&
    typeof candidateLng === "number" &&
    candidateLat !== null &&
    candidateLng !== null
  ) {
    const distKm = getHaversineDistanceKm(targetLat, targetLng, candidateLat, candidateLng);
    const roundedDist = Math.round(distKm * 100) / 100;
    if (isExactText || distKm <= 0.8) {
      return { compatibility: "Exact Destination Match", scorePercent: 100, distanceKm: roundedDist };
    }
    if (distKm <= 2.2) {
      return { compatibility: "Campus Zone Match", scorePercent: 92, distanceKm: roundedDist };
    }
    if (distKm <= 4.8) {
      return { compatibility: "Corridor Proximity Match", scorePercent: 80, distanceKm: roundedDist };
    }
    return { compatibility: "Adjacent Corridor", scorePercent: 62, distanceKm: roundedDist };
  }

  if (isExactText) {
    return { compatibility: "Exact Destination Match", scorePercent: 100, distanceKm: 0 };
  }
  if (isDestinationSimilar(targetDest, candidateDest)) {
    return { compatibility: "Corridor Match", scorePercent: 88, distanceKm: null };
  }
  return { compatibility: "Campus Route", scorePercent: 64, distanceKm: null };
}

export function validateGenderFilterAccess(
  userGender: string | null | undefined,
  genderPreference: GenderPreference,
  mode: "search" | "post" = "search"
): string | null {
  const normalized = userGender ? userGender.toLowerCase() : "";
  if (genderPreference === "women_only" && normalized !== "female") {
    return userGender
      ? mode === "post"
        ? "Safety Policy: 'Women Only' preference is restricted to female students."
        : "Safety Policy: The 'Women Only' travel partner filter is reserved for verified female students."
      : `Safety Policy: Set your gender in Settings before ${mode === "post" ? "enabling" : "using"} the 'Women Only' filter.`;
  }
  if (genderPreference === "men_only" && normalized !== "male") {
    return userGender
      ? mode === "post"
        ? "Safety Policy: 'Men Only' preference is restricted to male students."
        : "Safety Policy: The 'Men Only' travel partner filter is reserved for verified male students."
      : `Safety Policy: Set your gender in Settings before ${mode === "post" ? "enabling" : "using"} the 'Men Only' filter.`;
  }
  return null;
}

export function isSafetyGenderCompatible(
  requesterGender: string | null | undefined,
  requesterPref: GenderPreference,
  partnerGender: string | null | undefined,
  partnerPref: string
): boolean {
  const pg = partnerGender ? partnerGender.toLowerCase() : null;
  const rg = requesterGender ? requesterGender.toLowerCase() : null;
  const pp = partnerPref.toLowerCase();

  if (requesterPref === "women_only") {
    return pg === "female" && pp !== "men_only";
  }
  if (requesterPref === "men_only") {
    return pg === "male" && pp !== "women_only";
  }
  if (pp === "women_only") return rg === "female";
  if (pp === "men_only") return rg === "male";
  return true;
}

function estimatePartnerCngSavings(
  originLat?: number | null,
  originLng?: number | null,
  destLat?: number | null,
  destLng?: number | null
): { soloBdt: number; splitBdt: number; savingsBdt: number } {
  const oLat = typeof originLat === "number" && Number.isFinite(originLat) ? originLat : 23.751;
  const oLng = typeof originLng === "number" && Number.isFinite(originLng) ? originLng : 90.377;
  const dLat = typeof destLat === "number" && Number.isFinite(destLat) ? destLat : 23.7317;
  const dLng = typeof destLng === "number" && Number.isFinite(destLng) ? destLng : 90.3957;

  const straightKm = getHaversineDistanceKm(oLat, oLng, dLat, dLng);
  const roadKm = Math.max(0.8, straightKm * 1.32);
  const soloBdt = Math.max(50, Math.round((35 + roadKm * 22) / 5) * 5);
  const splitBdt = Math.max(20, Math.round(soloBdt / 2 / 5) * 5);
  return { soloBdt, splitBdt, savingsBdt: Math.max(0, soloBdt - splitBdt) };
}

export async function queryMatchedPartners(opts: MatchQueryOptions) {
  const {
    user,
    browseMode = false,
    destination,
    origin,
    genderPreference,
    destLat,
    destLng,
    originLat,
    originLng,
    includeActiveExplorers = true,
  } = opts;

  const hasDestCoords =
    typeof destLat === "number" && typeof destLng === "number" && Number.isFinite(destLat) && Number.isFinite(destLng);
  const hasOriginCoords =
    typeof originLat === "number" && typeof originLng === "number" && Number.isFinite(originLat) && Number.isFinite(originLng);

  const activeJourneys = await db.travelJourney.findMany({
    where: {
      status: "ACTIVE",
      userId: { not: user.id },
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
    orderBy: { createdAt: "desc" },
    take: 60,
  });

  const seenPartnerUserIds = new Set<string>();
  const matchedPartners: Array<(typeof activeJourneys)[number] & { enRouteCorridor?: boolean }> = [];

  for (const journey of activeJourneys) {
    if (seenPartnerUserIds.has(journey.userId)) continue;

    if (!isSafetyGenderCompatible(user.gender, genderPreference, journey.user.gender, journey.genderPreference)) {
      continue;
    }

    if (browseMode) {
      seenPartnerUserIds.add(journey.userId);
      matchedPartners.push(journey);
      continue;
    }

    // Destination check
    let matchesDestination = false;
    if (hasDestCoords && journey.destinationLat !== null && journey.destinationLng !== null) {
      matchesDestination =
        getHaversineDistanceKm(destLat, destLng, journey.destinationLat, journey.destinationLng) <= 5.0;
    }
    if (!matchesDestination) {
      matchesDestination = isDestinationSimilar(destination, journey.destination);
    }

    // Pickup check
    const pickupCheck = isPickupCompatible(
      origin,
      journey.origin,
      hasOriginCoords ? originLat : undefined,
      hasOriginCoords ? originLng : undefined,
      journey.originLat,
      journey.originLng
    );

    // En-route corridor check (catches same-direction companions joining along the way)
    let enRouteCorridor = false;
    if (
      hasOriginCoords &&
      hasDestCoords &&
      journey.originLat !== null &&
      journey.originLng !== null &&
      journey.destinationLat !== null &&
      journey.destinationLng !== null
    ) {
      const headingDot = computeDirectionAlignment(
        originLat,
        originLng,
        destLat,
        destLng,
        journey.originLat,
        journey.originLng,
        journey.destinationLat,
        journey.destinationLng
      );
      const originSeg = pointToSegmentKm(
        journey.originLng,
        journey.originLat,
        originLng,
        originLat,
        destLng,
        destLat
      );
      const destSeg = pointToSegmentKm(
        journey.destinationLng,
        journey.destinationLat,
        originLng,
        originLat,
        destLng,
        destLat
      );
      enRouteCorridor =
        headingDot >= 0.25 &&
        (originSeg.distanceKm <= 2.4 || destSeg.distanceKm <= 2.4);
    }

    // Strict match rules:
    // - Same destination + compatible (or unspecified) pickup
    // - OR close pickup + compatible destination/direction
    // - OR true same-heading en-route corridor
    const hasOriginFilter = Boolean(origin.trim());
    const matchesTrip =
      enRouteCorridor ||
      (matchesDestination && (!hasOriginFilter || pickupCheck.compatible || (pickupCheck.distanceKm ?? 99) <= 8.0));

    if (!matchesTrip) continue;

    seenPartnerUserIds.add(journey.userId);
    matchedPartners.push({ ...journey, enRouteCorridor });
  }

  const sanitizedResults = matchedPartners.map((journey) => {
    const pickupMeta = isPickupCompatible(
      origin,
      journey.origin,
      hasOriginCoords ? originLat : undefined,
      hasOriginCoords ? originLng : undefined,
      journey.originLat,
      journey.originLng
    );

    const destMeta =
      destination.length >= 2
        ? getDestinationCompatibility(
            destination,
            journey.destination,
            hasDestCoords ? destLat : undefined,
            hasDestCoords ? destLng : undefined,
            journey.destinationLat,
            journey.destinationLng
          )
        : { compatibility: "Active on Campus", scorePercent: 70, distanceKm: null };

    let corridorMatch = Boolean(journey.enRouteCorridor);
    if (!corridorMatch && destination.length >= 2) {
      if (hasDestCoords && journey.destinationLat !== null && journey.destinationLng !== null) {
        corridorMatch =
          getHaversineDistanceKm(destLat, destLng, journey.destinationLat, journey.destinationLng) <= 5.0;
      } else {
        corridorMatch = isDestinationSimilar(destination, journey.destination);
      }
    }

    const initials =
      journey.user.fullName
        .split(" ")
        .filter(Boolean)
        .map((p) => p[0])
        .join("")
        .slice(0, 2)
        .toUpperCase() || "US";

    const shortUni = journey.user.university
      ? journey.user.university.replace("University of ", "").replace(" University", "")
      : "Campus";

    const inPickupRange = pickupMeta.distanceKm !== null && pickupMeta.distanceKm <= 4.5;
    const sameDestination = corridorMatch || destMeta.scorePercent >= 80;
    const isRecommendedPartner = inPickupRange || sameDestination;

    const fareEst = estimatePartnerCngSavings(
      journey.originLat,
      journey.originLng,
      journey.destinationLat,
      journey.destinationLng
    );

    let recommendationBadge: string | null = null;
    if (inPickupRange && sameDestination) {
      recommendationBadge = `⭐ Top Match · Save ~৳${fareEst.savingsBdt}/trip`;
    } else if (journey.enRouteCorridor) {
      recommendationBadge = `🛣️ En-Route Corridor · Save ~৳${fareEst.savingsBdt}`;
    } else if (inPickupRange) {
      recommendationBadge = `📍 Nearby Pickup (${pickupMeta.distanceText})`;
    } else if (sameDestination) {
      recommendationBadge = `🎯 Same Destination · Save ~৳${fareEst.savingsBdt}`;
    }

    return {
      id: journey.id,
      userId: journey.user.id,
      fullName: journey.user.fullName,
      avatarInitials: initials,
      university: journey.user.university || "University of Dhaka",
      department: journey.user.department || "Academic Department",
      verificationBadge: `Verified ${shortUni} Student`,
      verified: journey.user.verified,
      isAvailable: journey.status === "ACTIVE",
      isExplorer: false,
      isRecommendedPartner,
      recommendationBadge,
      corridorMatch,
      origin: journey.origin,
      approxPickupDistance: pickupMeta.distanceText,
      pickupDistanceKm: pickupMeta.distanceKm,
      destination: journey.destination,
      destinationCompatibility:
        browseMode && !corridorMatch
          ? "Active Route"
          : journey.enRouteCorridor && destMeta.scorePercent < 80
          ? "En-Route Corridor"
          : destMeta.compatibility,
      compatibilityScore: isRecommendedPartner ? Math.max(destMeta.scorePercent, 88) : destMeta.scorePercent,
      destinationDistanceKm: destMeta.distanceKm,
      estimatedSavingsBdt: fareEst.savingsBdt,
      originCoords:
        journey.originLat !== null && journey.originLng !== null
          ? { lat: journey.originLat, lng: journey.originLng }
          : null,
      destCoords:
        journey.destinationLat !== null && journey.destinationLng !== null
          ? { lat: journey.destinationLat, lng: journey.destinationLng }
          : null,
      departureTime: journey.departureTime,
      genderPreferenceRule: journey.genderPreference,
      notes: journey.notes,
      createdAt: journey.createdAt,
    };
  });

  if (includeActiveExplorers) {
    const activeSearchers = await getActiveRidersPresence(user.id);
    for (const searcher of activeSearchers) {
      if (!searcher.verified || seenPartnerUserIds.has(searcher.userId)) continue;

      if (
        !isSafetyGenderCompatible(
          user.gender,
          genderPreference,
          searcher.gender,
          searcher.genderPreference || "no_preference"
        )
      ) {
        continue;
      }

      let distKm: number | null = null;
      let distText = "Nearby on Campus";
      if (hasOriginCoords) {
        distKm = getHaversineDistanceKm(originLat, originLng, searcher.lat, searcher.lng);
        distText = distKm < 1 ? `${Math.round(distKm * 1000)} m away` : `${distKm.toFixed(1)} km away`;
      }

      const inPickupRange = distKm !== null && distKm <= 4.5;
      let sameDestination = false;
      if (destination.length >= 2 && searcher.destinationLocation) {
        if (hasDestCoords && searcher.destinationLat && searcher.destinationLng) {
          sameDestination =
            getHaversineDistanceKm(destLat, destLng, searcher.destinationLat, searcher.destinationLng) <= 5.0;
        }
        if (!sameDestination) {
          sameDestination = isDestinationSimilar(destination, searcher.destinationLocation);
        }
      }

      // In active search mode, filter out unrelated explorers so only nearby/same-destination searchers appear
      if (!browseMode && !inPickupRange && !sameDestination) {
        continue;
      }

      const fareEst = estimatePartnerCngSavings(
        searcher.lat,
        searcher.lng,
        searcher.destinationLat,
        searcher.destinationLng
      );

      const isRecommendedPartner = inPickupRange || sameDestination;
      let recommendationBadge: string | null = null;
      if (inPickupRange && sameDestination) {
        recommendationBadge = `⭐ Top Match · Active Now · Save ~৳${fareEst.savingsBdt}`;
      } else if (inPickupRange) {
        recommendationBadge = `📍 Active Nearby (${distText})`;
      } else if (sameDestination) {
        recommendationBadge = `🎯 Active Searcher · Same Destination`;
      } else {
        recommendationBadge = "🟢 Active on UniShare now";
      }

      sanitizedResults.push({
        id: `searcher-${searcher.userId}`,
        userId: searcher.userId,
        fullName: searcher.fullName,
        avatarInitials: searcher.avatarInitials,
        university: searcher.university,
        department: searcher.department,
        verificationBadge: "🟢 Searching for Rides (Live)",
        verified: searcher.verified,
        isAvailable: true,
        isExplorer: true,
        isRecommendedPartner,
        recommendationBadge,
        corridorMatch: sameDestination,
        origin: searcher.pickupLocation,
        approxPickupDistance: distText,
        pickupDistanceKm: distKm ? Math.round(distKm * 10) / 10 : null,
        destination: searcher.destinationLocation || "Open to Campus Routes",
        destinationCompatibility: sameDestination ? "Exact Destination Match" : "Active Explorer",
        compatibilityScore: isRecommendedPartner ? 90 : 75,
        destinationDistanceKm: null,
        estimatedSavingsBdt: fareEst.savingsBdt,
        originCoords: { lat: searcher.lat, lng: searcher.lng },
        destCoords:
          searcher.destinationLat && searcher.destinationLng
            ? { lat: searcher.destinationLat, lng: searcher.destinationLng }
            : null,
        departureTime: new Date(),
        genderPreferenceRule: searcher.genderPreference || "no_preference",
        notes: "Currently browsing rides & open to travel companion requests.",
        createdAt: new Date(searcher.lastActive),
      });

      seenPartnerUserIds.add(searcher.userId);
    }
  }

  sanitizedResults.sort((a, b) => {
    if (a.isRecommendedPartner !== b.isRecommendedPartner) return a.isRecommendedPartner ? -1 : 1;
    if (a.corridorMatch !== b.corridorMatch) return a.corridorMatch ? -1 : 1;
    const da = a.pickupDistanceKm ?? 99;
    const dbDist = b.pickupDistanceKm ?? 99;
    return da - dbDist;
  });

  return sanitizedResults;
}

