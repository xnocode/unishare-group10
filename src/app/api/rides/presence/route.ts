import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedRideUser } from "@/app/lib/ride-auth";
import { recordRidesPresence, getActiveRidersPresence } from "@/app/lib/rides-presence";

export async function POST(req: NextRequest) {
  try {
    const user = await getAuthenticatedRideUser(req);
    const body = await req.json().catch(() => ({}));

    const lat = typeof body.lat === "number" ? body.lat : null;
    const lng = typeof body.lng === "number" ? body.lng : null;
    const pickupLocation = (body.pickupLocation || "").trim();
    const destinationLocation = (body.destinationLocation || "").trim();
    const destinationLat = typeof body.destinationLat === "number" ? body.destinationLat : null;
    const destinationLng = typeof body.destinationLng === "number" ? body.destinationLng : null;

    if (!lat || !lng) {
      return NextResponse.json({ success: false, error: "Latitude and longitude required" }, { status: 400 });
    }

    const userId = user?.id || body.anonymousId || "guest-seeker";
    const fullName = user?.fullName || "Active Student";
    const initials = fullName
      .split(" ")
      .map((n: string) => n[0])
      .join("")
      .slice(0, 2)
      .toUpperCase();

    recordRidesPresence({
      userId,
      fullName,
      avatarInitials: initials,
      university: user?.university || "Verified University",
      department: user?.department || "Campus Student",
      verified: user ? user.verified : true,
      lat,
      lng,
      pickupLocation: pickupLocation || "Nearby Pickup",
      destinationLocation: destinationLocation || undefined,
      destinationLat,
      destinationLng,
      gender: user?.gender || null,
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
    const active = getActiveRidersPresence(user?.id);
    return NextResponse.json({ success: true, activeSearchers: active });
  } catch (error) {
    console.error("GET /api/rides/presence error:", error);
    return NextResponse.json({ success: false, error: "Server error" }, { status: 500 });
  }
}
