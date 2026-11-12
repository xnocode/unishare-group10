import { NextRequest, NextResponse } from "next/server";
import { db } from "@/app/lib/db";
import { getAuthenticatedRideUser } from "@/app/lib/ride-auth";

// GET /api/marketplace/rentals — Fetch authenticated user's borrowed & lent rental requests
export async function GET(req: NextRequest) {
  try {
    const user = await getAuthenticatedRideUser(req);
    if (!user) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }

    const [borrowed, lent] = await Promise.all([
      db.marketplaceRental.findMany({
        where: { borrowerId: user.id },
        orderBy: { createdAt: "desc" },
        take: 50,
      }),
      db.marketplaceRental.findMany({
        where: { lenderId: user.id },
        orderBy: { createdAt: "desc" },
        take: 50,
      }),
    ]);

    const heldDepositTotal = borrowed
      .filter((r) => r.status === "PENDING" || r.status === "ACTIVE")
      .reduce((acc, r) => acc + r.depositAmount, 0);

    const totalEarned = lent
      .filter((r) => r.status === "RETURNED")
      .reduce((acc, r) => acc + r.rentalFee, 0);

    return NextResponse.json({
      ok: true,
      borrowed,
      lent,
      heldDepositTotal,
      totalEarned,
    });
  } catch (err) {
    console.error("GET /api/marketplace/rentals error:", err);
    return NextResponse.json(
      { ok: false, error: "Unable to load rental records right now." },
      { status: 500 }
    );
  }
}

// POST /api/marketplace/rentals — Request to borrow an item & hold token escrow atomically
export async function POST(req: NextRequest) {
  try {
    const user = await getAuthenticatedRideUser(req);
    if (!user) {
      return NextResponse.json(
        { ok: false, error: "Please log in to request a rental." },
        { status: 401 }
      );
    }

    const body = (await req.json().catch(() => null)) as {
      listingId?: string;
      startDate?: string;
      endDate?: string;
      days?: number;
      note?: string;
    } | null;

    if (!body?.listingId) {
      return NextResponse.json(
        { ok: false, error: "Listing ID is required." },
        { status: 400 }
      );
    }

    const listing = await db.marketplaceListing.findUnique({
      where: { id: body.listingId },
    });
    if (!listing) {
      return NextResponse.json(
        { ok: false, error: "This item listing is no longer available in the database." },
        { status: 404 }
      );
    }

    if (listing.sellerId === user.id) {
      return NextResponse.json(
        { ok: false, error: "You cannot borrow your own listing." },
        { status: 400 }
      );
    }

    if (listing.status !== "active" || listing.isRentedOut || !listing.available) {
      return NextResponse.json(
        { ok: false, error: "This item is currently unavailable for booking." },
        { status: 409 }
      );
    }

    const startDate = (body.startDate || "").trim() || new Date().toISOString().slice(0, 10);
    const endDate = (body.endDate || "").trim() || startDate;
    if (endDate < startDate) {
      return NextResponse.json(
        { ok: false, error: "Return date cannot be earlier than pickup date." },
        { status: 400 }
      );
    }

    const days = Math.round(Number(body.days || 1));
    if (!Number.isFinite(days) || days < 1 || days > listing.maxRentalDays) {
      return NextResponse.json(
        {
          ok: false,
          error: `Rental duration must be between 1 and ${listing.maxRentalDays} days for this item.`,
        },
        { status: 400 }
      );
    }

    const rentalFee = days * listing.rate;
    const depositAmount = listing.deposit;
    const totalLocked = rentalFee + depositAmount;
    const note = typeof body.note === "string" ? body.note.trim().slice(0, 280) : "";

    const result = await db.$transaction(async (tx) => {
      const freshBorrower = await tx.user.findUnique({
        where: { id: user.id },
        select: { id: true, tokenBalance: true },
      });
      if (!freshBorrower) {
        throw new Error("BORROWER_MISSING");
      }
      if (freshBorrower.tokenBalance < totalLocked) {
        return {
          insufficient: true as const,
          needed: totalLocked - freshBorrower.tokenBalance,
          balance: freshBorrower.tokenBalance,
        };
      }

      const existingActive = await tx.marketplaceRental.findFirst({
        where: {
          listingId: listing.id,
          borrowerId: user.id,
          status: { in: ["PENDING", "ACTIVE"] },
        },
      });
      if (existingActive) {
        return { duplicate: true as const };
      }

      const updatedUser = await tx.user.update({
        where: { id: user.id },
        data: { tokenBalance: { decrement: totalLocked } },
        select: { tokenBalance: true },
      });

      const rental = await tx.marketplaceRental.create({
        data: {
          listingId: listing.id,
          listingTitle: listing.title,
          listingImage: listing.imageUrl,
          borrowerId: user.id,
          borrowerName: user.fullName,
          borrowerEmail: user.email,
          lenderId: listing.sellerId,
          lenderName: listing.sellerName,
          lenderEmail: listing.sellerEmail,
          startDate,
          endDate,
          days,
          ratePerDay: listing.rate,
          rentalFee,
          depositAmount,
          totalLocked,
          note: note || null,
          status: "PENDING",
        },
      });

      await tx.walletTransaction.create({
        data: {
          userId: user.id,
          type: "RENTAL_HOLD",
          title: `Rental hold · ${listing.title}`,
          subtitle: `${days}d (${rentalFee} fee + ${depositAmount} refundable deposit)`,
          amount: -totalLocked,
          balanceAfter: updatedUser.tokenBalance,
          referenceId: rental.id,
          status: "COMPLETED",
        },
      });

      await tx.notification.create({
        data: {
          userId: listing.sellerId,
          category: "marketplace",
          title: `New borrow request for ${listing.title}`,
          body: `${user.fullName} requested ${days} day(s) (${startDate} to ${endDate}) · ${rentalFee} tokens rental + ${depositAmount} deposit.`,
          actionLabel: "Review in My Products",
          actionHref: "/my-products",
        },
      });

      return {
        insufficient: false as const,
        duplicate: false as const,
        rental,
        newBalance: updatedUser.tokenBalance,
      };
    });

    if ("insufficient" in result && result.insufficient) {
      return NextResponse.json(
        {
          ok: false,
          error: `You need ${result.needed} more tokens (balance: ${result.balance}, total required: ${totalLocked}).`,
          needed: result.needed,
        },
        { status: 400 }
      );
    }

    if ("duplicate" in result && result.duplicate) {
      return NextResponse.json(
        {
          ok: false,
          error: "You already have an open borrow request or active rental for this item.",
        },
        { status: 409 }
      );
    }

    return NextResponse.json(
      {
        ok: true,
        rental: result.rental,
        newBalance: result.newBalance,
      },
      { status: 201 }
    );
  } catch (err) {
    console.error("POST /api/marketplace/rentals error:", err);
    return NextResponse.json(
      { ok: false, error: "Unable to submit borrow request right now." },
      { status: 500 }
    );
  }
}

