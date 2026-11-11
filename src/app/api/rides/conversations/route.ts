import { NextRequest, NextResponse } from "next/server";
import { db } from "@/app/lib/db";
import { getAuthenticatedRideUser } from "@/app/lib/ride-auth";

// GET /api/rides/conversations — List active private conversations for current student
export async function GET(req: NextRequest) {
  try {
    const user = await getAuthenticatedRideUser(req);
    if (!user) {
      return NextResponse.json(
        { success: false, error: "Unauthorized: Please log in." },
        { status: 401 }
      );
    }

    const conversations = await db.travelConversation.findMany({
      where: {
        OR: [{ participant1Id: user.id }, { participant2Id: user.id }],
        status: "ACTIVE",
      },
      include: {
        messages: {
          orderBy: { createdAt: "desc" },
          take: 1, // latest message
        },
      },
      orderBy: { updatedAt: "desc" },
      take: 30,
    });

    const partnerUserIds = conversations.map((c) =>
      c.participant1Id === user.id ? c.participant2Id : c.participant1Id
    );

    const partnerUsers = await db.user.findMany({
      where: { id: { in: partnerUserIds } },
      select: {
        id: true,
        fullName: true,
        university: true,
        department: true,
        verified: true,
      },
    });

    const userMap = new Map(partnerUsers.map((u) => [u.id, u]));

    const mapped = conversations.map((conv) => {
      const partnerId = conv.participant1Id === user.id ? conv.participant2Id : conv.participant1Id;
      const partner = userMap.get(partnerId);
      const initials = partner?.fullName
        ? partner.fullName.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase()
        : "ST";
      const shortUni = partner?.university
        ? partner.university.replace("University of ", "").replace(" University", "")
        : "Campus";

      const lastMsg = conv.messages[0] || null;

      return {
        id: conv.id,
        partnerId,
        partnerName: partner?.fullName || "Verified Student",
        partnerAvatarInitials: initials,
        partnerUniversity: partner?.university || "University of Dhaka",
        partnerDepartment: partner?.department || "Academic Department",
        partnerBadge: `Verified ${shortUni} Student`,
        meetingLocation: conv.meetingLocation,
        meetingLat: conv.meetingLat,
        meetingLng: conv.meetingLng,
        meetingConfirmed: conv.meetingConfirmed,
        status: conv.status,
        lastMessage: lastMsg
          ? {
              text: lastMsg.text,
              senderId: lastMsg.senderId,
              messageType: lastMsg.messageType,
              createdAt: lastMsg.createdAt,
            }
          : null,
        updatedAt: conv.updatedAt,
      };
    });

    return NextResponse.json({
      success: true,
      count: mapped.length,
      conversations: mapped,
    });
  } catch (error) {
    console.error("GET /api/rides/conversations error:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error fetching conversations." },
      { status: 500 }
    );
  }
}
