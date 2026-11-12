import { NextRequest, NextResponse } from "next/server";
import { db } from "@/app/lib/db";
import { getAuthenticatedRideUser } from "@/app/lib/ride-auth";
import { recordRidesPresence } from "@/app/lib/rides-presence";
import {
  VALID_GENDER_PREFERENCES,
  GenderPreference,
  validateGenderFilterAccess,
  queryMatchedPartners,
} from "@/app/lib/ride-matching";

export { VALID_GENDER_PREFERENCES, type GenderPreference };

// GET /api/rides — Destination-Based Live Travel Partner Matching
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
    const browseMode = searchParams.get("browse") === "active";
    const destination = searchParams.get("destination")?.trim() || "";
    const origin = searchParams.get("origin")?.trim() || "";
    const genderPrefParam = (searchParams.get("genderPreference") || "no_preference").trim().toLowerCase();

    if (!browseMode && (!destination || destination.length < 2)) {
      return NextResponse.json(
        {
          success: false,
          error: "Please enter a valid destination to find travel partners (min 2 characters).",
        },
        { status: 400 }
      );
    }

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

    const destLat = parseFloat(searchParams.get("destLat") || "");
    const destLng = parseFloat(searchParams.get("destLng") || "");
    const hasDestCoords = Number.isFinite(destLat) && Number.isFinite(destLng);

    const originLat = parseFloat(searchParams.get("originLat") || "");
    const originLng = parseFloat(searchParams.get("originLng") || "");
    const hasOriginCoords = Number.isFinite(originLat) && Number.isFinite(originLng);

    const policyError = validateGenderFilterAccess(user.gender, genderPreference, "search");
    if (policyError) {
      return NextResponse.json({ success: false, error: policyError }, { status: 403 });
    }

    if (hasOriginCoords) {
      await recordRidesPresence({
        userId: user.id,
        lat: originLat,
        lng: originLng,
        pickupLocation: origin || "My Current Location",
        destinationLocation: destination || undefined,
        destinationLat: hasDestCoords ? destLat : null,
        destinationLng: hasDestCoords ? destLng : null,
        genderPreference,
      });
    }

    const sanitizedResults = await queryMatchedPartners({
      user,
      browseMode,
      destination,
      origin,
      genderPreference,
      destLat: hasDestCoords ? destLat : undefined,
      destLng: hasDestCoords ? destLng : undefined,
      originLat: hasOriginCoords ? originLat : undefined,
      originLng: hasOriginCoords ? originLng : undefined,
      includeActiveExplorers: true,
    });

    const myActiveJourney = await db.travelJourney.findFirst({
      where: {
        userId: user.id,
        status: "ACTIVE",
      },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        origin: true,
        destination: true,
        originLat: true,
        originLng: true,
        destinationLat: true,
        destinationLng: true,
        genderPreference: true,
        createdAt: true,
      },
    });

    return NextResponse.json({
      success: true,
      count: sanitizedResults.length,
      partners: sanitizedResults,
      currentUserVerified: user.verified,
      myActiveJourney,
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

// POST /api/rides — Register / Index an Active Travel Journey
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
    const policyError = validateGenderFilterAccess(user.gender, genderPreference, "post");
    if (policyError) {
      return NextResponse.json({ success: false, error: policyError }, { status: 403 });
    }

    const originLat = typeof body.originLat === "number" && Number.isFinite(body.originLat) ? body.originLat : null;
    const originLng = typeof body.originLng === "number" && Number.isFinite(body.originLng) ? body.originLng : null;
    const destinationLat = typeof body.destinationLat === "number" && Number.isFinite(body.destinationLat) ? body.destinationLat : null;
    const destinationLng = typeof body.destinationLng === "number" && Number.isFinite(body.destinationLng) ? body.destinationLng : null;

    await db.travelJourney.updateMany({
      where: {
        userId: user.id,
        status: "ACTIVE",
      },
      data: { status: "COMPLETED" },
    });

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
