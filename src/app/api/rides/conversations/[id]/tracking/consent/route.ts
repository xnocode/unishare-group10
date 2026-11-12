import { NextRequest, NextResponse } from "next/server";
import { db } from "@/app/lib/db";
import { getAuthenticatedRideUser } from "@/app/lib/ride-auth";

interface RouteContext {
  params: Promise<{ id: string }>;
}

// POST /api/rides/conversations/[id]/tracking/consent — Explicit consent agreement/revocation
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

    const body = await req.json().catch(() => ({}));
    if (typeof body.consent !== "boolean") {
      return NextResponse.json(
        { success: false, error: "Body field 'consent' (boolean) is required." },
        { status: 400 }
      );
    }

    const consentValue = body.consent;

    // Retrieve or create tracking session
    let tracking = conversation.tracking;
    if (!tracking) {
      tracking = await db.travelLiveTracking.create({
        data: {
          conversationId: id,
          journeyStatus: "NOT_STARTED",
        },
      });
    }

    const p1Consent = isP1 ? consentValue : tracking.participant1Consent;
    const p2Consent = isP2 ? consentValue : tracking.participant2Consent;
    const bothConsented = p1Consent && p2Consent;

    const updateData: Record<string, unknown> = {};

    if (consentValue) {
      // Granting consent
      if (isP1) {
        updateData.participant1Consent = true;
        updateData.participant1Sharing = true;
      } else {
        updateData.participant2Consent = true;
        updateData.participant2Sharing = true;
      }

      if (bothConsented) {
        updateData.journeyStatus = "IN_PROGRESS";
        if (!tracking.startedAt) {
          updateData.startedAt = new Date();
        }
      }

      // Add audit message to thread
      await db.travelMessage.create({
        data: {
          conversationId: id,
          senderId: user.id,
          senderName: user.fullName,
          text: bothConsented
            ? "🟢 Both travel partners have agreed to live GPS tracking! Live journey sharing is now active."
            : `📍 ${user.fullName} granted consent for live GPS tracking. Waiting for travel partner's agreement.`,
          messageType: "STATUS_UPDATE",
        },
      });
    } else {
      // Revoking consent
      if (isP1) {
        updateData.participant1Consent = false;
        updateData.participant1Sharing = false;
        updateData.p1Lat = null;
        updateData.p1Lng = null;
      } else {
        updateData.participant2Consent = false;
        updateData.participant2Sharing = false;
        updateData.p2Lat = null;
        updateData.p2Lng = null;
      }

      // If either revokes, journey live tracking pauses
      await db.travelMessage.create({
        data: {
          conversationId: id,
          senderId: user.id,
          senderName: user.fullName,
          text: `🛑 ${user.fullName} revoked live GPS tracking consent. Location sharing has ended.`,
          messageType: "STATUS_UPDATE",
        },
      });
    }

    const updatedTracking = await db.travelLiveTracking.update({
      where: { conversationId: id },
      data: updateData,
    });

    return NextResponse.json({
      success: true,
      consent: consentValue,
      bothConsented,
      journeyStatus: updatedTracking.journeyStatus,
      message: consentValue
        ? (bothConsented ? "Mutual consent complete! Live tracking is active." : "Consent registered. Awaiting partner consent.")
        : "Consent successfully revoked. Location sharing stopped.",
    });
  } catch (error) {
    console.error("POST /api/rides/conversations/[id]/tracking/consent error:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error." },
      { status: 500 }
    );
  }
}

