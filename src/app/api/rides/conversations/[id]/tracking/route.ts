import { NextRequest, NextResponse } from "next/server";
import { db } from "@/app/lib/db";
import { getAuthenticatedRideUser } from "@/app/lib/ride-auth";

interface RouteContext {
  params: Promise<{ id: string }>;
}

// GET /api/rides/conversations/[id]/tracking — Get live tracking state & partner coordinates
export async function GET(req: NextRequest, context: RouteContext) {
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

    // STRICT AUTHORIZATION: Only conversation participants can access live tracking!
    const isP1 = conversation.participant1Id === user.id;
    const isP2 = conversation.participant2Id === user.id;
    if (!isP1 && !isP2) {
      return NextResponse.json(
        { success: false, error: "Forbidden: You are not an authorized participant in this journey." },
        { status: 403 }
      );
    }

    // Retrieve or initialize tracking record
    let tracking = conversation.tracking;
    if (!tracking) {
      tracking = await db.travelLiveTracking.create({
        data: {
          conversationId: id,
          journeyStatus: "NOT_STARTED",
        },
      });
    }

    const partnerId = isP1 ? conversation.participant2Id : conversation.participant1Id;
    const partner = await db.user.findUnique({
      where: { id: partnerId },
      select: {
        id: true,
        fullName: true,
        university: true,
        department: true,
        verified: true,
      },
    });

    const myConsent = isP1 ? tracking.participant1Consent : tracking.participant2Consent;
    const partnerConsent = isP1 ? tracking.participant2Consent : tracking.participant1Consent;
    const bothConsented = tracking.participant1Consent && tracking.participant2Consent;

    const mySharing = isP1 ? tracking.participant1Sharing : tracking.participant2Sharing;
    const partnerSharing = isP1 ? tracking.participant2Sharing : tracking.participant1Sharing;

    // Resolve Partner live coordinates only when authorized & consented
    let partnerLocation = null;
    let freshnessSeconds: number | null = null;
    let isStale = false;

    const partnerUpdated = isP1 ? tracking.p2UpdatedAt : tracking.p1UpdatedAt;
    const partnerLat = isP1 ? tracking.p2Lat : tracking.p1Lat;
    const partnerLng = isP1 ? tracking.p2Lng : tracking.p1Lng;
    const partnerAcc = isP1 ? tracking.p2Accuracy : tracking.p1Accuracy;
    const partnerHeading = isP1 ? tracking.p2Heading : tracking.p1Heading;
    const partnerSpeed = isP1 ? tracking.p2Speed : tracking.p1Speed;

    if (bothConsented && partnerSharing && partnerLat !== null && partnerLng !== null && tracking.journeyStatus === "IN_PROGRESS") {
      const now = Date.now();
      const updatedTime = partnerUpdated ? new Date(partnerUpdated).getTime() : 0;
      freshnessSeconds = updatedTime > 0 ? Math.max(0, Math.round((now - updatedTime) / 1000)) : null;
      isStale = freshnessSeconds !== null ? freshnessSeconds > 45 : true;

      partnerLocation = {
        lat: partnerLat,
        lng: partnerLng,
        accuracy: partnerAcc,
        heading: partnerHeading,
        speed: partnerSpeed,
        updatedAt: partnerUpdated,
        freshnessSeconds,
        isStale,
      };
    }

    // Connection Status evaluation
    let connectionStatus: "NOT_STARTED" | "AWAITING_CONSENT" | "LIVE" | "STALE" | "PAUSED" | "COMPLETED" = "NOT_STARTED";
    if (tracking.journeyStatus === "COMPLETED") {
      connectionStatus = "COMPLETED";
    } else if (!bothConsented) {
      connectionStatus = "AWAITING_CONSENT";
    } else if (!partnerSharing || !mySharing) {
      connectionStatus = "PAUSED";
    } else if (isStale || freshnessSeconds === null) {
      connectionStatus = "STALE";
    } else {
      connectionStatus = "LIVE";
    }

    const partnerShortUni = partner?.university
      ? partner.university.replace("University of ", "").replace(" University", "")
      : "Campus";

    return NextResponse.json({
      success: true,
      tracking: {
        id: tracking.id,
        conversationId: id,
        journeyStatus: tracking.journeyStatus,
        startedAt: tracking.startedAt,
        completedAt: tracking.completedAt,
        myConsent,
        partnerConsent,
        bothConsented,
        mySharing,
        partnerSharing,
        partner: {
          id: partnerId,
          fullName: partner?.fullName || "Travel Companion",
          badge: `Verified ${partnerShortUni} Student`,
        },
        partnerLocation,
        connectionStatus,
        browserLimitationNotice:
          "Live GPS updates are transmitted while UniShare is in an active foreground browser tab. Standard mobile browsers pause web GPS background execution to protect battery life.",
      },
    });
  } catch (error) {
    console.error("GET /api/rides/conversations/[id]/tracking error:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error." },
      { status: 500 }
    );
  }
}
