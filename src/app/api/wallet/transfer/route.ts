import { NextRequest, NextResponse } from "next/server";
import { db } from "@/app/lib/db";
import { normalizeEmail, isValidEmail, applySessionCookies, setVerifiedAccountCookieFromUser, toPublicUser } from "@/app/lib/auth";
import { getAuthenticatedRideUser } from "@/app/lib/ride-auth";

// POST /api/wallet/transfer — Atomic student-to-student token transfer
export async function POST(req: NextRequest) {
  try {
    const user = await getAuthenticatedRideUser(req);
    if (!user) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }

    const body = (await req.json().catch(() => null)) as {
      recipientEmail?: string;
      amount?: number;
      note?: string;
    } | null;

    const recipientEmail = normalizeEmail(body?.recipientEmail || "");
    if (!isValidEmail(recipientEmail)) {
      return NextResponse.json(
        { ok: false, error: "Enter a valid recipient student email." },
        { status: 400 }
      );
    }

    if (recipientEmail === normalizeEmail(user.email)) {
      return NextResponse.json(
        { ok: false, error: "You cannot transfer tokens to yourself." },
        { status: 400 }
      );
    }

    const amount = Math.round(Number(body?.amount || 0));
    if (!Number.isFinite(amount) || amount < 1 || amount > 1000) {
      return NextResponse.json(
        { ok: false, error: "Transfer amount must be between 1 and 1000 tokens." },
        { status: 400 }
      );
    }

    const note = typeof body?.note === "string" ? body.note.trim().slice(0, 120) : "";

    const result = await db.$transaction(async (tx) => {
      const [sender, recipient] = await Promise.all([
        tx.user.findUnique({ where: { id: user.id } }),
        tx.user.findUnique({ where: { email: recipientEmail } }),
      ]);

      if (!sender) return { error: "Sender account not found.", status: 404 };
      if (!recipient) {
        return {
          error: `No registered UniShare student found with email ${recipientEmail}.`,
          status: 404,
        };
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
            title: `Sent to ${recipient.fullName}`,
            subtitle: note || recipient.email,
            amount: -amount,
            balanceAfter: updatedSender.tokenBalance,
            referenceId: recipient.id,
          },
        }),
        tx.walletTransaction.create({
          data: {
            userId: recipient.id,
            type: "TRANSFER_IN",
            title: `Received from ${sender.fullName}`,
            subtitle: note || sender.email,
            amount,
            balanceAfter: updatedRecipient.tokenBalance,
            referenceId: sender.id,
          },
        }),
        tx.notification.create({
          data: {
            userId: recipient.id,
            category: "wallet",
            title: `+${amount} tokens received from ${sender.fullName}`,
            body: note ? `Note: "${note}"` : `Added directly to your Campus Wallet.`,
            actionLabel: "View Wallet",
            actionHref: "/wallet",
          },
        }),
      ]);

      return { updatedSender, recipientName: recipient.fullName };
    });

    if ("error" in result && result.error) {
      return NextResponse.json(
        { ok: false, error: result.error },
        { status: result.status || 400 }
      );
    }

    const publicUser = toPublicUser(result.updatedSender!);
    const res = NextResponse.json({
      ok: true,
      recipientName: result.recipientName,
      tokenBalance: result.updatedSender!.tokenBalance,
      user: publicUser,
    });
    applySessionCookies(res, publicUser, true);
    setVerifiedAccountCookieFromUser(res, publicUser, result.updatedSender!.passwordHash);
    return res;
  } catch (err) {
    console.error("POST /api/wallet/transfer error:", err);
    return NextResponse.json(
      { ok: false, error: "Unable to complete token transfer right now." },
      { status: 500 }
    );
  }
}

