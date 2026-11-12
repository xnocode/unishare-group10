import { NextRequest, NextResponse } from "next/server";
import { db } from "@/app/lib/db";
import { getAuthenticatedRideUser } from "@/app/lib/ride-auth";
import { serializeListingRow } from "../route";

// GET /api/marketplace/favorites — Fetch authenticated student's saved DB favorites
export async function GET(req: NextRequest) {
  try {
    const user = await getAuthenticatedRideUser(req);
    if (!user) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }

    const favRows = await db.marketplaceFavorite.findMany({
      where: { userId: user.id },
      include: { listing: true },
      orderBy: { createdAt: "desc" },
    });

    const items = favRows
      .filter((r) => r.listing && r.listing.status !== "draft")
      .map((r) => serializeListingRow(r.listing).marketItem);

    return NextResponse.json({
      ok: true,
      listingIds: items.map((i) => i.id),
      items,
    });
  } catch (err) {
    console.error("GET /api/marketplace/favorites error:", err);
    return NextResponse.json(
      { ok: false, error: "Unable to load favorites right now." },
      { status: 500 }
    );
  }
}

// POST /api/marketplace/favorites — Toggle a marketplace listing in user's DB favorites
export async function POST(req: NextRequest) {
  try {
    const user = await getAuthenticatedRideUser(req);
    if (!user) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }

    const body = (await req.json().catch(() => null)) as { listingId?: string } | null;
    const listingId = (body?.listingId || "").trim();
    if (!listingId) {
      return NextResponse.json({ ok: false, error: "listingId is required." }, { status: 400 });
    }

    const listing = await db.marketplaceListing.findUnique({ where: { id: listingId } });
    if (!listing) {
      // Allow showcase preset IDs ("1"-"6") gracefully without triggering FK errors
      return NextResponse.json({
        ok: true,
        listingId,
        saved: true,
        presetOnly: true,
      });
    }

    const existing = await db.marketplaceFavorite.findUnique({
      where: { userId_listingId: { userId: user.id, listingId } },
    });

    if (existing) {
      await db.marketplaceFavorite.delete({ where: { id: existing.id } });
      return NextResponse.json({ ok: true, listingId, saved: false });
    }

    await db.marketplaceFavorite.create({
      data: { userId: user.id, listingId },
    });

    return NextResponse.json({ ok: true, listingId, saved: true });
  } catch (err) {
    console.error("POST /api/marketplace/favorites error:", err);
    return NextResponse.json(
      { ok: false, error: "Unable to update favorite status." },
      { status: 500 }
    );
  }
}

