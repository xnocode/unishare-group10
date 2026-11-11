import { NextRequest, NextResponse } from "next/server";
import { db } from "@/app/lib/db";
import { getAuthenticatedRideUser } from "@/app/lib/ride-auth";
import { VALID_GENDER_PREFERENCES, GenderPreference } from "../route";

interface RouteContext {
  params: Promise<{ id: string }>;
}

// GET /api/rides/[id] — View specific journey details
export async function GET(req: NextRequest, context: RouteContext) {
  try {
    const user = await getAuthenticatedRideUser(req);
    if (!user) {
      return NextResponse.json(
        { success: false, error: "Unauthorized: Please log in." },
        { status: 401 }
      );
    }

    const { id } = await context.params;
    if (!id) {
      return NextResponse.json(
        { success: false, error: "Journey ID is required." },
        { status: 400 }
      );
    }

    const journey = await db.travelJourney.findUnique({
      where: { id },
      include: {
        user: {
          select: {
            id: true,
            fullName: true,
            university: true,
            department: true,
            verified: true,
          },
        },
      },
    });

    if (!journey) {
      return NextResponse.json(
        { success: false, error: "Travel journey not found." },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      journey: {
        id: journey.id,
        userId: journey.userId,
        origin: journey.origin,
        destination: journey.destination,
        originCoords: journey.originLat && journey.originLng ? { lat: journey.originLat, lng: journey.originLng } : null,
        destCoords: journey.destinationLat && journey.destinationLng ? { lat: journey.destinationLat, lng: journey.destinationLng } : null,
        departureTime: journey.departureTime,
        genderPreference: journey.genderPreference,
        status: journey.status,
        notes: journey.notes,
        createdAt: journey.createdAt,
        user: journey.user,
      },
    });
  } catch (error) {
    console.error("GET /api/rides/[id] error:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error fetching journey." },
      { status: 500 }
    );
  }
}

// PATCH / PUT /api/rides/[id] — Update travel journey information
export async function PATCH(req: NextRequest, context: RouteContext) {
  try {
    const user = await getAuthenticatedRideUser(req);
    if (!user) {
      return NextResponse.json(
        { success: false, error: "Unauthorized." },
        { status: 401 }
      );
    }

    const { id } = await context.params;
    const existing = await db.travelJourney.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json(
        { success: false, error: "Travel journey not found." },
        { status: 404 }
      );
    }

    if (existing.userId !== user.id) {
      return NextResponse.json(
        { success: false, error: "Forbidden: You are not authorized to update this journey." },
        { status: 403 }
      );
    }

    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object") {
      return NextResponse.json({ success: false, error: "Invalid JSON." }, { status: 400 });
    }

    const dataToUpdate: any = {};
    if (body.origin && typeof body.origin === "string") dataToUpdate.origin = body.origin.trim();
    if (body.destination && typeof body.destination === "string") dataToUpdate.destination = body.destination.trim();
    if (body.genderPreference && VALID_GENDER_PREFERENCES.includes(body.genderPreference)) {
      dataToUpdate.genderPreference = body.genderPreference;
    }
    if (body.status && ["ACTIVE", "COMPLETED", "CANCELLED"].includes(body.status)) {
      dataToUpdate.status = body.status;
    }
    if (typeof body.notes === "string") dataToUpdate.notes = body.notes.trim();

    const updated = await db.travelJourney.update({
      where: { id },
      data: dataToUpdate,
    });

    return NextResponse.json({
      success: true,
      message: "Journey updated successfully.",
      journey: updated,
    });
  } catch (error) {
    console.error("PATCH /api/rides/[id] error:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error updating journey." },
      { status: 500 }
    );
  }
}

export async function PUT(req: NextRequest, context: RouteContext) {
  return PATCH(req, context);
}

// DELETE /api/rides/[id] — Cancel travel journey
export async function DELETE(req: NextRequest, context: RouteContext) {
  try {
    const user = await getAuthenticatedRideUser(req);
    if (!user) {
      return NextResponse.json(
        { success: false, error: "Unauthorized." },
        { status: 401 }
      );
    }

    const { id } = await context.params;
    const existing = await db.travelJourney.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json(
        { success: false, error: "Journey not found." },
        { status: 404 }
      );
    }

    if (existing.userId !== user.id) {
      return NextResponse.json(
        { success: false, error: "Forbidden: You are not authorized to cancel this journey." },
        { status: 403 }
      );
    }

    const updated = await db.travelJourney.update({
      where: { id },
      data: { status: "CANCELLED" },
    });

    return NextResponse.json({
      success: true,
      message: "Travel journey has been cancelled.",
      journeyId: updated.id,
      status: updated.status,
    });
  } catch (error) {
    console.error("DELETE /api/rides/[id] error:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error cancelling journey." },
      { status: 500 }
    );
  }
}
