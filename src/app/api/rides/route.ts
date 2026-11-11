import { NextRequest, NextResponse } from "next/server";
import { db } from "@/app/lib/db";
import { getAuthenticatedRideUser } from "@/app/lib/ride-auth";

export const VALID_GENDER_PREFERENCES = [
  "no_preference",
  "women_only",
  "men_only",
] as const;

export type GenderPreference = (typeof VALID_GENDER_PREFERENCES)[number];

// Haversine formula to compute distance between two GPS coordinates in kilometers
export function getHaversineDistanceKm(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371; // Earth's radius in km
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

// Check destination similarity by keywords or substring
export function isDestinationSimilar(targetDest: string, candidateDest: string): boolean {
  const normTarget = targetDest.toLowerCase().replace(/[^a-z0-9]/g, " ").trim();
  const normCandidate = candidateDest.toLowerCase().replace(/[^a-z0-9]/g, " ").trim();

  if (normTarget === normCandidate) return true;
  if (normTarget.includes(normCandidate) || normCandidate.includes(normTarget)) return true;

  // Key campus landmarks mapping
  const KEYWORDS = [
    "tsc", "curzon", "shahbagh", "dhanmondi", "farmgate", "science lab",
    "mirpur", "gulshan", "banani", "uttara", "mohakhali", "motijheel",
    "buet", "du", "dhaka university", "jahangirnagar", "savar", "badda"
  ];

  for (const kw of KEYWORDS) {
    if (normTarget.includes(kw) && normCandidate.includes(kw)) {
      return true;
    }
  }

  // Token overlap check
  const targetTokens = normTarget.split(/\s+/).filter((t) => t.length > 2);
  const candidateTokens = new Set(normCandidate.split(/\s+/).filter((t) => t.length > 2));
  let overlapCount = 0;
  for (const t of targetTokens) {
    if (candidateTokens.has(t)) overlapCount++;
  }

  return overlapCount >= 2;
}

// Check pickup compatibility
export function isPickupCompatible(
  targetOrigin: string,
  candidateOrigin: string,
  targetLat?: number,
  targetLng?: number,
  candidateLat?: number | null,
  candidateLng?: number | null
): { compatible: boolean; distanceKm: number | null; distanceText: string } {
  if (
    typeof targetLat === "number" &&
    typeof targetLng === "number" &&
    !isNaN(targetLat) &&
    !isNaN(targetLng) &&
    typeof candidateLat === "number" &&
    typeof candidateLng === "number" &&
    candidateLat !== null &&
    candidateLng !== null
  ) {
    const distKm = getHaversineDistanceKm(targetLat, targetLng, candidateLat, candidateLng);
    const distText = distKm < 1 ? `${Math.round(distKm * 1000)} m away` : `${distKm.toFixed(1)} km away`;
    return {
      compatible: distKm <= 6.0, // Compatible pickup within 6 km
      distanceKm: Math.round(distKm * 100) / 100,
      distanceText: distText,
    };
  }

  // Fallback to text matching
  const normTarget = targetOrigin.toLowerCase().trim();
  const normCand = candidateOrigin.toLowerCase().trim();
  const isClose = isDestinationSimilar(normTarget, normCand);
  return {
    compatible: isClose || true, // Allow general corridor pickup if coordinates not present
    distanceKm: null,
    distanceText: `Near ${candidateOrigin.split(",")[0]}`,
  };
}

// Compute Destination Compatibility text and score
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
    !isNaN(targetLat) &&
    !isNaN(targetLng) &&
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
    if (distKm <= 4.5) {
      return { compatibility: "Corridor Proximity Match", scorePercent: 78, distanceKm: roundedDist };
    }
    return { compatibility: "Peripheral Corridor Match", scorePercent: 60, distanceKm: roundedDist };
  }

  if (isExactText) {
    return { compatibility: "Exact Destination Match", scorePercent: 100, distanceKm: 0 };
  }
  if (isDestinationSimilar(targetDest, candidateDest)) {
    return { compatibility: "Corridor Match", scorePercent: 88, distanceKm: null };
  }
  return { compatibility: "Destination Corridor", scorePercent: 65, distanceKm: null };
}

// =============================================================
// GET /api/rides — Destination-Based Live Travel Partner Matching
// =============================================================
export async function GET(req: NextRequest) {
  try {
    const user = await getAuthenticatedRideUser(req);
    if (!user) {
      return NextResponse.json(
        {
          success: false,
          error: "Unauthorized: Please log in to search for verified travel partners.",
        },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(req.url);
    const destination = searchParams.get("destination")?.trim();
    const origin = searchParams.get("origin")?.trim() || "";
    const genderPrefParam = (searchParams.get("genderPreference") || "no_preference").trim().toLowerCase();

    // 1. Destination Validation
    if (!destination || destination.length < 2) {
      return NextResponse.json(
        {
          success: false,
          error: "Please enter a valid destination to find travel partners (min 2 characters).",
        },
        { status: 400 }
      );
    }

    // 2. Gender Preference Validation
    if (!VALID_GENDER_PREFERENCES.includes(genderPrefParam as GenderPreference)) {
      return NextResponse.json(
        {
          success: false,
          error: `Invalid gender preference '${genderPrefParam}'. Must be one of: ${VALID_GENDER_PREFERENCES.join(", ")}.`,
        },
        { status: 400 }
      );
    }

    const genderPreference = genderPrefParam as GenderPreference;

    // Optional coordinates for geometric radius matching
    const destLat = parseFloat(searchParams.get("destLat") || "");
    const destLng = parseFloat(searchParams.get("destLng") || "");
    const hasDestCoords = !isNaN(destLat) && !isNaN(destLng);

    const originLat = parseFloat(searchParams.get("originLat") || "");
    const originLng = parseFloat(searchParams.get("originLng") || "");
    const hasOriginCoords = !isNaN(originLat) && !isNaN(originLng);

    // 3. Safety Policy Enforcement for Self-Declared Profile Gender
    // "Never infer gender from names or photos. Keep profile gender private and use appropriate verified or self-declared profile information."
    if (user.gender) {
      const normalizedUserGender = user.gender.toLowerCase();
      if (genderPreference === "women_only" && normalizedUserGender === "male") {
        return NextResponse.json(
          {
            success: false,
            error: "Safety Policy: The 'Women Only' travel partner filter is reserved for verified female students.",
          },
          { status: 403 }
        );
      }
      if (genderPreference === "men_only" && normalizedUserGender === "female") {
        return NextResponse.json(
          {
            success: false,
            error: "Safety Policy: The 'Men Only' travel partner filter is reserved for verified male students.",
          },
          { status: 403 }
        );
      }
    }

    // 4. Query ACTIVE Journeys from the Database
    // CRITICAL: ONLY verified university students who are available for travel appear!
    const activeJourneys = await db.travelJourney.findMany({
      where: {
        status: "ACTIVE",
        userId: { not: user.id }, // Do not match with oneself
        user: {
          verified: true, // MUST be a verified student
        },
      },
      include: {
        user: {
          select: {
            id: true,
            fullName: true,
            university: true,
            department: true,
            studentId: true,
            verified: true,
            gender: true, // Used ONLY internally for filtering; NEVER exposed in public output
          },
        },
      },
      orderBy: { createdAt: "desc" },
      take: 60,
    });

    // 5. Server-Side Safety, Destination & Pickup Filtering
    const matchedPartners = activeJourneys.filter((journey) => {
      const partnerUser = journey.user;

      // Check 1: Destination Compatibility
      let matchesDestination = false;
      if (
        hasDestCoords &&
        journey.destinationLat !== null &&
        journey.destinationLng !== null
      ) {
        const distKm = getHaversineDistanceKm(
          destLat,
          destLng,
          journey.destinationLat,
          journey.destinationLng
        );
        matchesDestination = distKm <= 5.0; // Within 5 km corridor radius
      } else {
        matchesDestination = isDestinationSimilar(destination, journey.destination);
      }

      if (!matchesDestination) return false;

      // Check 2: Pickup Location Compatibility
      const pickupCheck = isPickupCompatible(
        origin,
        journey.origin,
        hasOriginCoords ? originLat : undefined,
        hasOriginCoords ? originLng : undefined,
        journey.originLat,
        journey.originLng
      );

      if (!pickupCheck.compatible) return false;

      // Check 3: Gender Preference Compatibility (Strictly from self-declared profile; never inferred from photo/name)
      const partnerGender = partnerUser.gender ? partnerUser.gender.toLowerCase() : null;
      const currentUserGender = user.gender ? user.gender.toLowerCase() : null;
      const partnerPref = journey.genderPreference.toLowerCase();

      // Case 1: Searcher requested "women_only"
      if (genderPreference === "women_only") {
        if (partnerGender !== "female") return false;
        if (partnerPref === "men_only") return false;
        return true;
      }

      // Case 2: Searcher requested "men_only"
      if (genderPreference === "men_only") {
        if (partnerGender !== "male") return false;
        if (partnerPref === "women_only") return false;
        return true;
      }

      // Case 3: Searcher requested "no_preference"
      if (genderPreference === "no_preference") {
        if (partnerPref === "women_only") {
          return currentUserGender === "female";
        }
        if (partnerPref === "men_only") {
          return currentUserGender === "male";
        }
        return true;
      }

      return false;
    });

    // 6. Privacy Protection: Map to Sanitized Public Companion Cards
    // NEVER expose user.gender or raw private details in the public API response!
    const sanitizedResults = matchedPartners.map((journey) => {
      const pickupMeta = isPickupCompatible(
        origin,
        journey.origin,
        hasOriginCoords ? originLat : undefined,
        hasOriginCoords ? originLng : undefined,
        journey.originLat,
        journey.originLng
      );

      const destMeta = getDestinationCompatibility(
        destination,
        journey.destination,
        hasDestCoords ? destLat : undefined,
        hasDestCoords ? destLng : undefined,
        journey.destinationLat,
        journey.destinationLng
      );

      const initials = journey.user.fullName
        .split(" ")
        .map((p) => p[0])
        .join("")
        .slice(0, 2)
        .toUpperCase();

      const shortUni = journey.user.university
        ? journey.user.university.replace("University of ", "").replace(" University", "")
        : "Campus";

      return {
        id: journey.id,
        userId: journey.user.id,
        fullName: journey.user.fullName,
        avatarInitials: initials,
        university: journey.user.university || "University of Dhaka",
        department: journey.user.department || "Academic Department",
        verificationBadge: `Verified ${shortUni} Student`,
        verified: journey.user.verified, // Always true
        isAvailable: journey.status === "ACTIVE",
        origin: journey.origin,
        approxPickupDistance: pickupMeta.distanceText,
        pickupDistanceKm: pickupMeta.distanceKm,
        destination: journey.destination,
        destinationCompatibility: destMeta.compatibility,
        compatibilityScore: destMeta.scorePercent,
        destinationDistanceKm: destMeta.distanceKm,
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

    return NextResponse.json({
      success: true,
      count: sanitizedResults.length,
      partners: sanitizedResults,
      appliedFilters: {
        destination,
        origin,
        genderPreference,
        onlyVerifiedStudents: true,
        realtimeTimestamp: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error("GET /api/rides live matching error:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Internal server error occurred while searching for travel partners.",
      },
      { status: 500 }
    );
  }
}

// =============================================================
// POST /api/rides — Register / Index an Active Travel Journey
// =============================================================
export async function POST(req: NextRequest) {
  try {
    const user = await getAuthenticatedRideUser(req);
    if (!user) {
      return NextResponse.json(
        {
          success: false,
          error: "Unauthorized: Please log in to post or index your travel journey.",
        },
        { status: 401 }
      );
    }

    if (!user.verified) {
      return NextResponse.json(
        {
          success: false,
          error: "Verification Required: Only verified university students can initiate travel matching.",
        },
        { status: 403 }
      );
    }

    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object") {
      return NextResponse.json(
        { success: false, error: "Invalid JSON request body." },
        { status: 400 }
      );
    }

    const origin = (body.origin || "").trim();
    const destination = (body.destination || "").trim();
    const genderPreferenceParam = (body.genderPreference || "no_preference").trim().toLowerCase();
    const notes = typeof body.notes === "string" ? body.notes.trim().slice(0, 300) : null;

    if (!origin || origin.length < 2) {
      return NextResponse.json(
        { success: false, error: "Valid pickup location (origin) is required." },
        { status: 400 }
      );
    }

    if (!destination || destination.length < 2) {
      return NextResponse.json(
        { success: false, error: "Valid destination is required." },
        { status: 400 }
      );
    }

    if (origin.toLowerCase() === destination.toLowerCase()) {
      return NextResponse.json(
        { success: false, error: "Pickup and destination cannot be the same location." },
        { status: 400 }
      );
    }

    if (!VALID_GENDER_PREFERENCES.includes(genderPreferenceParam as GenderPreference)) {
      return NextResponse.json(
        {
          success: false,
          error: `Gender preference must be one of: ${VALID_GENDER_PREFERENCES.join(", ")}.`,
        },
        { status: 400 }
      );
    }

    const genderPreference = genderPreferenceParam as GenderPreference;

    // Safety checks against self-declared gender
    if (user.gender) {
      const g = user.gender.toLowerCase();
      if (genderPreference === "women_only" && g === "male") {
        return NextResponse.json(
          {
            success: false,
            error: "Safety Policy: 'Women Only' preference is restricted to female students.",
          },
          { status: 403 }
        );
      }
      if (genderPreference === "men_only" && g === "female") {
        return NextResponse.json(
          {
            success: false,
            error: "Safety Policy: 'Men Only' preference is restricted to male students.",
          },
          { status: 403 }
        );
      }
    }

    const originLat = typeof body.originLat === "number" ? body.originLat : null;
    const originLng = typeof body.originLng === "number" ? body.originLng : null;
    const destinationLat = typeof body.destinationLat === "number" ? body.destinationLat : null;
    const destinationLng = typeof body.destinationLng === "number" ? body.destinationLng : null;

    // Create active journey
    const journey = await db.travelJourney.create({
      data: {
        userId: user.id,
        origin,
        originLat,
        originLng,
        destination,
        destinationLat,
        destinationLng,
        genderPreference,
        status: "ACTIVE",
        notes,
      },
    });

    return NextResponse.json(
      {
        success: true,
        message: "Travel journey registered and active for peer companion matching.",
        journey: {
          id: journey.id,
          origin: journey.origin,
          destination: journey.destination,
          genderPreference: journey.genderPreference,
          status: journey.status,
          createdAt: journey.createdAt,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("POST /api/rides error:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error registering travel journey." },
      { status: 500 }
    );
  }
}
