import { NextRequest, NextResponse } from "next/server";
import { db } from "@/app/lib/db";
import { getAuthenticatedRideUser } from "@/app/lib/ride-auth";

interface RouteContext {
  params: Promise<{ id: string }>;
}

// GET /api/rides/conversations/[id]/arrival — Check arrival states and proximity
export async function GET(req: NextRequest, context: RouteContext) {
  try {
    const user = await getAuthenticatedRideUser(req);
    if (!user) {
      return NextResponse.json({ success: false, error: "Unauthorized." }, { status: 401 });
    }

    const { id } = await context.params;
    const conversation = await db.travelConversation.findUnique({
      where: { id },
      include: { tracking: true },
    });

    if (!conversation) {
      return NextResponse.json({ success: false, error: "Conversation not found." }, { status: 404 });
    }

    const isP1 = conversation.participant1Id === user.id;
    const isP2 = conversation.participant2Id === user.id;
    if (!isP1 && !isP2) {
      return NextResponse.json({ success: false, error: "Forbidden: Not a participant." }, { status: 403 });
    }

    const tracking = conversation.tracking;
    if (!tracking) {
      return NextResponse.json({
        success: true,
        arrival: {
          myArrived: false,
          partnerArrived: false,
          bothArrived: false,
          destinationName: null,
          proximityThresholdMeters: 100,
        },
      });
    }

    const myArrived = isP1 ? tracking.p1Arrived : tracking.p2Arrived;
    const myArrivedAt = isP1 ? tracking.p1ArrivedAt : tracking.p2ArrivedAt;
    const partnerArrived = isP1 ? tracking.p2Arrived : tracking.p1Arrived;
    const partnerArrivedAt = isP1 ? tracking.p2ArrivedAt : tracking.p1ArrivedAt;
    const bothArrived = tracking.p1Arrived && tracking.p2Arrived;

    return NextResponse.json({
      success: true,
      arrival: {
        myArrived,
        myArrivedAt,
        partnerArrived,
        partnerArrivedAt,
        bothArrived,
        destinationName: tracking.destinationName,
        destinationLat: tracking.destinationLat,
        destinationLng: tracking.destinationLng,
        proximityThresholdMeters: tracking.proximityThresholdMeters,
        journeyStatus: tracking.journeyStatus,
      },
    });
  } catch (error) {
    console.error("GET /api/rides/conversations/[id]/arrival error:", error);
    return NextResponse.json({ success: false, error: "Internal server error." }, { status: 500 });
  }
}

// POST /api/rides/conversations/[id]/arrival — Manual arrival confirmation
export async function POST(req: NextRequest, context: RouteContext) {
  try {
    const user = await getAuthenticatedRideUser(req);
    if (!user) {
      return NextResponse.json({ success: false, error: "Unauthorized." }, { status: 401 });
    }

    const { id } = await context.params;
    const conversation = await db.travelConversation.findUnique({
      where: { id },
      include: { tracking: true },
    });

    if (!conversation) {
      return NextResponse.json({ success: false, error: "Conversation not found." }, { status: 404 });
    }

    const isP1 = conversation.participant1Id === user.id;
    const isP2 = conversation.participant2Id === user.id;
    if (!isP1 && !isP2) {
      return NextResponse.json({ success: false, error: "Forbidden: Not a participant." }, { status: 403 });
    }

    const now = new Date();
    const destName = conversation.tracking?.destinationName || conversation.meetingLocation || "the destination";

    const updated = await db.travelLiveTracking.upsert({
      where: { conversationId: id },
      update: isP1
        ? { p1Arrived: true, p1ArrivedAt: now }
        : { p2Arrived: true, p2ArrivedAt: now },
      create: {
        conversationId: id,
        ...(isP1 ? { p1Arrived: true, p1ArrivedAt: now } : { p2Arrived: true, p2ArrivedAt: now }),
      },
    });

    // Notify thread
    await db.travelMessage.create({
      data: {
        conversationId: id,
        senderId: user.id,
        senderName: user.fullName,
        text: `🎯 Arrival Confirmed: ${user.fullName} has arrived at ${destName}!`,
        messageType: "STATUS_UPDATE",
      },
    });

    const partnerArrived = isP1 ? updated.p2Arrived : updated.p1Arrived;
    if (partnerArrived) {
      await db.travelMessage.create({
        data: {
          conversationId: id,
          senderId: "system",
          senderName: "UniShare Transit",
          text: `🎉 Both travel partners have reached ${destName}! You can now mark the journey completed.`,
          messageType: "STATUS_UPDATE",
        },
      });
    }

    return NextResponse.json({
      success: true,
      message: `Arrival confirmed at ${destName}!`,
      arrived: true,
      arrivedAt: now.toISOString(),
      bothArrived: updated.p1Arrived && updated.p2Arrived,
    });
  } catch (error) {
    console.error("POST /api/rides/conversations/[id]/arrival error:", error);
    return NextResponse.json({ success: false, error: "Internal server error." }, { status: 500 });
  }
}
