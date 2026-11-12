import { NextRequest, NextResponse } from "next/server";
import { db } from "@/app/lib/db";
import { getAuthenticatedRideUser } from "@/app/lib/ride-auth";
import {
  applySessionCookies,
  setVerifiedAccountCookieFromUser,
  toPublicUser,
} from "@/app/lib/auth";

interface RouteContext {
  params: Promise<{ id: string }>;
}

// POST /api/rides/conversations/[id]/split-fare — Settle shared ride fair-share via Wallet Tokens (1 Token = ৳1)
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
    const body = (await req.json().catch(() => null)) as {
      amount?: number;
      note?: string;
    } | null;

    const amount = Math.round(Number(body?.amount || 0));
    if (!Number.isFinite(amount) || amount < 1 || amount > 2000) {
      return NextResponse.json(
        {
          success: false,
          error: "Shared ride fair-share amount must be between 1 and 2000 BDT/tokens.",
        },
        { status: 400 }
      );
    }

    const note =
      typeof body?.note === "string" ? body.note.trim().slice(0, 120) : "";

    const conversation = await db.travelConversation.findUnique({
      where: { id },
    });
    if (!conversation) {
      return NextResponse.json(
        { success: false, error: "Ride conversation not found." },
        { status: 404 }
      );
    }

    if (
      conversation.participant1Id !== user.id &&
      conversation.participant2Id !== user.id
    ) {
      return NextResponse.json(
        { success: false, error: "Forbidden: Not an authorized participant." },
        { status: 403 }
      );
    }

    const partnerId =
      conversation.participant1Id === user.id
        ? conversation.participant2Id
        : conversation.participant1Id;

    const result = await db.$transaction(async (tx) => {
      const [sender, recipient] = await Promise.all([
        tx.user.findUnique({ where: { id: user.id } }),
        tx.user.findUnique({ where: { id: partnerId } }),
      ]);

      if (!sender || !recipient) {
        return { error: "Participant account not found.", status: 404 };
      }

      if (sender.tokenBalance < amount) {
        return {
          error: `Insufficient balance (${sender.tokenBalance} tokens available).`,
          status: 400,
        };
      }

      const [updatedSender, updatedRecipient] = await Promise.all([
        tx.user.update({
          where: { id: sender.id },
          data: { tokenBalance: { decrement: amount } },
        }),
        tx.user.update({
          where: { id: recipient.id },
          data: { tokenBalance: { increment: amount } },
        }),
      ]);

      await Promise.all([
        tx.walletTransaction.create({
          data: {
            userId: sender.id,
            type: "TRANSFER_OUT",
            title: `Ride fare split to ${recipient.fullName}`,
            subtitle: note || "Shared campus commute fair-share",
            amount: -amount,
            balanceAfter: updatedSender.tokenBalance,
            referenceId: conversation.id,
          },
        }),
        tx.walletTransaction.create({
          data: {
            userId: recipient.id,
            type: "TRANSFER_IN",
            title: `Ride fare split from ${sender.fullName}`,
            subtitle: note || "Shared campus commute fair-share",
            amount,
            balanceAfter: updatedRecipient.tokenBalance,
            referenceId: conversation.id,
          },
        }),
        tx.notification.create({
          data: {
            userId: recipient.id,
            category: "rides",
            title: `Received ৳${amount} ride split from ${sender.fullName}`,
            body: note
              ? `${amount} tokens credited for shared ride (${note}).`
              : `${amount} tokens credited to your Campus Wallet.`,
            actionLabel: "View Wallet",
            actionHref: "/wallet",
          },
        }),
      ]);

      const postedMessage = await tx.travelMessage.create({
        data: {
          conversationId: conversation.id,
          senderId: sender.id,
          senderName: sender.fullName,
          text: `💸 ${sender.fullName.split(" ")[0]} settled ৳${amount} (${amount} tokens) shared ride fair-share via UniShare Wallet${note ? ` · ${note}` : ""}`,
          messageType: "STATUS_UPDATE",
        },
      });

      return {
        updatedSender,
        recipientName: recipient.fullName,
        postedMessage,
      };
    });

    if ("error" in result && result.error) {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: result.status || 400 }
      );
    }

    const publicUser = toPublicUser(result.updatedSender!);
    const res = NextResponse.json({
      success: true,
      recipientName: result.recipientName,
      tokenBalance: result.updatedSender!.tokenBalance,
      user: publicUser,
      message: {
        id: result.postedMessage!.id,
        senderId: result.postedMessage!.senderId,
        senderName: result.postedMessage!.senderName,
        text: result.postedMessage!.text,
        messageType: result.postedMessage!.messageType,
        isSelf: true,
        createdAt: result.postedMessage!.createdAt,
      },
    });
    applySessionCookies(res, publicUser, true);
    setVerifiedAccountCookieFromUser(res, publicUser, result.updatedSender!.passwordHash);
    return res;
  } catch (error) {
    console.error("POST /api/rides/conversations/[id]/split-fare error:", error);
    return NextResponse.json(
      { success: false, error: "Unable to process shared ride payment right now." },
      { status: 500 }
    );
  }
}

