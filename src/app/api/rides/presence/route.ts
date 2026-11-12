import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedRideUser } from "@/app/lib/ride-auth";
import { recordRidesPresence, getActiveRidersPresence } from "@/app/lib/rides-presence";

export async function POST(req: NextRequest) {
  try {
    const user = await getAuthenticatedRideUser(req);
    if (!user) {
      return NextResponse.json(
        { success: false, error: "Unauthorized: Please log in to update ride presence." },
        { status: 401 }
      );
    }

    const body = await req.json().catch(() => ({}));

    const lat = typeof body.lat === "number" && Number.isFinite(body.lat) ? body.lat : null;
    const lng = typeof body.lng === "number" && Number.isFinite(body.lng) ? body.lng : null;
    const pickupLocation = (body.pickupLocation || "").trim();
    const destinationLocation = (body.destinationLocation || "").trim();
    const destinationLat =
      typeof body.destinationLat === "number" && Number.isFinite(body.destinationLat)
        ? body.destinationLat
        : null;
    const destinationLng =
      typeof body.destinationLng === "number" && Number.isFinite(body.destinationLng)
        ? body.destinationLng
        : null;

    if (lat === null || lng === null) {
      return NextResponse.json({ success: false, error: "Latitude and longitude required" }, { status: 400 });
    }

    const initials = user.fullName
      .split(" ")
      .filter(Boolean)
      .map((n: string) => n[0])
      .join("")
      .slice(0, 2)
      .toUpperCase() || "US";

    recordRidesPresence({
      userId: user.id,
      fullName: user.fullName,
      avatarInitials: initials,
      university: user.university || "University of Dhaka",
      department: user.department || "Campus Student",
      verified: user.verified,
      lat,
      lng,
      pickupLocation: pickupLocation || "Nearby Pickup",
      destinationLocation: destinationLocation || undefined,
      destinationLat,
      destinationLng,
      gender: user.gender || null,
      genderPreference: body.genderPreference || "no_preference",
      isSearching: true,
    });

    return NextResponse.json({ success: true, message: "Active searcher location recorded" });
  } catch (error) {
    console.error("POST /api/rides/presence error:", error);
    return NextResponse.json({ success: false, error: "Server error" }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  try {
    const user = await getAuthenticatedRideUser(req);
    if (!user) {
      return NextResponse.json(
        { success: false, error: "Unauthorized: Please log in to view campus presence." },
        { status: 401 }
      );
    }

    const active = getActiveRidersPresence(user.id).map((entry) => ({
      userId: entry.userId,
      fullName: entry.fullName,
      avatarInitials: entry.avatarInitials,
      university: entry.university,
      department: entry.department,
      verified: entry.verified,
      lat: entry.lat,
      lng: entry.lng,
      pickupLocation: entry.pickupLocation,
      destinationLocation: entry.destinationLocation,
      destinationLat: entry.destinationLat,
      destinationLng: entry.destinationLng,
      genderPreference: entry.genderPreference,
      isSearching: entry.isSearching,
      lastActive: entry.lastActive,
    }));
    return NextResponse.json({ success: true, activeSearchers: active });
  } catch (error) {
    console.error("GET /api/rides/presence error:", error);
    return NextResponse.json({ success: false, error: "Server error" }, { status: 500 });
  }
}
