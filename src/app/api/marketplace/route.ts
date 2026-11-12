import { NextRequest, NextResponse } from "next/server";
import { db } from "@/app/lib/db";
import { getAuthenticatedRideUser } from "@/app/lib/ride-auth";
import {
  CATEGORIES,
  getDefaultImageForCategory,
  ITEM_CONDITIONS,
} from "@/app/marketplace/marketplace-data";

const VALID_STATUSES = new Set(["active", "paused", "draft"]);
const ALLOWED_CATEGORIES = new Set(CATEGORIES.filter((c) => c !== "All items"));
const ALLOWED_CONDITIONS = new Set<string>(ITEM_CONDITIONS);

function deriveInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "US";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
}

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

export function serializeListingRow(row: {
  id: string;
  sellerId: string;
  sellerEmail: string;
  sellerName: string;
  sellerInitials: string;
  university: string | null;
  title: string;
  category: string;
  condition: string;
  rate: number;
  deposit: number;
  area: string;
  maxRentalDays: number;
  description: string;
  imageUrl: string;
  status: string;
  isRentedOut: boolean;
  available: boolean;
  createdAt: Date;
}) {
  return {
    marketItem: {
      id: row.id,
      name: row.title,
      category: row.category,
      price: row.rate,
      deposit: row.deposit,
      area: row.area,
      owner: row.sellerName,
      ownerEmail: row.sellerEmail,
      university: row.university || "University of Dhaka",
      status: (VALID_STATUSES.has(row.status) ? row.status : "active") as
        | "active"
        | "paused"
        | "draft",
      initials: row.sellerInitials,
      image: row.imageUrl,
      available: row.status === "active" && !row.isRentedOut && row.available,
      condition: row.condition,
      maxRentalDays: row.maxRentalDays,
      description: row.description,
    },
    myProduct: {
      id: row.id,
      name: row.title,
      category: row.category,
      condition: row.condition,
      state: (VALID_STATUSES.has(row.status) ? row.status : "active") as
        | "active"
        | "paused"
        | "draft",
      isRentedOut: row.isRentedOut,
      rate: row.rate,
      deposit: row.deposit,
      area: row.area,
      maxRentalDays: row.maxRentalDays,
      description: row.description,
      image: row.imageUrl,
      note:
        row.status === "draft"
          ? "Saved as draft · Finish details to publish"
          : row.status === "paused"
          ? "Paused by you"
          : `Published to ${row.university || "Campus"} shelf · ${row.area}`,
      availText:
        row.status === "draft"
          ? "Not published"
          : row.status === "paused"
          ? "Not accepting bookings"
          : row.isRentedOut
          ? "Currently rented"
          : "Available today",
      owner: `${row.sellerName} · You`,
    },
  };
}

// GET /api/marketplace — Fetch shared campus listings (or authenticated user's own listings with ?mine=true)
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const mine = searchParams.get("mine") === "true";
    const includeOwn = searchParams.get("includeOwn") === "true";
    const campusOnly = searchParams.get("campusOnly") === "true";
    const viewer = mine || includeOwn || campusOnly ? await getAuthenticatedRideUser(req) : null;

    if (mine) {
      if (!viewer) {
        return NextResponse.json(
          { ok: false, error: "Unauthorized: Please log in to view your listings." },
          { status: 401 }
        );
      }

      const rows = await db.marketplaceListing.findMany({
        where: { sellerId: viewer.id },
        orderBy: { createdAt: "desc" },
        take: 100,
      });

      const mapped = rows.map(serializeListingRow);
      return NextResponse.json({
        ok: true,
        items: mapped.map((m) => m.marketItem),
        myProducts: mapped.map((m) => m.myProduct),
      });
    }

    const whereClause =
      viewer && includeOwn
        ? {
            AND: [
              ...(campusOnly && viewer.university ? [{ university: viewer.university }] : []),
              {
                OR: [{ status: "active" }, { sellerId: viewer.id }],
              },
            ],
          }
        : {
            status: "active",
            ...(campusOnly && viewer?.university ? { university: viewer.university } : {}),
          };

    const rows = await db.marketplaceListing.findMany({
      where: whereClause,
      orderBy: { createdAt: "desc" },
      take: 150,
    });

    const mapped = rows.map(serializeListingRow);
    return NextResponse.json({
      ok: true,
      items: mapped.map((m) => m.marketItem),
      totalCount: mapped.length,
    });
  } catch (err) {
    console.error("GET /api/marketplace error:", err);
    return NextResponse.json(
      { ok: false, error: "Unable to load marketplace listings right now." },
      { status: 500 }
    );
  }
}

// POST /api/marketplace — Publish or save a new student listing in database
export async function POST(req: NextRequest) {
  try {
    const user = await getAuthenticatedRideUser(req);
    if (!user) {
      return NextResponse.json(
        { ok: false, error: "Unauthorized: Please log in to list an item." },
        { status: 401 }
      );
    }

    const body = (await req.json().catch(() => null)) as {
      title?: string;
      category?: string;
      condition?: string;
      rate?: number;
      deposit?: number;
      area?: string;
      maxRentalDays?: number;
      description?: string;
      imageUrl?: string;
      status?: string;
    } | null;

    if (!body) {
      return NextResponse.json(
        { ok: false, error: "Invalid request payload." },
        { status: 400 }
      );
    }

    const title = (body.title || "").trim();
    const category = (body.category || "Calculators").trim();
    const condition = (body.condition || "Good").trim();
    const area = (body.area || "TSC").trim();
    const rate = Math.round(Number(body.rate));
    const deposit = Math.round(Number(body.deposit));
    const maxRentalDays = Math.min(30, Math.max(1, Math.round(Number(body.maxRentalDays || 7))));
    const status = VALID_STATUSES.has(String(body.status || "active"))
      ? String(body.status || "active")
      : "active";

    if (title.length < 3 || title.length > 90) {
      return NextResponse.json(
        { ok: false, error: "Item title must be between 3 and 90 characters." },
        { status: 400 }
      );
    }

    if (!ALLOWED_CATEGORIES.has(category)) {
      return NextResponse.json(
        { ok: false, error: "Please select a valid marketplace category." },
        { status: 400 }
      );
    }

    if (!ALLOWED_CONDITIONS.has(condition)) {
      return NextResponse.json(
        { ok: false, error: "Condition must be Like new, Good, or Fair." },
        { status: 400 }
      );
    }

    if (area.length < 2 || area.length > 60) {
      return NextResponse.json(
        { ok: false, error: "Campus pickup area must be between 2 and 60 characters." },
        { status: 400 }
      );
    }

    if (!Number.isFinite(rate) || rate < 5 || rate > 500) {
      return NextResponse.json(
        { ok: false, error: "Daily rental rate must be between 5 and 500 tokens." },
        { status: 400 }
      );
    }

    if (!Number.isFinite(deposit) || deposit < 0 || deposit > 2000) {
      return NextResponse.json(
        { ok: false, error: "Refundable deposit must be between 0 and 2000 tokens." },
        { status: 400 }
      );
    }

    const rawImage = (body.imageUrl || "").trim() || getDefaultImageForCategory(category);
    if (!isSafeImageUrl(rawImage)) {
      return NextResponse.json(
        { ok: false, error: "Invalid or unsupported product image format." },
        { status: 400 }
      );
    }

    const description =
      (body.description || "").trim().slice(0, 600) ||
      `${condition} condition ${title}. Pickup at ${area}.`;

    const created = await db.marketplaceListing.create({
      data: {
        sellerId: user.id,
        sellerEmail: user.email,
        sellerName: user.fullName,
        sellerInitials: deriveInitials(user.fullName),
        university: user.university || "University of Dhaka",
        title,
        category,
        condition,
        rate,
        deposit,
        area,
        maxRentalDays,
        description,
        imageUrl: rawImage,
        status,
        isRentedOut: false,
        available: status === "active",
      },
    });

    const serialized = serializeListingRow(created);
    return NextResponse.json(
      {
        ok: true,
        marketItem: serialized.marketItem,
        myProduct: serialized.myProduct,
      },
      { status: 201 }
    );
  } catch (err) {
    console.error("POST /api/marketplace error:", err);
    return NextResponse.json(
      { ok: false, error: "Unable to save listing to database." },
      { status: 500 }
    );
  }
}

