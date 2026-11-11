import { NextRequest, NextResponse } from "next/server";
import { db } from "@/app/lib/db";
import { getAuthenticatedRideUser } from "@/app/lib/ride-auth";

interface RouteContext {
  params: Promise<{ id: string }>;
}

// POST /api/rides/conversations/[id]/tracking/location — Push browser GPS update
export async function POST(req: NextRequest, context: RouteContext) {
  try {
    const user = await getAuthenticatedRideUser(req);
    if (!user) {
      return NextResponse.json(
        { success: false, error: "Unauthorized: Please log in." },
        { status: 401 }
      );
    }

    const { id } = await context.params;
    const conversation = await db.travelConversation.findUnique({
      where: { id },
      include: {
        tracking: true,
      },
    });

    if (!conversation) {
      return NextResponse.json(
        { success: false, error: "Conversation not found." },
        { status: 404 }
      );
    }

    const isP1 = conversation.participant1Id === user.id;
    const isP2 = conversation.participant2Id === user.id;
    if (!isP1 && !isP2) {
      return NextResponse.json(
        { success: false, error: "Forbidden: Not an authorized participant." },
        { status: 403 }
      );
    }

    const tracking = conversation.tracking;
    if (!tracking) {
      return NextResponse.json(
        { success: false, error: "Tracking session not initialized. Please consent first." },
        { status: 400 }
      );
    }

    // Consent enforcement
    const myConsent = isP1 ? tracking.participant1Consent : tracking.participant2Consent;
    if (!myConsent) {
      return NextResponse.json(
        { success: false, error: "Consent required: You must explicitly agree to share location before sending GPS coordinates." },
        { status: 403 }
      );
    }

    const bothConsented = tracking.participant1Consent && tracking.participant2Consent;
    if (!bothConsented) {
      return NextResponse.json(
        { success: false, error: "Awaiting mutual consent: Live tracking cannot start until both participants agree." },
        { status: 403 }
      );
    }

    if (tracking.journeyStatus === "COMPLETED") {
      return NextResponse.json(
        { success: false, error: "Journey has ended. Live tracking is closed." },
        { status: 400 }
      );
    }

    const body = await req.json().catch(() => ({}));
    const lat = Number(body.lat);
    const lng = Number(body.lng);

    if (isNaN(lat) || isNaN(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) {
      return NextResponse.json(
        { success: false, error: "Invalid GPS coordinates." },
        { status: 400 }
      );
    }

    const accuracy = typeof body.accuracy === "number" ? body.accuracy : null;
    const heading = typeof body.heading === "number" ? body.heading : null;
    const speed = typeof body.speed === "number" ? body.speed : null;
    const now = new Date();

    const updateData = isP1
      ? {
          p1Lat: lat,
          p1Lng: lng,
          p1Accuracy: accuracy,
          p1Heading: heading,
          p1Speed: speed,
          p1UpdatedAt: now,
          participant1Sharing: true,
          journeyStatus: "IN_PROGRESS",
        }
      : {
          p2Lat: lat,
          p2Lng: lng,
          p2Accuracy: accuracy,
          p2Heading: heading,
          p2Speed: speed,
          p2UpdatedAt: now,
          participant2Sharing: true,
          journeyStatus: "IN_PROGRESS",
        };

    await db.travelLiveTracking.update({
      where: { conversationId: id },
      data: updateData,
    });

    return NextResponse.json({
      success: true,
      message: "GPS location updated successfully.",
      updatedAt: now.toISOString(),
      lat,
      lng,
      accuracy,
    });
  } catch (error) {
    console.error("POST /api/rides/conversations/[id]/tracking/location error:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error." },
      { status: 500 }
    );
  }
}
