import { NextRequest, NextResponse } from "next/server";
import { db } from "@/app/lib/db";
import { getAuthenticatedRideUser } from "@/app/lib/ride-auth";
import { serializeListingRow } from "../route";

interface RouteContext {
  params: Promise<{ id: string }>;
}

// GET /api/marketplace/[id] — Public lookup of a single listing
export async function GET(_req: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    const row = await db.marketplaceListing.findUnique({ where: { id } });
    if (!row) {
      return NextResponse.json({ ok: false, error: "Listing not found." }, { status: 404 });
    }
    const serialized = serializeListingRow(row);
    return NextResponse.json({ ok: true, marketItem: serialized.marketItem });
  } catch (err) {
    console.error("GET /api/marketplace/[id] error:", err);
    return NextResponse.json({ ok: false, error: "Unable to fetch listing." }, { status: 500 });
  }
}

// PATCH /api/marketplace/[id] — Seller-only status / rate / availability update
export async function PATCH(req: NextRequest, context: RouteContext) {
  try {
    const user = await getAuthenticatedRideUser(req);
    if (!user) {
      return NextResponse.json({ ok: false, error: "Unauthorized." }, { status: 401 });
    }

    const { id } = await context.params;
    const existing = await db.marketplaceListing.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ ok: false, error: "Listing not found." }, { status: 404 });
    }
    if (existing.sellerId !== user.id) {
      return NextResponse.json(
        { ok: false, error: "Forbidden: You can only edit your own listings." },
        { status: 403 }
      );
    }

    const body = (await req.json().catch(() => null)) as {
      status?: "active" | "paused" | "draft";
      isRentedOut?: boolean;
      rate?: number;
      deposit?: number;
      area?: string;
    } | null;

    if (!body) {
      return NextResponse.json({ ok: false, error: "Invalid payload." }, { status: 400 });
    }

    const nextStatus =
      body.status && ["active", "paused", "draft"].includes(body.status)
        ? body.status
        : existing.status;

    const nextRate =
      typeof body.rate === "number" && Number.isFinite(body.rate) && body.rate >= 5 && body.rate <= 500
        ? Math.round(body.rate)
        : existing.rate;

    const nextDeposit =
      typeof body.deposit === "number" &&
      Number.isFinite(body.deposit) &&
      body.deposit >= 0 &&
      body.deposit <= 2000
        ? Math.round(body.deposit)
        : existing.deposit;

    const nextIsRentedOut =
      typeof body.isRentedOut === "boolean" ? body.isRentedOut : existing.isRentedOut;

    const updated = await db.marketplaceListing.update({
      where: { id },
      data: {
        status: nextStatus,
        rate: nextRate,
        deposit: nextDeposit,
        isRentedOut: nextIsRentedOut,
        available: nextStatus === "active" && !nextIsRentedOut,
        ...(body.area ? { area: body.area.trim() } : {}),
      },
    });

    const serialized = serializeListingRow(updated);
    return NextResponse.json({
      ok: true,
      marketItem: serialized.marketItem,
      myProduct: serialized.myProduct,
    });
  } catch (err) {
    console.error("PATCH /api/marketplace/[id] error:", err);
    return NextResponse.json({ ok: false, error: "Unable to update listing." }, { status: 500 });
  }
}

// DELETE /api/marketplace/[id] — Seller-only deletion
export async function DELETE(req: NextRequest, context: RouteContext) {
  try {
    const user = await getAuthenticatedRideUser(req);
    if (!user) {
      return NextResponse.json({ ok: false, error: "Unauthorized." }, { status: 401 });
    }

    const { id } = await context.params;
    const existing = await db.marketplaceListing.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ ok: false, error: "Listing not found." }, { status: 404 });
    }
    if (existing.sellerId !== user.id) {
      return NextResponse.json(
        { ok: false, error: "Forbidden: You can only delete your own listings." },
        { status: 403 }
      );
    }

    await db.marketplaceListing.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("DELETE /api/marketplace/[id] error:", err);
    return NextResponse.json({ ok: false, error: "Unable to delete listing." }, { status: 500 });
  }
}

