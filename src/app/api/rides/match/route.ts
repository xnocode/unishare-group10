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

    // Reuse any open PENDING/ACCEPTED invitation to avoid duplicate spam on double-click or refresh
    const existingOpen = await db.travelPartnerInvitation.findMany({
      where: {
        senderId: user.id,
        receiverId: { in: partners.map((p) => p.id) },
        status: { in: ["PENDING", "ACCEPTED"] },
      },
      include: { conversation: { select: { id: true } } },
      orderBy: { createdAt: "desc" },
    });

    const existingByReceiver = new Map<string, (typeof existingOpen)[number]>();
    for (const inv of existingOpen) {
      if (!existingByReceiver.has(inv.receiverId)) {
        existingByReceiver.set(inv.receiverId, inv);
      }
    }

    const partnersToInvite = partners.filter((p) => !existingByReceiver.has(p.id));
    const newlyCreated = partnersToInvite.length > 0
      ? await db.$transaction(async (tx) => {
          const created = await Promise.all(
            partnersToInvite.map((partner) =>
              tx.travelPartnerInvitation.create({
                data: {
                  senderId: user.id,
                  receiverId: partner.id,
                  journeyId,
                  message,
                  status: "PENDING",
                },
              })
            )
          );
          await tx.notification.createMany({
            data: partnersToInvite.map((partner) => ({
              userId: partner.id,
              category: "rides",
              title: `Ride match request from ${user.fullName}`,
              body: message,
              actionLabel: "Review on Rides",
              actionHref: "/rides",
            })),
          });
          return created;
        })
      : [];

    const allInvitations = partners.map((partner) => {
      const created = newlyCreated.find((inv) => inv.receiverId === partner.id);
      if (created) {
        return {
          id: created.id,
          receiverId: created.receiverId,
          status: created.status,
          conversationId: null as string | null,
          createdAt: created.createdAt,
        };
      }
      const reused = existingByReceiver.get(partner.id)!;
      return {
        id: reused.id,
        receiverId: reused.receiverId,
        status: reused.status,
        conversationId: reused.conversation?.id ?? null,
        createdAt: reused.createdAt,
      };
    });

    return NextResponse.json({
      success: true,
      count: allInvitations.length,
      message:
        newlyCreated.length > 0
          ? `Travel request sent to ${newlyCreated.length} verified partner${newlyCreated.length > 1 ? "s" : ""}.`
          : "Active travel connection already exists with selected partner.",
      invitedPartners: partners.map((p) => ({
        id: p.id,
        fullName: p.fullName,
        university: p.university,
      })),
      invitations: allInvitations,
    });
  } catch (error) {
    console.error("POST /api/rides/match error:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error creating travel partner invitations." },
      { status: 500 }
    );
  }
}

// GET /api/rides/match — List active partner invitations & requests for current student
export async function GET(req: NextRequest) {
  try {
    const user = await getAuthenticatedRideUser(req);
    if (!user) {
      return NextResponse.json(
        { success: false, error: "Unauthorized." },
        { status: 401 }
      );
    }

    const allInvitations = await db.travelPartnerInvitation.findMany({
      where: {
        OR: [{ senderId: user.id }, { receiverId: user.id }],
      },
      include: {
        conversation: {
          select: {
            id: true,
            status: true,
            meetingLocation: true,
            meetingConfirmed: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
      take: 40,
    });

    // Fetch user details for all involved counterpart IDs
    const counterpartIds = Array.from(
      new Set(
        allInvitations.map((inv) =>
          inv.senderId === user.id ? inv.receiverId : inv.senderId
        )
      )
    );

    const counterpartUsers = await db.user.findMany({
      where: { id: { in: counterpartIds } },
      select: {
        id: true,
        fullName: true,
        university: true,
        department: true,
        verified: true,
      },
    });

    const userMap = new Map(counterpartUsers.map((u) => [u.id, u]));

    const incoming = allInvitations
      .filter((inv) => inv.receiverId === user.id)
      .map((inv) => {
        const sender = userMap.get(inv.senderId);
        const initials = sender?.fullName
          ? sender.fullName.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase()
          : "ST";
        const shortUni = sender?.university
          ? sender.university.replace("University of ", "").replace(" University", "")
          : "Campus";

        return {
          id: inv.id,
          senderId: inv.senderId,
          senderName: sender?.fullName || "Verified Student",
          senderAvatarInitials: initials,
          senderUniversity: sender?.university || "University of Dhaka",
          senderDepartment: sender?.department || "Academic Department",
          verificationBadge: `Verified ${shortUni} Student`,
          status: inv.status,
          message: inv.message,
          conversationId: inv.conversation?.id || null,
          createdAt: inv.createdAt,
        };
      });

    const outgoing = allInvitations
      .filter((inv) => inv.senderId === user.id)
      .map((inv) => {
        const receiver = userMap.get(inv.receiverId);
        const initials = receiver?.fullName
          ? receiver.fullName.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase()
          : "ST";
        const shortUni = receiver?.university
          ? receiver.university.replace("University of ", "").replace(" University", "")
          : "Campus";

        return {
          id: inv.id,
          receiverId: inv.receiverId,
          receiverName: receiver?.fullName || "Verified Student",
          receiverAvatarInitials: initials,
          receiverUniversity: receiver?.university || "University of Dhaka",
          receiverDepartment: receiver?.department || "Academic Department",
          verificationBadge: `Verified ${shortUni} Student`,
          status: inv.status,
          message: inv.message,
          conversationId: inv.conversation?.id || null,
          createdAt: inv.createdAt,
        };
      });

    return NextResponse.json({
      success: true,
      count: allInvitations.length,
      incoming,
      outgoing,
      invitations: allInvitations,
    });
  } catch (error) {
    console.error("GET /api/rides/match error:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error fetching invitations." },
      { status: 500 }
    );
  }
}

