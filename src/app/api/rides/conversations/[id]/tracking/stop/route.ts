import { NextRequest, NextResponse } from "next/server";
import { db } from "@/app/lib/db";
import { getAuthenticatedRideUser } from "@/app/lib/ride-auth";

interface RouteContext {
  params: Promise<{ id: string }>;
}

// POST /api/rides/conversations/[id]/tracking/stop — Pause, resume, or end live journey tracking
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
        { success: false, error: "Tracking session not found." },
        { status: 404 }
      );
    }

    const body = await req.json().catch(() => ({}));
    const action = typeof body.action === "string" ? body.action.toUpperCase() : "STOP_SHARING";

    if (!["STOP_SHARING", "RESUME_SHARING", "END_JOURNEY"].includes(action)) {
      return NextResponse.json(
        { success: false, error: "Action must be STOP_SHARING, RESUME_SHARING, or END_JOURNEY." },
        { status: 400 }
      );
    }

    let updateData: Record<string, unknown> = {};
    let statusText = "";

    if (action === "STOP_SHARING") {
      if (isP1) {
        updateData.participant1Sharing = false;
        updateData.p1Lat = null;
        updateData.p1Lng = null;
      } else {
        updateData.participant2Sharing = false;
        updateData.p2Lat = null;
        updateData.p2Lng = null;
      }
      statusText = `⏸️ ${user.fullName} paused live location sharing.`;
    } else if (action === "RESUME_SHARING") {
      const myConsent = isP1 ? tracking.participant1Consent : tracking.participant2Consent;
      if (!myConsent) {
        return NextResponse.json(
          { success: false, error: "Cannot resume sharing without consent." },
          { status: 400 }
        );
      }
      if (isP1) {
        updateData.participant1Sharing = true;
      } else {
        updateData.participant2Sharing = true;
      }
      statusText = `▶️ ${user.fullName} resumed live location sharing.`;
    } else if (action === "END_JOURNEY") {
      updateData = {
        journeyStatus: "COMPLETED",
        completedAt: new Date(),
        participant1Sharing: false,
        participant2Sharing: false,
        p1Lat: null,
        p1Lng: null,
        p2Lat: null,
        p2Lng: null,
      };
      statusText = "🏁 Journey completed! Live GPS tracking has ended for all participants.";
    }

    await db.travelLiveTracking.update({
      where: { conversationId: id },
      data: updateData,
    });

    await db.travelMessage.create({
      data: {
        conversationId: id,
        senderId: user.id,
        senderName: user.fullName,
        text: statusText,
        messageType: "STATUS_UPDATE",
      },
    });

    return NextResponse.json({
      success: true,
      action,
      message: statusText,
    });
  } catch (error) {
    console.error("POST /api/rides/conversations/[id]/tracking/stop error:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error." },
      { status: 500 }
    );
  }
}
