import { NextRequest, NextResponse } from "next/server";
import { db } from "@/app/lib/db";
import { getAuthenticatedRideUser } from "@/app/lib/ride-auth";
import { CATEGORIES, ITEM_CONDITIONS } from "@/app/marketplace/marketplace-data";
import { serializeListingRow } from "../route";

const ALLOWED_CATEGORIES = new Set(CATEGORIES.filter((c) => c !== "All items"));
const ALLOWED_CONDITIONS = new Set<string>(ITEM_CONDITIONS);

function isSafeImageUrl(url: string): boolean {
  const clean = url.trim();
  if (!clean || clean.length > 2_900_000) return false;
  if (clean.startsWith("/images/")) return true;
  if (/^https:\/\/[^\s]+$/i.test(clean)) return true;
  if (/^data:image\/(jpeg|jpg|png|webp);base64,[A-Za-z0-9+/=]+$/i.test(clean)) {
    return true;
  }
  return false;
}

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
      title?: string;
      category?: string;
      condition?: string;
      description?: string;
      imageUrl?: string;
      maxRentalDays?: number;
      status?: "active" | "paused" | "draft";
      isRentedOut?: boolean;
      rate?: number;
      deposit?: number;
      area?: string;
    } | null;

    if (!body) {
      return NextResponse.json({ ok: false, error: "Invalid payload." }, { status: 400 });
    }

    const nextData: {
      title?: string;
      category?: string;
      condition?: string;
      description?: string;
      imageUrl?: string;
      maxRentalDays?: number;
      area?: string;
      status: string;
      rate: number;
      deposit: number;
      isRentedOut: boolean;
      available: boolean;
    } = {
      status: existing.status,
      rate: existing.rate,
      deposit: existing.deposit,
      isRentedOut: existing.isRentedOut,
      available: existing.available,
    };

    if ("title" in body) {
      const cleanTitle = (body.title || "").trim();
      if (cleanTitle.length < 3 || cleanTitle.length > 90) {
        return NextResponse.json(
          { ok: false, error: "Item title must be between 3 and 90 characters." },
          { status: 400 }
        );
      }
      nextData.title = cleanTitle;
    }

    if ("category" in body) {
      const cleanCat = (body.category || "").trim();
      if (!ALLOWED_CATEGORIES.has(cleanCat)) {
        return NextResponse.json(
          { ok: false, error: "Please select a valid category." },
          { status: 400 }
        );
      }
      nextData.category = cleanCat;
    }

    if ("condition" in body) {
      const cleanCond = (body.condition || "").trim();
      if (!ALLOWED_CONDITIONS.has(cleanCond)) {
        return NextResponse.json(
          { ok: false, error: "Condition must be Like new, Good, or Fair." },
          { status: 400 }
        );
      }
      nextData.condition = cleanCond;
    }

    if ("area" in body) {
      const cleanArea = (body.area || "").trim();
      if (cleanArea.length < 2 || cleanArea.length > 60) {
        return NextResponse.json(
          { ok: false, error: "Pickup area must be between 2 and 60 characters." },
          { status: 400 }
        );
      }
      nextData.area = cleanArea;
    }

    if ("description" in body) {
      const cleanDesc = (body.description || "").trim().slice(0, 600);
      if (cleanDesc.length < 10) {
        return NextResponse.json(
          { ok: false, error: "Description should be at least 10 characters." },
          { status: 400 }
        );
      }
      nextData.description = cleanDesc;
    }

    if ("imageUrl" in body && typeof body.imageUrl === "string" && body.imageUrl.trim()) {
      if (!isSafeImageUrl(body.imageUrl)) {
        return NextResponse.json(
          { ok: false, error: "Invalid product image URL format." },
          { status: 400 }
        );
      }
      nextData.imageUrl = body.imageUrl.trim();
    }

    if ("maxRentalDays" in body) {
      const days = Math.round(Number(body.maxRentalDays));
      if (!Number.isFinite(days) || days < 1 || days > 30) {
        return NextResponse.json(
          { ok: false, error: "Max rental period must be between 1 and 30 days." },
          { status: 400 }
        );
      }
      nextData.maxRentalDays = days;
    }

    if ("status" in body) {
      if (!body.status || !["active", "paused", "draft"].includes(body.status)) {
        return NextResponse.json(
          { ok: false, error: "Listing status must be active, paused, or draft." },
          { status: 400 }
        );
      }
      nextData.status = body.status;
    }

    if ("rate" in body) {
      const rateVal = Math.round(Number(body.rate));
      if (!Number.isFinite(rateVal) || rateVal < 5 || rateVal > 500) {
        return NextResponse.json(
          { ok: false, error: "Daily rental rate must be between 5 and 500 tokens." },
          { status: 400 }
        );
      }
      nextData.rate = rateVal;
    }

    if ("deposit" in body) {
      const depVal = Math.round(Number(body.deposit));
      if (!Number.isFinite(depVal) || depVal < 0 || depVal > 2000) {
        return NextResponse.json(
          { ok: false, error: "Refundable deposit must be between 0 and 2000 tokens." },
          { status: 400 }
        );
      }
      nextData.deposit = depVal;
    }

    if ("isRentedOut" in body && typeof body.isRentedOut === "boolean") {
      nextData.isRentedOut = body.isRentedOut;
    }

    nextData.available = nextData.status === "active" && !nextData.isRentedOut;

    const updated = await db.marketplaceListing.update({
      where: { id },
      data: nextData,
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

