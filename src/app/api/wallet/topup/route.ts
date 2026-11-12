import { NextRequest, NextResponse } from "next/server";
import { db } from "@/app/lib/db";
import { getAuthenticatedRideUser } from "@/app/lib/ride-auth";
import {
  applySessionCookies,
  setVerifiedAccountCookieFromUser,
  toPublicUser,
} from "@/app/lib/auth";

const PACKAGES: Record<string, { tokens: number; bdt: number; bonus: number }> = {
  starter: { tokens: 100, bdt: 100, bonus: 0 },
  campus: { tokens: 250, bdt: 250, bonus: 15 },
  scholar: { tokens: 500, bdt: 500, bonus: 40 },
  semester: { tokens: 1000, bdt: 1000, bonus: 100 },
};

// POST /api/wallet/topup — Credit campus tokens and record a persistent WalletTransaction
export async function POST(req: NextRequest) {
  try {
    const user = await getAuthenticatedRideUser(req);
    if (!user) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }

    const body = (await req.json().catch(() => null)) as {
      packageId?: string;
      method?: string;
      senderPhone?: string;
      trxRef?: string;
    } | null;

    const pkg = body?.packageId ? PACKAGES[body.packageId] : undefined;
    if (!pkg) {
      return NextResponse.json(
        { ok: false, error: "Please choose a valid token package." },
        { status: 400 }
      );
    }

    const method = (body?.method || "").trim();
    if (!["bKash", "Nagad", "Rocket"].includes(method)) {
      return NextResponse.json(
        { ok: false, error: "Select bKash, Nagad, or Rocket as your payment method." },
        { status: 400 }
      );
    }

    const phone = (body?.senderPhone || "").replace(/[\s-]/g, "");
    if (!/^01[3-9]\d{8}$/.test(phone)) {
      return NextResponse.json(
        { ok: false, error: "Enter a valid 11-digit Bangladesh mobile number (e.g., 017XXXXXXXX)." },
        { status: 400 }
      );
    }

    const trxRef = (body?.trxRef || "").trim();
    if (trxRef.length < 4 || trxRef.length > 40) {
      return NextResponse.json(
        { ok: false, error: "Enter a valid transaction reference ID (4–40 characters)." },
        { status: 400 }
      );
    }

    const totalCredited = pkg.tokens + pkg.bonus;

    const updatedUser = await db.$transaction(async (tx) => {
      const nextUser = await tx.user.update({
        where: { id: user.id },
        data: { tokenBalance: { increment: totalCredited } },
      });

      await tx.walletTransaction.create({
        data: {
          userId: user.id,
          type: "TOPUP",
          title: `Top-up · +${totalCredited} tokens (${method})`,
          subtitle: `Ref ${trxRef} · ৳${pkg.bdt} (${pkg.tokens}${pkg.bonus ? ` + ${pkg.bonus} bonus` : ""})`,
          amount: totalCredited,
          balanceAfter: nextUser.tokenBalance,
          referenceId: trxRef,
        },
      });

      await tx.notification.create({
        data: {
          userId: user.id,
          category: "wallet",
          title: `+${totalCredited} Campus Tokens added`,
          body: `${method} reference ${trxRef} confirmed. New wallet balance: ${nextUser.tokenBalance} tokens.`,
          actionLabel: "View Wallet",
          actionHref: "/wallet",
        },
      });

      return nextUser;
    });

    const publicUser = toPublicUser(updatedUser);
    const res = NextResponse.json(
      {
        ok: true,
        creditedTokens: totalCredited,
        tokenBalance: updatedUser.tokenBalance,
        user: publicUser,
      },
      { status: 201 }
    );
    applySessionCookies(res, publicUser, true);
    setVerifiedAccountCookieFromUser(res, publicUser, updatedUser.passwordHash);
    return res;
  } catch (err) {
    console.error("POST /api/wallet/topup error:", err);
    return NextResponse.json(
      { ok: false, error: "Unable to process token top-up right now." },
      { status: 500 }
    );
  }
}

