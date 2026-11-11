import { NextRequest, NextResponse } from "next/server";
import { db } from "@/app/lib/db";
import { getAuthenticatedRideUser } from "@/app/lib/ride-auth";

interface RouteContext {
  params: Promise<{ id: string }>;
}

// POST /api/rides/conversations/[id]/messages — Send private message or meeting location
export async function POST(req: NextRequest, context: RouteContext) {
  try {
    const user = await getAuthenticatedRideUser(req);
    if (!user) {
      return NextResponse.json({ success: false, error: "Unauthorized: Please log in." }, { status: 401 });
    }

    const { id } = await context.params;
    const conversation = await db.travelConversation.findUnique({ where: { id } });
    if (!conversation) {
      return NextResponse.json({ success: false, error: "Conversation not found." }, { status: 404 });
    }

    // STRICT AUTHORIZATION: Participant check
    if (conversation.participant1Id !== user.id && conversation.participant2Id !== user.id) {
      return NextResponse.json(
        { success: false, error: "Forbidden: You are not authorized to post in this private conversation." },
        { status: 403 }
      );
    }

    const body = await req.json().catch(() => ({}));
    const text = typeof body.text === "string" ? body.text.trim().slice(0, 1000) : "";
    const messageType = ["TEXT", "MEETING_LOCATION", "STATUS_UPDATE"].includes(body.messageType)
      ? body.messageType
      : "TEXT";

    if (!text) {
      return NextResponse.json(
        { success: false, error: "Message text cannot be empty." },
        { status: 400 }
      );
    }

    const locationName = typeof body.locationName === "string" ? body.locationName.trim().slice(0, 200) : null;
    const locationLat = typeof body.locationLat === "number" ? body.locationLat : null;
    const locationLng = typeof body.locationLng === "number" ? body.locationLng : null;

    const message = await db.travelMessage.create({
      data: {
        conversationId: id,
        senderId: user.id,
        senderName: user.fullName,
        text,
        messageType,
        locationName,
        locationLat,
        locationLng,
      },
    });

    // Update conversation updatedAt timestamp and meeting location if provided
    await db.travelConversation.update({
      where: { id },
      data: {
        updatedAt: new Date(),
        ...(locationName ? { meetingLocation: locationName, meetingLat: locationLat, meetingLng: locationLng } : {}),
      },
    });

    return NextResponse.json({
      success: true,
      message: {
        id: message.id,
        senderId: message.senderId,
        senderName: message.senderName,
        text: message.text,
        messageType: message.messageType,
        locationName: message.locationName,
        locationLat: message.locationLat,
        locationLng: message.locationLng,
        isSelf: true,
        createdAt: message.createdAt,
      },
    });
  } catch (error) {
    console.error("POST /api/rides/conversations/[id]/messages error:", error);
    return NextResponse.json({ success: false, error: "Internal server error." }, { status: 500 });
  }
}

// GET /api/rides/conversations/[id]/messages — Get message thread
export async function GET(req: NextRequest, context: RouteContext) {
  try {
    const user = await getAuthenticatedRideUser(req);
    if (!user) {
      return NextResponse.json({ success: false, error: "Unauthorized." }, { status: 401 });
    }

    const { id } = await context.params;
    const conversation = await db.travelConversation.findUnique({ where: { id } });
    if (!conversation) {
      return NextResponse.json({ success: false, error: "Conversation not found." }, { status: 404 });
    }

    if (conversation.participant1Id !== user.id && conversation.participant2Id !== user.id) {
      return NextResponse.json({ success: false, error: "Forbidden." }, { status: 403 });
    }

    const messages = await db.travelMessage.findMany({
      where: { conversationId: id },
      orderBy: { createdAt: "asc" },
      take: 100,
    });

    return NextResponse.json({
      success: true,
      count: messages.length,
      messages: messages.map((m) => ({
        id: m.id,
        senderId: m.senderId,
        senderName: m.senderName,
        text: m.text,
        messageType: m.messageType,
        locationName: m.locationName,
        locationLat: m.locationLat,
        locationLng: m.locationLng,
        isSelf: m.senderId === user.id,
        createdAt: m.createdAt,
      })),
    });
  } catch (error) {
    console.error("GET /api/rides/conversations/[id]/messages error:", error);
    return NextResponse.json({ success: false, error: "Internal server error." }, { status: 500 });
  }
}

