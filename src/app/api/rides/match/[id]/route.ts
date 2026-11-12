import { NextRequest, NextResponse } from "next/server";
import { db } from "@/app/lib/db";
import { getAuthenticatedRideUser } from "@/app/lib/ride-auth";

interface RouteContext {
  params: Promise<{ id: string }>;
}

// PATCH /api/rides/match/[id] — Accept or Reject connection requests
export async function PATCH(req: NextRequest, context: RouteContext) {
  try {
    const user = await getAuthenticatedRideUser(req);
    if (!user) {
      return NextResponse.json(
        { success: false, error: "Unauthorized: Please log in." },
        { status: 401 }
      );
    }

    const { id } = await context.params;
    if (!id) {
      return NextResponse.json(
        { success: false, error: "Invitation ID is required." },
        { status: 400 }
      );
    }

    const invitation = await db.travelPartnerInvitation.findUnique({
      where: { id },
      include: {
        conversation: true,
      },
    });

    if (!invitation) {
      return NextResponse.json(
        { success: false, error: "Connection invitation not found." },
        { status: 404 }
      );
    }

    const body = await req.json().catch(() => ({}));
    const action = typeof body.action === "string" ? body.action.toUpperCase() : "";

    if (!["ACCEPT", "REJECT", "CANCEL"].includes(action)) {
      return NextResponse.json(
        { success: false, error: "Action must be ACCEPT, REJECT, or CANCEL." },
        { status: 400 }
      );
    }

    // Authorization checks:
    // Only the receiver can ACCEPT or REJECT
    // Only the sender can CANCEL
    if ((action === "ACCEPT" || action === "REJECT") && invitation.receiverId !== user.id) {
      return NextResponse.json(
        { success: false, error: "Forbidden: Only the intended recipient can accept or reject this request." },
        { status: 403 }
      );
    }

    if (action === "CANCEL" && invitation.senderId !== user.id) {
      return NextResponse.json(
        { success: false, error: "Forbidden: Only the sender can cancel this request." },
        { status: 403 }
      );
    }

    if (action === "ACCEPT") {
      // Update invitation, ensure conversation exists, and notify requester atomically
      const { updated, conversation } = await db.$transaction(async (tx) => {
        const nextInv = await tx.travelPartnerInvitation.update({
          where: { id },
          data: { status: "ACCEPTED" },
        });

        let conv = invitation.conversation;
        if (!conv) {
          conv = await tx.travelConversation.create({
            data: {
              invitationId: invitation.id,
              participant1Id: invitation.senderId,
              participant2Id: invitation.receiverId,
              status: "ACTIVE",
              messages: {
                create: {
                  senderId: user.id,
                  senderName: user.fullName,
                  text: "Travel connection accepted! You can now coordinate your meeting location and departure.",
                  messageType: "STATUS_UPDATE",
                },
              },
            },
          });
        }

        await tx.notification.create({
          data: {
            userId: invitation.senderId,
            category: "ride",
            title: `${user.fullName} accepted your ride request`,
            body: "Open Campus Rides to confirm pickup point, chat, and split your fare.",
            actionLabel: "Open Rides",
            actionHref: "/rides",
          },
        });

        return { updated: nextInv, conversation: conv };
      });

      return NextResponse.json({
        success: true,
        status: "ACCEPTED",
        message: "Travel connection request accepted. Private conversation opened.",
        invitation: updated,
        conversationId: conversation.id,
      });
    }

    if (action === "REJECT") {
      const updated = await db.$transaction(async (tx) => {
        const nextInv = await tx.travelPartnerInvitation.update({
          where: { id },
          data: { status: "REJECTED" },
        });
        await tx.notification.create({
          data: {
            userId: invitation.senderId,
            category: "ride",
            title: `Ride request declined by ${user.fullName}`,
            body: "No worries — invite another verified student on your campus route.",
            actionLabel: "Find partners",
            actionHref: "/rides",
          },
        });
        return nextInv;
      });

      return NextResponse.json({
        success: true,
        status: "REJECTED",
        message: "Travel connection request rejected.",
        invitation: updated,
      });
    }

    if (action === "CANCEL") {
      const updated = await db.travelPartnerInvitation.update({
        where: { id },
        data: { status: "CANCELLED" },
      });

      return NextResponse.json({
        success: true,
        status: "CANCELLED",
        message: "Travel connection request cancelled.",
        invitation: updated,
      });
    }
  } catch (error) {
    console.error("PATCH /api/rides/match/[id] error:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error updating connection request." },
      { status: 500 }
    );
  }
}

// GET /api/rides/match/[id] — View connection request details
export async function GET(req: NextRequest, context: RouteContext) {
  try {
    const user = await getAuthenticatedRideUser(req);
    if (!user) {
      return NextResponse.json({ success: false, error: "Unauthorized." }, { status: 401 });
    }

    const { id } = await context.params;
    const invitation = await db.travelPartnerInvitation.findUnique({
      where: { id },
      include: {
        conversation: true,
      },
    });

    if (!invitation) {
      return NextResponse.json({ success: false, error: "Invitation not found." }, { status: 404 });
    }

    if (invitation.senderId !== user.id && invitation.receiverId !== user.id) {
      return NextResponse.json({ success: false, error: "Forbidden." }, { status: 403 });
    }

    return NextResponse.json({ success: true, invitation });
  } catch (error) {
    console.error("GET /api/rides/match/[id] error:", error);
    return NextResponse.json({ success: false, error: "Internal server error." }, { status: 500 });
  }
}

