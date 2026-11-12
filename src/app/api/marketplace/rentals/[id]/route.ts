import { NextRequest, NextResponse } from "next/server";
import { db } from "@/app/lib/db";
import { getAuthenticatedRideUser } from "@/app/lib/ride-auth";

interface RouteContext {
  params: Promise<{ id: string }>;
}

// PATCH /api/marketplace/rentals/[id] — Lender approves/declines/marks returned, or borrower cancels pending request
export async function PATCH(req: NextRequest, context: RouteContext) {
  try {
    const user = await getAuthenticatedRideUser(req);
    if (!user) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await context.params;
    const body = (await req.json().catch(() => null)) as {
      action?: "approve" | "decline" | "return" | "cancel";
    } | null;
    const action = body?.action;
    if (!action || !["approve", "decline", "return", "cancel"].includes(action)) {
      return NextResponse.json({ ok: false, error: "Invalid rental action." }, { status: 400 });
    }

    const rental = await db.marketplaceRental.findUnique({ where: { id } });
    if (!rental) {
      return NextResponse.json({ ok: false, error: "Rental record not found." }, { status: 404 });
    }

    const isLender = rental.lenderId === user.id;
    const isBorrower = rental.borrowerId === user.id;
    if (!isLender && !isBorrower) {
      return NextResponse.json({ ok: false, error: "Forbidden." }, { status: 403 });
    }

    if ((action === "approve" || action === "decline" || action === "return") && !isLender) {
      return NextResponse.json(
        { ok: false, error: "Only the item owner can perform this action." },
        { status: 403 }
      );
    }

    if (action === "cancel" && !isBorrower) {
      return NextResponse.json(
        { ok: false, error: "Only the borrower can cancel this request." },
        { status: 403 }
      );
    }

    if (action === "approve") {
      if (rental.status !== "PENDING") {
        return NextResponse.json({ ok: false, error: "Request is no longer pending." }, { status: 409 });
      }
      const updated = await db.$transaction(async (tx) => {
        const nextRental = await tx.marketplaceRental.update({
          where: { id },
          data: { status: "ACTIVE" },
        });
        await tx.marketplaceListing.update({
          where: { id: rental.listingId },
          data: { isRentedOut: true, available: false },
        });
        await tx.notification.create({
          data: {
            userId: rental.borrowerId,
            category: "marketplace",
            title: `Rental approved · ${rental.listingTitle}`,
            body: `${rental.lenderName} approved your handover for ${rental.startDate} to ${rental.endDate}.`,
            actionLabel: "View product",
            actionHref: `/product-details/${rental.listingId}`,
          },
        });
        return nextRental;
      });
      return NextResponse.json({ ok: true, rental: updated });
    }

    if (action === "decline" || action === "cancel") {
      if (rental.status !== "PENDING") {
        return NextResponse.json(
          { ok: false, error: "Only pending requests can be declined or cancelled." },
          { status: 409 }
        );
      }
      const nextStatus = action === "decline" ? "DECLINED" : "CANCELLED";
      const updated = await db.$transaction(async (tx) => {
        const nextRental = await tx.marketplaceRental.update({
          where: { id },
          data: { status: nextStatus },
        });
        const borrowerUpdated = await tx.user.update({
          where: { id: rental.borrowerId },
          data: { tokenBalance: { increment: rental.totalLocked } },
          select: { tokenBalance: true },
        });
        await tx.walletTransaction.create({
          data: {
            userId: rental.borrowerId,
            type: "RENTAL_REFUND",
            title: `${action === "decline" ? "Request declined" : "Request cancelled"} · ${rental.listingTitle}`,
            subtitle: `Full escrow of ${rental.totalLocked} tokens returned`,
            amount: rental.totalLocked,
            balanceAfter: borrowerUpdated.tokenBalance,
            referenceId: rental.id,
          },
        });
        await tx.notification.create({
          data: {
            userId: action === "decline" ? rental.borrowerId : rental.lenderId,
            category: "wallet",
            title: `${action === "decline" ? "Rental request declined" : "Borrow request cancelled"}`,
            body:
              action === "decline"
                ? `${rental.lenderName} declined ${rental.listingTitle}; ${rental.totalLocked} tokens returned to your wallet.`
                : `${rental.borrowerName} cancelled their request for ${rental.listingTitle}.`,
            actionLabel: "Open Wallet",
            actionHref: "/wallet",
          },
        });
        return nextRental;
      });
      return NextResponse.json({ ok: true, rental: updated });
    }

    // action === "return"
    if (rental.status !== "ACTIVE") {
      return NextResponse.json(
        { ok: false, error: "Only an active rental can be marked as returned." },
        { status: 409 }
      );
    }

    const updated = await db.$transaction(async (tx) => {
      const nextRental = await tx.marketplaceRental.update({
        where: { id },
        data: { status: "RETURNED", returnedAt: new Date() },
      });
      await tx.marketplaceListing.update({
        where: { id: rental.listingId },
        data: { isRentedOut: false, available: true },
      });

      if (rental.depositAmount > 0) {
        const borrowerUpdated = await tx.user.update({
          where: { id: rental.borrowerId },
          data: { tokenBalance: { increment: rental.depositAmount } },
          select: { tokenBalance: true },
        });
        await tx.walletTransaction.create({
          data: {
            userId: rental.borrowerId,
            type: "RENTAL_REFUND",
            title: `Deposit released · ${rental.listingTitle}`,
            subtitle: `Returned in good condition to ${rental.lenderName}`,
            amount: rental.depositAmount,
            balanceAfter: borrowerUpdated.tokenBalance,
            referenceId: rental.id,
          },
        });
      }

      const lenderUpdated = await tx.user.update({
        where: { id: rental.lenderId },
        data: { tokenBalance: { increment: rental.rentalFee } },
        select: { tokenBalance: true },
      });
      await tx.walletTransaction.create({
        data: {
          userId: rental.lenderId,
          type: "RENTAL_EARN",
          title: `Rental earned · ${rental.listingTitle}`,
          subtitle: `${rental.days}d rental from ${rental.borrowerName}`,
          amount: rental.rentalFee,
          balanceAfter: lenderUpdated.tokenBalance,
          referenceId: rental.id,
        },
      });

      await tx.notification.create({
        data: {
          userId: rental.borrowerId,
          category: "wallet",
          title: `Deposit released · +${rental.depositAmount} tokens`,
          body: `${rental.lenderName} confirmed return of ${rental.listingTitle}.`,
          actionLabel: "View Wallet",
          actionHref: "/wallet",
        },
      });

      return nextRental;
    });

    return NextResponse.json({ ok: true, rental: updated });
  } catch (err) {
    console.error("PATCH /api/marketplace/rentals/[id] error:", err);
    return NextResponse.json(
      { ok: false, error: "Unable to process rental update right now." },
      { status: 500 }
    );
  }
}

