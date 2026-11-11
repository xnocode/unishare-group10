import { NextRequest, NextResponse } from "next/server";
import { db } from "@/app/lib/db";
import { verifySignedPayload } from "@/app/lib/auth";

interface FallbackTrackingPayload {
  token: string;
  studentName: string;
  studentId: string | null;
  lat: number | null;
  lng: number | null;
  accuracy: number | null;
  createdAt: string;
  exp: number;
}

// GET: Secure Emergency Tracking Endpoint for authorized emergency contacts
// Accessed via cryptographically secure, unguessable token
export async function GET(
  req: NextRequest,
  context: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await context.params;

    if (!token || token.length < 16) {
      return NextResponse.json(
        { success: false, error: "Invalid tracking token format." },
        { status: 400 }
      );
    }

    let session = null;
    try {
      session = await db.emergencySession.findUnique({
        where: { trackingToken: token },
        include: {
          user: {
            select: {
              fullName: true,
              studentId: true,
              email: true,
            },
          },
          locationUpdates: {
            orderBy: { timestamp: "desc" },
            take: 25,
          },
          callAttempts: {
            orderBy: { createdAt: "desc" },
            take: 6,
          },
        },
      });
    } catch (dbErr) {
      console.warn("Tracking lookup DB warning:", dbErr);
    }

    if (!session) {
      const fallbackToken = req.nextUrl.searchParams.get("fallback");
      const fallback = verifySignedPayload<FallbackTrackingPayload>(fallbackToken);
      if (
        fallback &&
        fallback.token === token &&
        typeof fallback.exp === "number" &&
        fallback.exp > Date.now()
      ) {
        const hasCoords =
          typeof fallback.lat === "number" && typeof fallback.lng === "number";
        const latestLoc = hasCoords
          ? {
              latitude: fallback.lat as number,
              longitude: fallback.lng as number,
              accuracy: fallback.accuracy,
              timestamp: fallback.createdAt,
            }
          : null;
        return NextResponse.json({
          success: true,
          isExpired: false,
          session: {
            id: `serverless-${token.slice(0, 8)}`,
            status: "ACTIVE",
            callingStatus: "ESCALATING",
            triggerReason: "SOS Emergency Confirmed",
            createdAt: fallback.createdAt,
            studentName: fallback.studentName || "UniShare Student",
            studentId: fallback.studentId || undefined,
            gpsStatus: hasCoords ? "CONNECTED" : "PENDING",
            latestLocation: latestLoc,
            breadcrumbs: latestLoc ? [latestLoc] : [],
            recentCalls: [],
          },
        });
      }

      return NextResponse.json(
        { success: false, error: "Emergency tracking link is invalid or does not exist." },
        { status: 404 }
      );
    }

    // Requirement 10: Expire access when the emergency is resolved
    if (session.status !== "ACTIVE") {
      return NextResponse.json({
        success: true,
        isExpired: true,
        status: session.status,
        studentName: session.user.fullName,
        resolvedAt: session.resolvedAt,
        resolvedReason: session.resolvedReason || "Student has marked themselves safe and ended the emergency session.",
        message: "This emergency tracking link has expired because the emergency has been resolved.",
      });
    }

    // Active session details
    return NextResponse.json({
      success: true,
      isExpired: false,
      session: {
        id: session.id,
        status: session.status,
        callingStatus: session.callingStatus,
        triggerReason: session.triggerReason,
        createdAt: session.createdAt,
        studentName: session.user.fullName,
        studentId: session.user.studentId,
        gpsStatus: session.gpsStatus || "PENDING",
        latestLocation:
          session.latestLatitude !== null && session.latestLongitude !== null
            ? {
                latitude: session.latestLatitude,
                longitude: session.latestLongitude,
                accuracy: session.latestAccuracy,
                timestamp: session.latestLocationAt || session.createdAt,
              }
            : null,
        breadcrumbs: session.locationUpdates.map((u) => ({
          latitude: u.latitude,
          longitude: u.longitude,
          accuracy: u.accuracy,
          timestamp: u.timestamp,
        })),
        recentCalls: session.callAttempts.map((c) => ({
          contactName: c.contactName,
          status: c.status,
          priority: c.priority,
          time: c.createdAt,
        })),
      },
    });
  } catch (err) {
    console.error("Error reading emergency tracking:", err);
    return NextResponse.json(
      { success: false, error: "Internal server error fetching emergency tracking." },
      { status: 500 }
    );
  }
}

// POST: Push live location updates directly from authorized tracking client/device
export async function POST(
  req: NextRequest,
  context: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await context.params;

    if (!token || token.length < 16) {
      return NextResponse.json(
        { success: false, error: "Invalid tracking token format." },
        { status: 400 }
      );
    }

    const body = (await req.json().catch(() => ({}))) as {
      latitude?: number;
      longitude?: number;
      accuracy?: number;
    };
    const { latitude, longitude, accuracy } = body;

    if (
      typeof latitude !== "number" ||
      !Number.isFinite(latitude) ||
      typeof longitude !== "number" ||
      !Number.isFinite(longitude)
    ) {
      return NextResponse.json(
        { success: false, error: "Valid latitude and longitude numbers are required." },
        { status: 400 }
      );
    }

    const session = await db.emergencySession.findUnique({
      where: { trackingToken: token },
    });

    if (!session) {
      return NextResponse.json(
        { success: false, error: "Emergency session not found." },
        { status: 404 }
      );
    }

    if (session.status !== "ACTIVE") {
      return NextResponse.json(
        { success: false, error: "Cannot update location on an inactive or resolved emergency session." },
        { status: 400 }
      );
    }

    const parsedAccuracy =
      typeof accuracy === "number" && Number.isFinite(accuracy) ? accuracy : 10;

    await db.emergencyLocationUpdate.create({
      data: {
        sessionId: session.id,
        latitude,
        longitude,
        accuracy: parsedAccuracy,
      },
    });

    await db.emergencySession.update({
      where: { id: session.id },
      data: {
        latestLatitude: latitude,
        latestLongitude: longitude,
        latestAccuracy: parsedAccuracy,
        latestLocationAt: new Date(),
        gpsStatus: "CONNECTED",
      },
    });

    return NextResponse.json({
      success: true,
      message: "Live location recorded successfully.",
      latitude,
      longitude,
    });
  } catch (err) {
    console.error("Error updating location via token:", err);
    return NextResponse.json(
      { success: false, error: "Internal server error updating live location." },
      { status: 500 }
    );
  }
}


