import { NextRequest, NextResponse } from "next/server";
import { db } from "@/app/lib/db";
import { getAuthenticatedRideUser } from "@/app/lib/ride-auth";

// POST /api/rides/match — Select one or multiple travel partners & send co-travel invitations
export async function POST(req: NextRequest) {
  try {
    const user = await getAuthenticatedRideUser(req);
    if (!user) {
      return NextResponse.json(
        { success: false, error: "Unauthorized: Please log in to connect with travel partners." },
        { status: 401 }
      );
    }

    if (!user.verified) {
      return NextResponse.json(
        { success: false, error: "Verification required: Only verified students can connect with travel partners." },
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

    const rawPartnerIds = body.partnerIds;
    if (!Array.isArray(rawPartnerIds) || rawPartnerIds.length === 0) {
      return NextResponse.json(
        { success: false, error: "Please select at least one travel partner (partnerIds array required)." },
        { status: 400 }
      );
    }

    // Filter valid IDs and remove duplicates or self
    const partnerIds = Array.from(
      new Set(
        rawPartnerIds
          .filter((id) => typeof id === "string" && id.trim().length > 0 && id.trim() !== user.id)
          .map((id) => id.trim())
      )
    );

    if (partnerIds.length === 0) {
      return NextResponse.json(
        { success: false, error: "No valid partner IDs selected." },
        { status: 400 }
      );
    }

    // Verify all selected partners are genuine verified university students
    const partners = await db.user.findMany({
      where: {
        id: { in: partnerIds },
        verified: true,
      },
      select: {
        id: true,
        fullName: true,
        university: true,
        department: true,
      },
    });

    if (partners.length === 0) {
      return NextResponse.json(
        { success: false, error: "None of the selected travel partners were found as verified students." },
        { status: 404 }
      );
    }

    const journeyId = typeof body.journeyId === "string" ? body.journeyId.trim() : null;
    const message = typeof body.message === "string" ? body.message.trim().slice(0, 300) : "Let's travel together on this campus route!";

    // Create invitations in DB
    const createdInvitations = await db.$transaction(
      partners.map((partner) =>
        db.travelPartnerInvitation.create({
          data: {
            senderId: user.id,
            receiverId: partner.id,
            journeyId: journeyId,
            message: message,
            status: "PENDING",
          },
        })
      )
    );

    return NextResponse.json({
      success: true,
      count: createdInvitations.length,
      message: `Travel request sent to ${partners.length} verified partner${partners.length > 1 ? "s" : ""}.`,
      invitedPartners: partners.map((p) => ({
        id: p.id,
        fullName: p.fullName,
        university: p.university,
      })),
      invitations: createdInvitations.map((inv) => ({
        id: inv.id,
        receiverId: inv.receiverId,
        status: inv.status,
        createdAt: inv.createdAt,
      })),
    });
  } catch (error) {
    console.error("POST /api/rides/match error:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error creating travel partner invitations." },
      { status: 500 }
    );
  }
}

// GET /api/rides/match — List active partner invitations for current student
export async function GET(req: NextRequest) {
  try {
    const user = await getAuthenticatedRideUser(req);
    if (!user) {
      return NextResponse.json(
        { success: false, error: "Unauthorized." },
        { status: 401 }
      );
    }

    const invitations = await db.travelPartnerInvitation.findMany({
      where: {
        OR: [{ senderId: user.id }, { receiverId: user.id }],
      },
      orderBy: { createdAt: "desc" },
      take: 20,
    });

    return NextResponse.json({
      success: true,
      count: invitations.length,
      invitations,
    });
  } catch (error) {
    console.error("GET /api/rides/match error:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error fetching invitations." },
      { status: 500 }
    );
  }
}
