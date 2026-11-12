import { NextRequest, NextResponse } from "next/server";
import { db } from "@/app/lib/db";
import { getAuthenticatedRideUser } from "@/app/lib/ride-auth";

// GET /api/wallet — Load live DB token balance, active held deposits, and ledger transactions
export async function GET(req: NextRequest) {
  try {
    const user = await getAuthenticatedRideUser(req);
    if (!user) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }

    const [freshUser, transactions, activeBorrows] = await Promise.all([
      db.user.findUnique({
        where: { id: user.id },
        select: { tokenBalance: true },
      }),
      db.walletTransaction.findMany({
        where: { userId: user.id },
        orderBy: { createdAt: "desc" },
        take: 40,
      }),
      db.marketplaceRental.findMany({
        where: {
          borrowerId: user.id,
          status: { in: ["PENDING", "ACTIVE"] },
        },
        select: { id: true, listingTitle: true, depositAmount: true, rentalFee: true, status: true },
        orderBy: { createdAt: "desc" },
      }),
    ]);

    const heldDeposit = activeBorrows.reduce((sum, r) => sum + r.depositAmount, 0);

    return NextResponse.json({
      ok: true,
      tokenBalance: freshUser?.tokenBalance ?? user.tokenBalance,
      heldDeposit,
      activeBorrows,
      transactions,
    });
  } catch (err) {
    console.error("GET /api/wallet error:", err);
    return NextResponse.json(
      { ok: false, error: "Unable to load Campus Wallet right now." },
      { status: 500 }
    );
  }
}

