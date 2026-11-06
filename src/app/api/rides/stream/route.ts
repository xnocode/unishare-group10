import { NextRequest } from "next/server";
import { db } from "@/app/lib/db";
import { getAuthenticatedRideUser } from "@/app/lib/ride-auth";
import {
  VALID_GENDER_PREFERENCES,
  GenderPreference,
  getHaversineDistanceKm,
  isDestinationSimilar,
  isPickupCompatible,
  getDestinationCompatibility,
} from "../route";

async function fetchLiveMatches(
  user: { id: string; gender: string | null },
  destination: string,
  origin: string,
  genderPreference: GenderPreference,
  destLat?: number,
  destLng?: number,
  originLat?: number,
  originLng?: number
) {
  const hasDestCoords = typeof destLat === "number" && typeof destLng === "number" && !isNaN(destLat) && !isNaN(destLng);
  const hasOriginCoords = typeof originLat === "number" && typeof originLng === "number" && !isNaN(originLat) && !isNaN(originLng);

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
    take: 40,
  });

  const seenStreamUserIds = new Set<string>();
  const matched = activeJourneys.filter((journey) => {
    if (seenStreamUserIds.has(journey.userId)) return false;
    // 1. Destination
    let destMatch = false;
    if (hasDestCoords && journey.destinationLat !== null && journey.destinationLng !== null) {
      destMatch = getHaversineDistanceKm(destLat, destLng, journey.destinationLat, journey.destinationLng) <= 5.0;
    } else {
      destMatch = isDestinationSimilar(destination, journey.destination);
    }
    if (!destMatch) return false;

    // 2. Pickup
    const pickupCheck = isPickupCompatible(
      origin,
      journey.origin,
      hasOriginCoords ? originLat : undefined,
      hasOriginCoords ? originLng : undefined,
      journey.originLat,
      journey.originLng
    );
    if (!pickupCheck.compatible) return false;

    // 3. Gender
    const partnerGender = journey.user.gender ? journey.user.gender.toLowerCase() : null;
    const currentUserGender = user.gender ? user.gender.toLowerCase() : null;
    const partnerPref = journey.genderPreference.toLowerCase();

    let allowed = false;
    if (genderPreference === "women_only") {
      allowed = partnerGender === "female" && partnerPref !== "men_only";
    } else if (genderPreference === "men_only") {
      allowed = partnerGender === "male" && partnerPref !== "women_only";
    } else if (genderPreference === "no_preference") {
      if (partnerPref === "women_only") allowed = currentUserGender === "female";
      else if (partnerPref === "men_only") allowed = currentUserGender === "male";
      else allowed = true;
    }

    if (allowed) {
      seenStreamUserIds.add(journey.userId);
    }
    return allowed;
  });

  return matched.map((journey) => {
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
      verified: true,
      isAvailable: journey.status === "ACTIVE",
      origin: journey.origin,
      approxPickupDistance: pickupMeta.distanceText,
      pickupDistanceKm: pickupMeta.distanceKm,
      destination: journey.destination,
      destinationCompatibility: destMeta.compatibility,
      compatibilityScore: destMeta.scorePercent,
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
}

// GET /api/rides/stream — Server-Sent Events real-time companion feed
export async function GET(req: NextRequest) {
  const user = await getAuthenticatedRideUser(req);
  if (!user) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  const { searchParams } = new URL(req.url);
  const destination = searchParams.get("destination")?.trim() || "";
  const origin = searchParams.get("origin")?.trim() || "";
  const genderPrefParam = (searchParams.get("genderPreference") || "no_preference").trim().toLowerCase();
  const genderPreference = VALID_GENDER_PREFERENCES.includes(genderPrefParam as GenderPreference)
    ? (genderPrefParam as GenderPreference)
    : "no_preference";

  const destLat = parseFloat(searchParams.get("destLat") || "");
  const destLng = parseFloat(searchParams.get("destLng") || "");
  const originLat = parseFloat(searchParams.get("originLat") || "");
  const originLng = parseFloat(searchParams.get("originLng") || "");

  const encoder = new TextEncoder();
  let intervalId: NodeJS.Timeout | null = null;

  const stream = new ReadableStream({
    async start(controller) {
      // Send connection acknowledgement
      controller.enqueue(
        encoder.encode(`event: connected\ndata: ${JSON.stringify({ status: "connected", timestamp: Date.now() })}\n\n`)
      );

      // Send initial live matches if destination is specified
      if (destination.length >= 2) {
        try {
          const partners = await fetchLiveMatches(
            user,
            destination,
            origin,
            genderPreference,
            destLat,
            destLng,
            originLat,
            originLng
          );
          controller.enqueue(
            encoder.encode(
              `event: matches\ndata: ${JSON.stringify({
                count: partners.length,
                partners,
                timestamp: Date.now(),
              })}\n\n`
            )
          );
        } catch (err) {
          console.error("Initial SSE live match fetch error:", err);
        }
      }

      // Real-time polling push every 5 seconds
      intervalId = setInterval(async () => {
        if (req.signal.aborted) {
          if (intervalId) clearInterval(intervalId);
          return;
        }

        if (destination.length >= 2) {
          try {
            const partners = await fetchLiveMatches(
              user,
              destination,
              origin,
              genderPreference,
              destLat,
              destLng,
              originLat,
              originLng
            );
            controller.enqueue(
              encoder.encode(
                `event: matches\ndata: ${JSON.stringify({
                  count: partners.length,
                  partners,
                  timestamp: Date.now(),
                })}\n\n`
              )
            );
          } catch (err) {
            console.error("SSE interval fetch error:", err);
          }
        }
      }, 5000);
    },
    cancel() {
      if (intervalId) clearInterval(intervalId);
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
