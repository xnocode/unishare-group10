import { NextRequest, NextResponse } from "next/server";
import { db } from "@/app/lib/db";
import { getAuthenticatedRideUser } from "@/app/lib/ride-auth";

interface RouteContext {
  params: Promise<{ id: string }>;
}

// GET /api/rides/conversations/[id] — View private conversation thread & meeting info
export async function GET(req: NextRequest, context: RouteContext) {
  try {
    const user = await getAuthenticatedRideUser(req);
    if (!user) {
      return NextResponse.json({ success: false, error: "Unauthorized: Please log in." }, { status: 401 });
    }

    const { id } = await context.params;
    const conversation = await db.travelConversation.findUnique({
      where: { id },
      include: {
        messages: {
          orderBy: { createdAt: "asc" },
          take: 100,
        },
      },
    });

    if (!conversation) {
      return NextResponse.json({ success: false, error: "Conversation not found." }, { status: 404 });
    }

    // STRICT AUTHORIZATION: Only participant1 or participant2 can access!
    if (conversation.participant1Id !== user.id && conversation.participant2Id !== user.id) {
      return NextResponse.json(
        { success: false, error: "Forbidden: You are not an authorized participant in this private conversation." },
        { status: 403 }
      );
    }

    const partnerId = conversation.participant1Id === user.id ? conversation.participant2Id : conversation.participant1Id;
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

    const initials = partner?.fullName
      ? partner.fullName.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase()
      : "ST";
    const shortUni = partner?.university
      ? partner.university.replace("University of ", "").replace(" University", "")
      : "Campus";

    return NextResponse.json({
      success: true,
      conversation: {
        id: conversation.id,
        partnerId,
        partnerName: partner?.fullName || "Verified Student",
        partnerAvatarInitials: initials,
        partnerUniversity: partner?.university || "University of Dhaka",
        partnerDepartment: partner?.department || "Academic Department",
        partnerBadge: `Verified ${shortUni} Student`,
        meetingLocation: conversation.meetingLocation,
        meetingLat: conversation.meetingLat,
        meetingLng: conversation.meetingLng,
        meetingConfirmed: conversation.meetingConfirmed,
        status: conversation.status,
        messages: conversation.messages.map((m) => ({
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
        createdAt: conversation.createdAt,
      },
    });
  } catch (error) {
    console.error("GET /api/rides/conversations/[id] error:", error);
    return NextResponse.json({ success: false, error: "Internal server error." }, { status: 500 });
  }
}

// PATCH /api/rides/conversations/[id] — Propose or confirm meeting location
export async function PATCH(req: NextRequest, context: RouteContext) {
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
      return NextResponse.json({ success: false, error: "Forbidden: Not an authorized participant." }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    const meetingLocation = typeof body.meetingLocation === "string" ? body.meetingLocation.trim().slice(0, 200) : undefined;
    const meetingLat = typeof body.meetingLat === "number" ? body.meetingLat : undefined;
    const meetingLng = typeof body.meetingLng === "number" ? body.meetingLng : undefined;
    const rawConfirmed = body.meetingConfirmed !== undefined ? body.meetingConfirmed : body.confirmMeeting;
    const meetingConfirmed = typeof rawConfirmed === "boolean" ? rawConfirmed : undefined;

    const dataToUpdate: Record<string, unknown> = {};
    if (meetingLocation !== undefined) dataToUpdate.meetingLocation = meetingLocation;
    if (meetingLat !== undefined) dataToUpdate.meetingLat = meetingLat;
    if (meetingLng !== undefined) dataToUpdate.meetingLng = meetingLng;
    if (meetingConfirmed !== undefined) dataToUpdate.meetingConfirmed = meetingConfirmed;

    const updated = await db.travelConversation.update({
      where: { id },
      data: dataToUpdate,
    });

    // Create meeting update message in thread & notify peer
    if (meetingLocation || meetingConfirmed !== undefined) {
      const spotName = meetingLocation || updated.meetingLocation || "Intended Meeting Point";
      const isConfirmed = Boolean(meetingConfirmed ?? updated.meetingConfirmed);
      const recipientId =
        conversation.participant1Id === user.id
          ? conversation.participant2Id
          : conversation.participant1Id;

      await db.travelMessage.create({
        data: {
          conversationId: id,
          senderId: user.id,
          senderName: user.fullName,
          text: isConfirmed
            ? `🤝 Meeting point confirmed: ${spotName}`
            : `📍 Proposed meeting point: ${spotName}`,
          messageType: "MEETING_LOCATION",
          locationName: spotName,
          locationLat: meetingLat || updated.meetingLat || null,
          locationLng: meetingLng || updated.meetingLng || null,
        },
      });

      if (recipientId) {
        await db.notification
          .create({
            data: {
              userId: recipientId,
              category: "ride",
              title: isConfirmed
                ? `Pickup confirmed · ${spotName}`
                : `${user.fullName} suggested pickup: ${spotName}`,
              body: "Open Campus Rides to view map meetup details.",
              actionLabel: "Open Rides",
              actionHref: "/rides",
            },
          })
          .catch(() => {});
      }
    }

    return NextResponse.json({
      success: true,
      message: "Meeting point updated successfully.",
      meetingConfirmed: updated.meetingConfirmed,
      meetingLocation: updated.meetingLocation,
      conversation: updated,
    });
  } catch (error) {
    console.error("PATCH /api/rides/conversations/[id] error:", error);
    return NextResponse.json({ success: false, error: "Internal server error." }, { status: 500 });
  }
}
